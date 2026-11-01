import React, { useState, useMemo } from 'react';
import {
  Wallet,
  Landmark,
  PlusCircle,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Printer,
  X,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Building2,
  DollarSign,
  Calculator,
  Calendar,
  Layers,
  ArrowRightLeft
} from 'lucide-react';
import { formatUsd, formatBs } from '../services/formatService';
import { generateCashflowPDF } from '../services/pdfReportService';
import { useNotification } from '../context/NotificationContext';

export default function CashBankModal({
  isOpen,
  onClose,
  cashDesks = [],
  bankAccounts = [],
  cashMovements = [],
  onAddMovement,
  onUpdateCashDesk,
  config = {},
  currentUser
}) {
  const notify = useNotification();
  const [activeTab, setActiveTab] = useState('cajas'); // 'cajas' | 'bancos' | 'movimientos' | 'arqueo'
  const [searchFilter, setSearchFilter] = useState('');
  const [bankFilter, setBankFilter] = useState('ALL');
  
  // Estado para nuevo movimiento de caja
  const [showNewMovForm, setShowNewMovForm] = useState(false);
  const [selectedDeskId, setSelectedDeskId] = useState('');
  const [movType, setMovType] = useState('EGRESO'); // 'INGRESO' | 'EGRESO'
  const [movConcept, setMovConcept] = useState('');
  const [movMontoUsd, setMovMontoUsd] = useState('');
  const [movMontoBs, setMovMontoBs] = useState('');
  const [movMetodo, setMovMetodo] = useState('EFECTIVO_USD');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estado para arqueo interactivo
  const [denomCounts, setDenomCounts] = useState({
    b100: 0,
    b50: 0,
    b20: 0,
    b10: 0,
    b5: 0,
    b1: 0,
    bsEfectivo: 0
  });

  const tasaBcv = Number(config?.tasaDolar) || 827.73;

  // Totales de Efectivo en Cajas
  const totalCajasUsd = useMemo(() => {
    return (cashDesks || []).reduce((acc, c) => acc + Number(c.saldoUsd || c.saldo_usd || 0), 0);
  }, [cashDesks]);

  const totalCajasBs = useMemo(() => {
    return (cashDesks || []).reduce((acc, c) => acc + Number(c.saldoBs || c.saldo_bs || 0), 0);
  }, [cashDesks]);

  // Totales en Bancos
  const totalBancosBs = useMemo(() => {
    return (bankAccounts || []).reduce((acc, b) => acc + Number(b.saldoBs || b.saldo_bs || 0), 0);
  }, [bankAccounts]);

  const totalBancosUsd = useMemo(() => {
    return (bankAccounts || []).reduce((acc, b) => {
      const usd = Number(b.saldoUsd || b.saldo_usd || 0);
      if (usd > 0) return acc + usd;
      const bs = Number(b.saldoBs || b.saldo_bs || 0);
      return acc + (tasaBcv > 0 ? bs / tasaBcv : 0);
    }, 0);
  }, [bankAccounts, tasaBcv]);

  // Total Consolidado
  const totalConsolidadoUsd = totalCajasUsd + totalBancosUsd;
  const totalConsolidadoBs = totalCajasBs + totalBancosBs;

  // Filtrado de bancos
  const filteredBankAccounts = useMemo(() => {
    let list = Array.isArray(bankAccounts) ? [...bankAccounts] : [];
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      list = list.filter(b => 
        (b.bancoNombre || b.banco_nombre || '').toLowerCase().includes(q) ||
        (b.numCta || b.num_cta || '').includes(q) ||
        (b.codCta || b.cod_cta || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [bankAccounts, searchFilter]);

  // Filtrado de movimientos
  const filteredMovements = useMemo(() => {
    let list = Array.isArray(cashMovements) ? [...cashMovements] : [];
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase();
      list = list.filter(m => 
        (m.concepto || '').toLowerCase().includes(q) ||
        (m.usuario || '').toLowerCase().includes(q) ||
        (m.tipo || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [cashMovements, searchFilter]);

  // Conteo físico del arqueo
  const arqueoTotalUsd = useMemo(() => {
    return (
      (denomCounts.b100 || 0) * 100 +
      (denomCounts.b50 || 0) * 50 +
      (denomCounts.b20 || 0) * 20 +
      (denomCounts.b10 || 0) * 10 +
      (denomCounts.b5 || 0) * 5 +
      (denomCounts.b1 || 0) * 1
    );
  }, [denomCounts]);

  const arqueoTotalBs = Number(denomCounts.bsEfectivo || 0);
  const arqueoDiferenciaUsd = arqueoTotalUsd - totalCajasUsd;
  const arqueoDiferenciaBs = arqueoTotalBs - totalCajasBs;

  // Registrar movimiento
  const handleSaveMovement = async (e) => {
    e.preventDefault();
    if (!movConcept.trim()) {
      notify.warning('Por favor ingrese el concepto del movimiento');
      return;
    }
    const montoUsd = parseFloat(movMontoUsd) || 0;
    const montoBs = parseFloat(movMontoBs) || 0;
    if (montoUsd <= 0 && montoBs <= 0) {
      notify.warning('Por favor ingrese un monto válido en USD o Bs');
      return;
    }

    try {
      setIsSubmitting(true);
      const newMov = {
        id: `MOV-${Date.now()}`,
        fecha: new Date().toISOString(),
        tipo: movType,
        concepto: movConcept.trim(),
        monto_usd: montoUsd,
        monto_bs: montoBs > 0 ? montoBs : (montoUsd * tasaBcv),
        metodo: movMetodo,
        usuario: currentUser?.nombre || currentUser?.username || 'Cajero'
      };

      if (onAddMovement) {
        await onAddMovement(newMov);
      }

      // Si se seleccionó una caja específica, actualizar su saldo
      if (selectedDeskId && onUpdateCashDesk) {
        const targetDesk = cashDesks.find(d => d.id === selectedDeskId);
        if (targetDesk) {
          const deltaUsd = movType === 'INGRESO' ? montoUsd : -montoUsd;
          const deltaBs = movType === 'INGRESO' ? montoBs : -montoBs;
          await onUpdateCashDesk({
            ...targetDesk,
            saldoUsd: Math.max(0, Number(targetDesk.saldoUsd || targetDesk.saldo_usd || 0) + deltaUsd),
            saldoBs: Math.max(0, Number(targetDesk.saldoBs || targetDesk.saldo_bs || 0) + deltaBs)
          });
        }
      }

      setMovConcept('');
      setMovMontoUsd('');
      setMovMontoBs('');
      setShowNewMovForm(false);
      notify.success('Movimiento registrado en caja chica exitosamente');
    } catch (err) {
      console.error(err);
      notify.error('Error al registrar movimiento: ' + (err.message || 'Error desconocido'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Función de reporte PDF oficial
  const handlePrint = () => {
    generateCashflowPDF({
      bankAccounts,
      cashDesks,
      cashMovements,
      config: { ...config, tasaDolar: tasaBcv },
      currentUser
    });
  };

  return (
    <section 
      className="cash-bank-view card printable-document"
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
              background: 'linear-gradient(135deg, rgba(0,43,122,0.15), rgba(2,132,199,0.25))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--brand-blue)'
            }}>
              <Wallet size={24} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-heading)' }}>
                Caja Chica & Tesorería Bancaria
              </h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Control Bimonetario Profit Plus 2K8 • Tasa BCV: {formatBs(tasaBcv)}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: 'auto' }}>
            <button
              onClick={handlePrint}
              className="btn btn-print-report"
              title="Descargar Reporte Oficial de Caja y Bancos en PDF"
            >
              <Printer size={16} color="#ffffff" />
              <span>Imprimir Reporte</span>
            </button>
          </div>
        </div>

        {/* RESUMEN KPIS */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1rem',
          padding: '1.25rem 1.75rem',
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-glass)'
        }}>
          {/* Card Efectivo en Cajas */}
          <div style={{
            background: 'var(--bg-card-glass)',
            padding: '1rem',
            borderRadius: '12px',
            border: '1px solid var(--border-glass)',
            borderLeft: '4px solid #10b981'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Efectivo en Cajas
              </span>
              <Wallet size={16} style={{ color: '#10b981' }} />
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {formatUsd(totalCajasUsd)}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              {formatBs(totalCajasBs)}
            </div>
          </div>

          {/* Card Bancos Profit */}
          <div style={{
            background: 'var(--bg-card-glass)',
            padding: '1rem',
            borderRadius: '12px',
            border: '1px solid var(--border-glass)',
            borderLeft: '4px solid #0284c7'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Disponibilidad Bancaria (10 Cuentas)
              </span>
              <Landmark size={16} style={{ color: '#0284c7' }} />
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {formatUsd(totalBancosUsd)}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              {formatBs(totalBancosBs)}
            </div>
          </div>

          {/* Card Total Consolidado */}
          <div style={{
            background: 'var(--bg-card-glass)',
            padding: '1rem',
            borderRadius: '12px',
            border: '1px solid var(--border-glass)',
            borderLeft: '4px solid #8b5cf6'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                Liquidez Total Motorven
              </span>
              <DollarSign size={16} style={{ color: '#8b5cf6' }} />
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--brand-blue)' }}>
              {formatUsd(totalConsolidadoUsd)}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              {formatBs(totalConsolidadoBs)}
            </div>
          </div>
        </div>

        {/* NAVEGACIÓN DE PESTAÑAS */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          padding: '0.75rem 1.75rem 0',
          borderBottom: '1px solid var(--border-glass)',
          background: 'var(--bg-card-glass)'
        }}>
          <button
            onClick={() => setActiveTab('cajas')}
            style={{
              padding: '0.65rem 1.25rem',
              fontWeight: 600,
              fontSize: '0.88rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: activeTab === 'cajas' ? 'var(--brand-blue)' : 'var(--text-muted)',
              borderBottom: activeTab === 'cajas' ? '2px solid var(--brand-blue)' : '2px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <Wallet size={16} />
            Cajas Registradoras ({cashDesks?.length || 0})
          </button>

          <button
            onClick={() => setActiveTab('bancos')}
            style={{
              padding: '0.65rem 1.25rem',
              fontWeight: 600,
              fontSize: '0.88rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: activeTab === 'bancos' ? 'var(--brand-blue)' : 'var(--text-muted)',
              borderBottom: activeTab === 'bancos' ? '2px solid var(--brand-blue)' : '2px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <Landmark size={16} />
            Cuentas Bancarias ({bankAccounts?.length || 0})
          </button>

          <button
            onClick={() => setActiveTab('arqueo')}
            style={{
              padding: '0.65rem 1.25rem',
              fontWeight: 600,
              fontSize: '0.88rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: activeTab === 'arqueo' ? 'var(--brand-blue)' : 'var(--text-muted)',
              borderBottom: activeTab === 'arqueo' ? '2px solid var(--brand-blue)' : '2px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <Calculator size={16} />
            Arqueo & Conteo Físico
          </button>

          <button
            onClick={() => setActiveTab('movimientos')}
            style={{
              padding: '0.65rem 1.25rem',
              fontWeight: 600,
              fontSize: '0.88rem',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              color: activeTab === 'movimientos' ? 'var(--brand-blue)' : 'var(--text-muted)',
              borderBottom: activeTab === 'movimientos' ? '2px solid var(--brand-blue)' : '2px solid transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <ArrowRightLeft size={16} />
            Movimientos ({cashMovements?.length || 0})
          </button>
        </div>

        {/* CONTENIDO DE LA PESTAÑA */}
        <div style={{ width: '100%', minWidth: 0, padding: '1.5rem 1.75rem' }}>
          {/* 1. PESTAÑA: CAJAS REGISTRADORAS */}
          {activeTab === 'cajas' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  Cajas de custodia, caja chica y mostradores sincronizados con Supabase & Profit Plus 2K8.
                </span>
                <button
                  onClick={() => setShowNewMovForm(!showNewMovForm)}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 1rem', fontSize: '0.85rem' }}
                >
                  <PlusCircle size={16} />
                  <span>{showNewMovForm ? 'Cancelar Movimiento' : 'Nuevo Movimiento de Caja'}</span>
                </button>
              </div>

              {/* FORMULARIO DE NUEVO MOVIMIENTO */}
              {showNewMovForm && (
                <div style={{
                  background: 'var(--bg-surface)',
                  padding: '1.25rem',
                  borderRadius: '12px',
                  border: '1px solid var(--border-glass)',
                  marginBottom: '1.5rem',
                  boxShadow: 'var(--shadow-card)'
                }}>
                  <h4 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Registrar Entrada / Salida de Efectivo
                  </h4>
                  <form onSubmit={handleSaveMovement}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                          Tipo de Operación
                        </label>
                        <select
                          className="filter-select"
                          value={movType}
                          onChange={(e) => setMovType(e.target.value)}
                          style={{ width: '100%' }}
                        >
                          <option value="EGRESO">Egreso / Gasto Operativo</option>
                          <option value="INGRESO">Ingreso / Depósito Efectivo</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                          Caja Afectada
                        </label>
                        <select
                          className="filter-select"
                          value={selectedDeskId}
                          onChange={(e) => setSelectedDeskId(e.target.value)}
                          style={{ width: '100%' }}
                        >
                          <option value="">Caja General (No específica)</option>
                          {cashDesks.map(d => (
                            <option key={d.id} value={d.id}>{d.coCaja || d.co_caja} - {d.descripcion}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                          Monto USD
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          className="input-modern"
                          value={movMontoUsd}
                          onChange={(e) => {
                            setMovMontoUsd(e.target.value);
                            const val = parseFloat(e.target.value) || 0;
                            if (val > 0) setMovMontoBs((val * tasaBcv).toFixed(2));
                          }}
                          style={{ width: '100%' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                          Monto Bs (Equivalente)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          className="input-modern"
                          value={movMontoBs}
                          onChange={(e) => setMovMontoBs(e.target.value)}
                          style={{ width: '100%' }}
                        />
                      </div>
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                        Concepto / Motivo
                      </label>
                      <input
                        type="text"
                        placeholder="Ej: Pago de suministros, Viáticos, Anticipo o Reposición de Caja Chica..."
                        className="input-modern"
                        value={movConcept}
                        onChange={(e) => setMovConcept(e.target.value)}
                        style={{ width: '100%' }}
                        required
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                      <button
                        type="button"
                        onClick={() => setShowNewMovForm(false)}
                        className="btn btn-secondary"
                        style={{ padding: '0.5rem 1rem' }}
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="btn btn-primary"
                        style={{ padding: '0.5rem 1.25rem' }}
                      >
                        {isSubmitting ? 'Guardando...' : 'Confirmar Registro'}
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* GRILLA DE CAJAS */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
                {cashDesks.map(desk => (
                  <div
                    key={desk.id}
                    style={{
                      background: 'var(--bg-card-glass)',
                      border: '1px solid var(--border-glass)',
                      borderRadius: '14px',
                      padding: '1.25rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      boxShadow: 'var(--shadow-card)'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                        <div>
                          <span style={{
                            display: 'inline-block',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '6px',
                            background: 'rgba(0,43,122,0.1)',
                            color: 'var(--brand-blue)',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            marginBottom: '0.35rem'
                          }}>
                            {desk.coCaja || desk.co_caja}
                          </span>
                          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {desk.descripcion}
                          </h3>
                        </div>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.3rem',
                          padding: '0.2rem 0.6rem',
                          borderRadius: '20px',
                          background: 'rgba(16, 185, 129, 0.1)',
                          color: '#059669',
                          fontSize: '0.75rem',
                          fontWeight: 600
                        }}>
                          <CheckCircle2 size={12} /> Activa
                        </span>
                      </div>

                      <div style={{
                        background: 'var(--bg-surface)',
                        padding: '1rem',
                        borderRadius: '10px',
                        marginBottom: '1rem'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.35rem' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Saldo Disponible USD:</span>
                          <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {formatUsd(Number(desk.saldoUsd || desk.saldo_usd || 0))}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Saldo Equivalente Bs:</span>
                          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            {formatBs(Number(desk.saldoBs || desk.saldo_bs || 0))}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderTop: '1px solid var(--border-glass)',
                      paddingTop: '0.75rem',
                      fontSize: '0.78rem',
                      color: 'var(--text-muted)'
                    }}>
                      <span>Responsable: <strong>{desk.responsable || 'Caja Central'}</strong></span>
                      <span>Moneda: <strong>{desk.moneda || 'USD/BS'}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. PESTAÑA: CUENTAS BANCARIAS */}
          {activeTab === 'bancos' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
                <div className="search-wrapper" style={{ flex: '1 1 300px' }}>
                  <Search size={16} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Buscar por banco, cuenta o código..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="input-modern"
                    style={{ width: '100%', paddingLeft: '2.4rem' }}
                  />
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Total Cuentas: <strong>{filteredBankAccounts.length}</strong>
                </div>
              </div>

              <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-table-header)', borderBottom: '1px solid var(--border-glass)' }}>
                      <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Cód</th>
                      <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Institución Bancaria</th>
                      <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Número de Cuenta</th>
                      <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Moneda</th>
                      <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>Saldo en Bs</th>
                      <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>Contravalor USD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBankAccounts.map((b, idx) => {
                      const saldoBs = Number(b.saldoBs || b.saldo_bs || 0);
                      const saldoUsd = Number(b.saldoUsd || b.saldo_usd || (tasaBcv > 0 ? saldoBs / tasaBcv : 0));
                      const isNegative = saldoBs < 0;

                      return (
                        <tr 
                          key={b.id || idx}
                          style={{
                            borderBottom: '1px solid var(--border-glass)',
                            background: idx % 2 === 0 ? 'var(--bg-card-glass)' : 'var(--bg-surface)'
                          }}
                        >
                          <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--brand-blue)' }}>
                            {b.codCta || b.cod_cta}
                          </td>
                          <td style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <Building2 size={16} style={{ color: 'var(--brand-blue)' }} />
                              {b.bancoNombre || b.banco_nombre}
                            </div>
                          </td>
                          <td style={{ padding: '0.85rem 1rem', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                            {b.numCta || b.num_cta || 'N/A'}
                          </td>
                          <td style={{ padding: '0.85rem 1rem' }}>
                            <span style={{
                              padding: '0.2rem 0.5rem',
                              borderRadius: '4px',
                              background: 'rgba(0,43,122,0.08)',
                              fontSize: '0.75rem',
                              fontWeight: 600
                            }}>
                              {b.moneda || 'BS'}
                            </span>
                          </td>
                          <td style={{
                            padding: '0.85rem 1rem',
                            textAlign: 'right',
                            fontWeight: 700,
                            color: isNegative ? 'var(--brand-red)' : 'var(--text-primary)'
                          }}>
                            {formatBs(saldoBs)}
                          </td>
                          <td style={{
                            padding: '0.85rem 1rem',
                            textAlign: 'right',
                            fontWeight: 700,
                            color: isNegative ? 'var(--brand-red)' : '#059669'
                          }}>
                            {formatUsd(saldoUsd)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 3. PESTAÑA: ARQUEO DE CAJA */}
          {activeTab === 'arqueo' && (
            <div>
              <div style={{ marginBottom: '1.25rem' }}>
                <h3 style={{ margin: '0 0 0.35rem', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Arqueo de Efectivo Físico & Conciliación
                </h3>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Ingrese la cantidad de billetes en efectivo contados físicamente para comparar automáticamente contra el saldo del sistema.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
                {/* Tabla de Conteo */}
                <div style={{
                  background: 'var(--bg-card-glass)',
                  padding: '1.25rem',
                  borderRadius: '12px',
                  border: '1px solid var(--border-glass)'
                }}>
                  <h4 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Conteo de Denominaciones USD
                  </h4>

                  <div style={{ display: 'grid', gap: '0.75rem' }}>
                    {[
                      { key: 'b100', val: 100, label: 'Billetes de $100' },
                      { key: 'b50', val: 50, label: 'Billetes de $50' },
                      { key: 'b20', val: 20, label: 'Billetes de $20' },
                      { key: 'b10', val: 10, label: 'Billetes de $10' },
                      { key: 'b5', val: 5, label: 'Billetes de $5' },
                      { key: 'b1', val: 1, label: 'Billetes de $1' }
                    ].map(den => (
                      <div key={den.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                        <span style={{ fontSize: '0.88rem', fontWeight: 500, color: 'var(--text-primary)', flex: 1 }}>
                          {den.label}
                        </span>
                        <input
                          type="number"
                          min="0"
                          placeholder="0"
                          className="input-modern"
                          style={{ width: '80px', textAlign: 'center' }}
                          value={denomCounts[den.key] || ''}
                          onChange={(e) => setDenomCounts({ ...denomCounts, [den.key]: parseInt(e.target.value) || 0 })}
                        />
                        <span style={{ width: '90px', textAlign: 'right', fontWeight: 600, fontSize: '0.88rem', color: 'var(--brand-blue)' }}>
                          {formatUsd((denomCounts[den.key] || 0) * den.val)}
                        </span>
                      </div>
                    ))}

                    <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                        <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
                          Total Bolívares (Efectivo Bs)
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          className="input-modern"
                          style={{ width: '130px', textAlign: 'right' }}
                          value={denomCounts.bsEfectivo || ''}
                          onChange={(e) => setDenomCounts({ ...denomCounts, bsEfectivo: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Resumen de Diferencias */}
                <div style={{
                  background: 'var(--bg-surface)',
                  padding: '1.25rem',
                  borderRadius: '12px',
                  border: '1px solid var(--border-glass)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <h4 style={{ margin: '0 0 1rem', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Resultado del Arqueo
                    </h4>

                    <div style={{ display: 'grid', gap: '1rem' }}>
                      <div style={{ background: 'var(--bg-card-glass)', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                        <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>Físico Contado USD:</span>
                        <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#059669' }}>{formatUsd(arqueoTotalUsd)}</span>
                      </div>

                      <div style={{ background: 'var(--bg-card-glass)', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
                        <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>Saldo en Sistema USD:</span>
                        <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>{formatUsd(totalCajasUsd)}</span>
                      </div>

                      <div style={{
                        background: Math.abs(arqueoDiferenciaUsd) < 0.01 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(230, 0, 18, 0.08)',
                        padding: '0.85rem',
                        borderRadius: '8px',
                        border: `1px solid ${Math.abs(arqueoDiferenciaUsd) < 0.01 ? '#10b981' : '#e60012'}`
                      }}>
                        <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)' }}>Diferencia USD:</span>
                        <span style={{
                          fontSize: '1.25rem',
                          fontWeight: 700,
                          color: Math.abs(arqueoDiferenciaUsd) < 0.01 ? '#059669' : '#dc2626'
                        }}>
                          {formatUsd(arqueoDiferenciaUsd)}
                          {Math.abs(arqueoDiferenciaUsd) < 0.01 && ' (Cuadrado)'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: '1.5rem' }}>
                    <button
                      onClick={handlePrint}
                      className="btn btn-print-report"
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.75rem' }}
                    >
                      <Printer size={16} color="#ffffff" />
                      Imprimir Reporte
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. PESTAÑA: MOVIMIENTOS RECIENTES */}
          {activeTab === 'movimientos' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
                <div className="search-wrapper" style={{ flex: '1 1 300px' }}>
                  <Search size={16} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Buscar por concepto o usuario..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="input-modern"
                    style={{ width: '100%', paddingLeft: '2.4rem' }}
                  />
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Total Movimientos: <strong>{filteredMovements.length}</strong>
                </div>
              </div>

              {filteredMovements.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                  <ArrowRightLeft size={36} style={{ margin: '0 auto 0.75rem', opacity: 0.4 }} />
                  <p style={{ margin: 0, fontSize: '0.95rem' }}>No se han registrado movimientos de caja aún.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.88rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-table-header)', borderBottom: '1px solid var(--border-glass)' }}>
                        <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Fecha</th>
                        <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Tipo</th>
                        <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Concepto</th>
                        <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Usuario</th>
                        <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>Monto USD</th>
                        <th style={{ padding: '0.85rem 1rem', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right' }}>Monto Bs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMovements.map((m, idx) => {
                        const isIngreso = m.tipo === 'INGRESO';
                        return (
                          <tr
                            key={m.id || idx}
                            style={{
                              borderBottom: '1px solid var(--border-glass)',
                              background: idx % 2 === 0 ? 'var(--bg-card-glass)' : 'var(--bg-surface)'
                            }}
                          >
                            <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>
                              {m.fecha ? new Date(m.fecha).toLocaleString() : 'N/A'}
                            </td>
                            <td style={{ padding: '0.85rem 1rem' }}>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                padding: '0.2rem 0.5rem',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                background: isIngreso ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                color: isIngreso ? '#059669' : '#dc2626'
                              }}>
                                {isIngreso ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                                {m.tipo}
                              </span>
                            </td>
                            <td style={{ padding: '0.85rem 1rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                              {m.concepto}
                            </td>
                            <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>
                              {m.usuario || 'Sistema'}
                            </td>
                            <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 700, color: isIngreso ? '#059669' : '#dc2626' }}>
                              {formatUsd(Number(m.monto_usd || 0))}
                            </td>
                            <td style={{ padding: '0.85rem 1rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-muted)' }}>
                              {formatBs(Number(m.monto_bs || 0))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
    </section>
  );
}
