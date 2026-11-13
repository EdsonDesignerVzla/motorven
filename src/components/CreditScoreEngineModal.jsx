import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Users,
  Search,
  Filter,
  DollarSign,
  Calendar,
  Percent,
  TrendingUp,
  TrendingDown,
  Printer,
  Download,
  X,
  Clock,
  Layers,
  Award,
  Check,
  Building,
  Sliders,
  Send,
  FileText
} from 'lucide-react';
import { formatUsd, formatBs, round2 } from '../services/formatService';
import { generateAccountsReceivablePDF } from '../services/pdfReportService';

export default function CreditScoreEngineModal({
  isOpen,
  onClose,
  clients = [],
  profitInvoices = [],
  profitCollections = [],
  config = {},
  currentUser = null,
  tasaBcv: propTasaBcv,
  onSelectClientForSale
}) {
  const tasaBcv = Number(propTasaBcv || config?.tasaDolar || 827.73);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [ratingFilter, setRatingFilter] = useState('TODOS'); // TODOS, AAA, AA, A, B, C, D
  const [statusFilter, setStatusFilter] = useState('TODOS'); // TODOS, AUTORIZADO, APROBACION, BLOQUEADO
  const [selectedClient, setSelectedClient] = useState(null);
  
  // Simulador de Validación de Nuevo Pedido
  const [simulatedOrderAmountUsd, setSimulatedOrderAmountUsd] = useState(1500);
  const [activeTab, setActiveTab] = useState('ranking'); // 'ranking' | 'evaluator' | 'policy' | 'print'

  // =========================================================================
  // 1. MOTOR DE CÁLCULO DE SCORE DE CRÉDITO Y EVALUACIÓN DE RIESGO
  // =========================================================================
  const scoredClients = useMemo(() => {
    const now = new Date();

    return clients.map(client => {
      const rif = (client.rif || '').trim().toUpperCase();
      const nombre = client.nombre || client.razonSocial || 'Cliente';
      const coCli = (client.codigo || client.id || '').trim();

      // Facturas y pagos del cliente
      const clientInvoices = profitInvoices.filter(f => 
        (f.clienteRif && f.clienteRif.trim().toUpperCase() === rif) ||
        (f.clienteNombre && f.clienteNombre.trim().toLowerCase() === nombre.toLowerCase())
      );

      const clientCollections = profitCollections.filter(c => 
        (c.clienteRif && c.clienteRif.trim().toUpperCase() === rif) ||
        (c.clienteNombre && c.clienteNombre.trim().toLowerCase() === nombre.toLowerCase())
      );

      // Calcular moras y saldos
      const unpaidInvoices = clientInvoices.filter(f => (f.saldoUsd > 0.01 || f.saldoBs > 0.01) && !f.anulado);
      
      let maxDiasMora = 0;
      let totalSaldoVencidoUsd = 0;
      let totalSaldoVigenteUsd = 0;

      unpaidInvoices.forEach(inv => {
        const saldo = Number(inv.saldoUsd || (inv.saldoBs ? inv.saldoBs / tasaBcv : 0));
        let dias = 0;
        if (inv.fecVenc) {
          const vDate = new Date(inv.fecVenc);
          const diff = Math.floor((now - vDate) / (1000 * 60 * 60 * 24));
          dias = Math.max(0, diff);
        } else if (inv.fecEmis) {
          const eDate = new Date(inv.fecEmis);
          const plazo = Number(client.diasCredito || 15);
          const diff = Math.floor((now - eDate) / (1000 * 60 * 60 * 24)) - plazo;
          dias = Math.max(0, diff);
        }

        if (dias > maxDiasMora) maxDiasMora = dias;
        if (dias > 0) {
          totalSaldoVencidoUsd += saldo;
        } else {
          totalSaldoVigenteUsd += saldo;
        }
      });

      const saldoDeudorTotalUsd = Number(client.saldoDeudorUsd || 0) || (totalSaldoVencidoUsd + totalSaldoVigenteUsd);
      const limiteCreditoUsd = Number(client.limiteCreditoUsd || 5000);
      const diasCreditoAcordados = Number(client.diasCredito || 15);

      // Utilización del Límite de Crédito
      const utilizacionPct = limiteCreditoUsd > 0 ? (saldoDeudorTotalUsd / limiteCreditoUsd) * 100 : 0;
      const creditoDisponibleUsd = Math.max(0, limiteCreditoUsd - saldoDeudorTotalUsd);

      // =====================================================================
      // CÁLCULO DE LOS 5 FACTORES DEL SCORE (0 - 100 PUNTOS)
      // =====================================================================
      
      // Factor 1: Historial de Puntualidad y Días de Mora (Max 35 pts)
      let scoreMora = 35;
      if (maxDiasMora === 0) scoreMora = 35;
      else if (maxDiasMora <= 7) scoreMora = 28;
      else if (maxDiasMora <= 15) scoreMora = 18;
      else if (maxDiasMora <= 30) scoreMora = 8;
      else scoreMora = 0;

      // Factor 2: Nivel de Utilización de Límite (Max 25 pts)
      let scoreUtilizacion = 25;
      if (utilizacionPct <= 30) scoreUtilizacion = 25;
      else if (utilizacionPct <= 60) scoreUtilizacion = 20;
      else if (utilizacionPct <= 85) scoreUtilizacion = 14;
      else if (utilizacionPct <= 100) scoreUtilizacion = 8;
      else scoreUtilizacion = 0; // Excedido

      // Factor 3: Frecuencia y Volumen de Compra Histórico (Max 20 pts)
      let scoreVolumen = 15;
      const facturasCount = clientInvoices.length;
      if (facturasCount >= 8) scoreVolumen = 20;
      else if (facturasCount >= 4) scoreVolumen = 16;
      else if (facturasCount >= 1) scoreVolumen = 12;
      else scoreVolumen = 8;

      // Factor 4: Confiabilidad de Instrumentos de Pago (Max 10 pts)
      let scoreMetodos = 10;
      const hasZelleOrCash = clientCollections.some(c => (c.formasPago || []).some(fp => fp.tipo === 'ZELLE' || fp.tipo === 'EFECTIVO_USD'));
      if (hasZelleOrCash) scoreMetodos = 10;
      else if (clientCollections.length > 0) scoreMetodos = 8;
      else scoreMetodos = 6;

      // Factor 5: Perfil Jurídico / Fiscal / Antigüedad (Max 10 pts)
      let scoreFiscal = 8;
      if (client.contribuyenteEspecial || client.tipoPersona === 'JURIDICA') scoreFiscal += 2;

      // SCORE TOTAL FINAL
      const creditScore = Math.min(100, Math.max(0, scoreMora + scoreUtilizacion + scoreVolumen + scoreMetodos + scoreFiscal));

      // CLASIFICACIÓN RATING & VEREDICTO
      let rating = 'AAA';
      let ratingBadgeClass = 'badge-success';
      let veredicto = 'AUTORIZADO'; // 'AUTORIZADO' | 'APROBACION_GERENCIA' | 'BLOQUEADO'
      let colorVeredicto = 'var(--semaforo-verde)';
      let textoVeredicto = 'Despacho Inmediato Autorizado';
      let accionSugerida = 'Aprobación automática. Cliente premium de alta confiabilidad.';
      let limiteSugeridoUsd = limiteCreditoUsd;

      if (creditScore >= 85) {
        rating = 'AAA';
        ratingBadgeClass = 'badge-success';
        veredicto = 'AUTORIZADO';
        colorVeredicto = 'var(--semaforo-verde)';
        textoVeredicto = 'Despacho Inmediato Autorizado';
        accionSugerida = 'Elegible para ampliación de crédito (+25%). Despacho express sin restricciones.';
        limiteSugeridoUsd = round2(limiteCreditoUsd * 1.25);
      } else if (creditScore >= 70) {
        rating = 'AA';
        ratingBadgeClass = 'badge-primary';
        veredicto = 'AUTORIZADO';
        colorVeredicto = '#0284c7';
        textoVeredicto = 'Despacho Autorizado';
        accionSugerida = 'Despacho normal dentro de la línea de crédito acordada.';
        limiteSugeridoUsd = round2(limiteCreditoUsd);
      } else if (creditScore >= 55) {
        rating = 'A';
        ratingBadgeClass = 'badge-warning';
        veredicto = 'APROBACION_GERENCIA';
        colorVeredicto = 'var(--motorven-gold)';
        textoVeredicto = 'Aprobación Gerencial';
        accionSugerida = 'Monitoreo de cobranza. Exige abono previo si supera el 80% del límite.';
        limiteSugeridoUsd = round2(limiteCreditoUsd * 0.85);
      } else if (creditScore >= 40) {
        rating = 'B';
        ratingBadgeClass = 'badge-warning';
        veredicto = 'APROBACION_GERENCIA';
        colorVeredicto = '#ea580c';
        textoVeredicto = 'Riesgo Moderado / Aprobación Requerida';
        accionSugerida = 'Requiere abono del 50% de la deuda pendiente antes de despachar nueva mercancía.';
        limiteSugeridoUsd = round2(limiteCreditoUsd * 0.60);
      } else {
        rating = 'C';
        ratingBadgeClass = 'badge-danger';
        veredicto = 'BLOQUEADO';
        colorVeredicto = 'var(--motorven-red)';
        textoVeredicto = 'Despacho Bloqueado';
        accionSugerida = 'Línea de crédito congelada por mora severa. Exclusivamente ventas de contado / prepago.';
        limiteSugeridoUsd = 0;
      }

      // Si tiene más de 30 días de mora, forzar bloqueo inmediato por política de crédito
      if (maxDiasMora > 30) {
        veredicto = 'BLOQUEADO';
        colorVeredicto = 'var(--motorven-red)';
        textoVeredicto = 'Bloqueado por Mora (+30d)';
        accionSugerida = 'Bloqueo estricto por mora crítica. Coordinar gestión jurídica o cobro extrajudicial.';
      }

      return {
        ...client,
        coCli,
        nombre,
        rif,
        unpaidInvoicesCount: unpaidInvoices.length,
        maxDiasMora,
        saldoDeudorTotalUsd,
        saldoDeudorTotalBs: saldoDeudorTotalUsd * tasaBcv,
        totalSaldoVencidoUsd,
        totalSaldoVigenteUsd,
        limiteCreditoUsd,
        diasCreditoAcordados,
        utilizacionPct,
        creditoDisponibleUsd,
        scoreMora,
        scoreUtilizacion,
        scoreVolumen,
        scoreMetodos,
        scoreFiscal,
        creditScore,
        rating,
        ratingBadgeClass,
        veredicto,
        colorVeredicto,
        textoVeredicto,
        accionSugerida,
        limiteSugeridoUsd
      };
    }).sort((a, b) => b.creditScore - a.creditScore);
  }, [clients, profitInvoices, profitCollections, tasaBcv]);

  // Selección inicial
  const activeEvaluatedClient = selectedClient || scoredClients[0] || null;

  // 2. FILTRADO
  const filteredClients = useMemo(() => {
    return scoredClients.filter(c => {
      const q = searchTerm.toLowerCase().trim();
      const matchSearch = !q ||
        c.nombre.toLowerCase().includes(q) ||
        c.rif.toLowerCase().includes(q) ||
        (c.coCli && c.coCli.toLowerCase().includes(q)) ||
        (c.vendedorAsignado && c.vendedorAsignado.toLowerCase().includes(q));

      const matchRating = ratingFilter === 'TODOS' || c.rating === ratingFilter;
      const matchStatus = statusFilter === 'TODOS' || c.veredicto === statusFilter;

      return matchSearch && matchRating && matchStatus;
    });
  }, [scoredClients, searchTerm, ratingFilter, statusFilter]);

  // 3. KPIS EJECUTIVOS GLOBALES
  const summaryKpis = useMemo(() => {
    const totalClientes = scoredClients.length;
    const autorizados = scoredClients.filter(c => c.veredicto === 'AUTORIZADO');
    const observacion = scoredClients.filter(c => c.veredicto === 'APROBACION_GERENCIA');
    const bloqueados = scoredClients.filter(c => c.veredicto === 'BLOQUEADO');

    const scorePromedio = totalClientes > 0 
      ? Math.round(scoredClients.reduce((acc, c) => acc + c.creditScore, 0) / totalClientes) 
      : 0;

    const totalCarteraUsd = scoredClients.reduce((acc, c) => acc + c.saldoDeudorTotalUsd, 0);
    const totalLimiteOtorgadoUsd = scoredClients.reduce((acc, c) => acc + c.limiteCreditoUsd, 0);
    const utilizacionGlobalPct = totalLimiteOtorgadoUsd > 0 ? (totalCarteraUsd / totalLimiteOtorgadoUsd) * 100 : 0;

    return {
      totalClientes,
      countAutorizados: autorizados.length,
      countObservacion: observacion.length,
      countBloqueados: bloqueados.length,
      scorePromedio,
      totalCarteraUsd,
      totalLimiteOtorgadoUsd,
      utilizacionGlobalPct
    };
  }, [scoredClients]);

  // 4. SIMULACIÓN DE NUEVO PEDIDO PARA EL CLIENTE ACTIVO
  const simulationResult = useMemo(() => {
    if (!activeEvaluatedClient) return null;

    const montoPedido = Number(simulatedOrderAmountUsd) || 0;
    const saldoActual = activeEvaluatedClient.saldoDeudorTotalUsd;
    const limite = activeEvaluatedClient.limiteCreditoUsd;
    const nuevoSaldoProyectado = saldoActual + montoPedido;
    const nuevaUtilizacionPct = limite > 0 ? (nuevoSaldoProyectado / limite) * 100 : 0;
    const excesoUsd = Math.max(0, nuevoSaldoProyectado - limite);

    let estadoSimulado = 'AUTORIZADO';
    let mensajeSimulado = 'Pedido aprobado automáticamente dentro del cupo de crédito.';
    let colorSimulado = 'var(--semaforo-verde)';

    if (activeEvaluatedClient.maxDiasMora > 30) {
      estadoSimulado = 'DENEGADO_POR_MORA';
      mensajeSimulado = 'Rechazado: El cliente presenta facturas vencidas con más de 30 días de mora.';
      colorSimulado = 'var(--motorven-red)';
    } else if (excesoUsd > 0) {
      estadoSimulado = 'EXCEDE_LIMITE';
      mensajeSimulado = 'Excede el límite de crédito en ' + formatUsd(excesoUsd) + '. Requiere autorización de Finanzas o pago parcial.';
      colorSimulado = '#ea580c';
    } else if (activeEvaluatedClient.creditScore < 60) {
      estadoSimulado = 'REQUIERE_APROBACION';
      mensajeSimulado = 'Score de crédito en zona de observación (' + activeEvaluatedClient.creditScore + ' pts). Visto bueno de Gerencia requerido.';
      colorSimulado = 'var(--motorven-gold)';
    }

    return {
      montoPedido,
      saldoActual,
      nuevoSaldoProyectado,
      nuevaUtilizacionPct,
      excesoUsd,
      estadoSimulado,
      mensajeSimulado,
      colorSimulado
    };
  }, [activeEvaluatedClient, simulatedOrderAmountUsd]);

  const handleExportCsv = () => {
    let csv = '\uFEFF';
    csv += 'CODIGO;RAZON_SOCIAL;RIF;VENDEDOR;SCORE_CREDITO;RATING;VEREDICTO;DIAS_CREDITO;LIMITE_CREDITO_USD;SALDO_DEUDOR_USD;SALDO_VENCIDO_USD;MAX_DIAS_MORA;UTILIZACION_PCT;LIMITE_SUGERIDO_USD\n';

    scoredClients.forEach(c => {
      csv += '"' + c.coCli + '";"' + (c.nombre || '').replace(/"/g, '""') + '";"' + c.rif + '";"' + (c.vendedorAsignado || '') + '";' + c.creditScore + ';"' + c.rating + '";"' + c.textoVeredicto + '";' + c.diasCreditoAcordados + ';' + c.limiteCreditoUsd + ';' + c.saldoDeudorTotalUsd.toFixed(2) + ';' + c.totalSaldoVencidoUsd.toFixed(2) + ';' + c.maxDiasMora + ';' + c.utilizacionPct.toFixed(1) + ';' + c.limiteSugeridoUsd + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'SCORING_CREDITICIO_CLIENTES_' + (new Date().toISOString().slice(0, 10)) + '.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    generateAccountsReceivablePDF({
      receivables: activeEvaluatedClient ? [activeEvaluatedClient] : (scoredClients || []),
      clients,
      config: { ...config, tasaDolar: tasaBcv },
      currentUser
    });
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '96vw',
          maxWidth: '1380px',
          maxHeight: '94vh',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          background: 'var(--bg-card)',
          color: 'var(--text-main)',
          border: '1px solid var(--border-glass)',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.5)'
        }}
      >
        {/* 1. CABECERA PRINCIPAL */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #0284c7 0%, #002b7a 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(2, 132, 199, 0.35)'
              }}
            >
              <ShieldCheck size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                Score de Crédito Automático & Validación Pre-Despacho
                <span className="badge badge-primary" style={{ fontSize: '0.65rem' }}>
                  Gestión de Riesgo CxC
                </span>
              </h2>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Evaluación algorítmica de 614 clientes (0-100 pts), control de límites dinámicos y autorización de pedidos
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            {/* Selector de Pestañas */}
            <div style={{ display: 'flex', background: 'var(--bg-tertiary)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-glass)' }}>
              <button
                className="btn btn-sm"
                onClick={() => setActiveTab('ranking')}
                style={{
                  background: activeTab === 'ranking' ? 'var(--motorven-navy)' : 'transparent',
                  color: activeTab === 'ranking' ? '#fff' : 'var(--text-muted)',
                  fontSize: '0.75rem',
                  fontWeight: activeTab === 'ranking' ? 700 : 500,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <Layers size={14} /> Ranking Score ({scoredClients.length})
              </button>
              <button
                className="btn btn-sm"
                onClick={() => setActiveTab('evaluator')}
                style={{
                  background: activeTab === 'evaluator' ? 'var(--semaforo-verde)' : 'transparent',
                  color: activeTab === 'evaluator' ? '#fff' : 'var(--text-muted)',
                  fontSize: '0.75rem',
                  fontWeight: activeTab === 'evaluator' ? 700 : 500,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px'
                }}
              >
                <Sliders size={14} /> Validador de Pedido
              </button>
            </div>

            <button
              className="btn btn-secondary"
              onClick={handleExportCsv}
              style={{ fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              title="Exportar scoring a CSV"
            >
              <Download size={14} /> CSV
            </button>

            <button
              className="btn btn-print-report btn-sm"
              onClick={() => {
                setActiveTab('print');
                handlePrint();
              }}
              style={{ fontSize: '0.78rem' }}
            >
              <Printer size={14} color="#ffffff" /> Imprimir Reporte
            </button>

            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '6px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* 2. BARRA SUPERIOR DE 4 KPI METRIC CARDS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.85rem' }}>
          
          {/* KPI 1: Score Promedio Cartera */}
          <div className="bento-card" style={{ padding: '0.9rem 1.1rem', borderLeft: '4px solid #0284c7' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Score Promedio Cartera
              </span>
              <span className="badge badge-primary" style={{ fontSize: '0.62rem' }}>Salud Global</span>
            </div>
            <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.4rem', fontWeight: 900, color: '#0284c7', marginTop: '2px' }}>
              {summaryKpis.scorePromedio} / 100 pts
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {summaryKpis.countAutorizados} Clientes en banda verde (AAA/AA)
            </div>
          </div>

          {/* KPI 2: Clientes en Bloqueo */}
          <div className="bento-card" style={{ padding: '0.9rem 1.1rem', borderLeft: '4px solid var(--motorven-red)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Despachos Bloqueados
              </span>
              <span className="badge badge-danger" style={{ fontSize: '0.62rem' }}>Alto Riesgo</span>
            </div>
            <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.4rem', fontWeight: 900, color: 'var(--motorven-red)', marginTop: '2px' }}>
              {summaryKpis.countBloqueados} Clientes
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Mora severa o cupo excedido
            </div>
          </div>

          {/* KPI 3: Límite Total Otorgado */}
          <div className="bento-card" style={{ padding: '0.9rem 1.1rem', borderLeft: '4px solid var(--semaforo-verde)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Límite Crédito Total
              </span>
              <span className="badge badge-success" style={{ fontSize: '0.62rem' }}>Capacidad</span>
            </div>
            <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.4rem', fontWeight: 900, color: 'var(--semaforo-verde)', marginTop: '2px' }}>
              {formatUsd(summaryKpis.totalLimiteOtorgadoUsd)}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
              {formatBs(summaryKpis.totalLimiteOtorgadoUsd * tasaBcv)}
            </div>
          </div>

          {/* KPI 4: Utilización de Cartera */}
          <div className="bento-card" style={{ padding: '0.9rem 1.1rem', borderLeft: '4px solid var(--motorven-gold)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                Utilización de Crédito
              </span>
              <span className="badge badge-warning" style={{ fontSize: '0.62rem' }}>Exposición</span>
            </div>
            <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.4rem', fontWeight: 900, color: 'var(--motorven-gold)', marginTop: '2px' }}>
              {summaryKpis.utilizacionGlobalPct.toFixed(1)}%
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Deuda viva: {formatUsd(summaryKpis.totalCarteraUsd)}
            </div>
          </div>

        </div>

        {/* 3. CONTENIDO PRINCIPAL SEGÚN PESTAÑA */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          
          {/* TAB 1: RANKING Y MATRIZ DE SCORING */}
          {activeTab === 'ranking' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', height: '100%' }}>
              
              {/* Barra de Filtros */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.65rem' }}>
                <div style={{ position: 'relative', width: '280px' }}>
                  <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Buscar cliente, RIF o asesor..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ paddingLeft: '30px', fontSize: '0.78rem', height: '32px' }}
                  />
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <select
                    className="form-control"
                    value={ratingFilter}
                    onChange={(e) => setRatingFilter(e.target.value)}
                    style={{ width: '130px', fontSize: '0.78rem', height: '32px' }}
                  >
                    <option value="TODOS">Todos Ratings</option>
                    <option value="AAA">Rating AAA</option>
                    <option value="AA">Rating AA</option>
                    <option value="A">Rating A</option>
                    <option value="B">Rating B</option>
                    <option value="C">Rating C</option>
                  </select>

                  <select
                    className="form-control"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    style={{ width: '150px', fontSize: '0.78rem', height: '32px' }}
                  >
                    <option value="TODOS">Todos Estados</option>
                    <option value="AUTORIZADO">🟢 Autorizado</option>
                    <option value="APROBACION_GERENCIA">🟡 Aprobación</option>
                    <option value="BLOQUEADO">🔴 Bloqueado</option>
                  </select>
                </div>
              </div>

              {/* Tabla de Scoring */}
              <div className="table-container" style={{ flex: 1, overflowY: 'auto' }}>
                <table className="custom-table" style={{ fontSize: '0.8rem' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'center' }}>SCORE</th>
                      <th style={{ textAlign: 'center' }}>RATING</th>
                      <th>CLIENTE / RAZÓN SOCIAL</th>
                      <th>RIF</th>
                      <th style={{ textAlign: 'center' }}>PLAZO</th>
                      <th style={{ textAlign: 'right' }}>LÍMITE ($)</th>
                      <th style={{ textAlign: 'right' }}>SALDO DEUDOR</th>
                      <th style={{ textAlign: 'center' }}>USO CUPO</th>
                      <th style={{ textAlign: 'center' }}>MÁX MORA</th>
                      <th style={{ textAlign: 'center' }}>ESTADO DESPACHO</th>
                      <th style={{ textAlign: 'center' }}>ACCIONES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClients.length === 0 ? (
                      <tr>
                        <td colSpan="11" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                          No se encontraron clientes coincidentes con los filtros seleccionados.
                        </td>
                      </tr>
                    ) : (
                      filteredClients.map(client => (
                        <tr key={client.id} style={{ background: client.veredicto === 'BLOQUEADO' ? 'rgba(230, 0, 18, 0.04)' : undefined }}>
                          <td style={{ textAlign: 'center' }}>
                            <div style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 900,
                              fontFamily: 'var(--font-tech)',
                              fontSize: '0.95rem',
                              margin: '0 auto',
                              background: client.creditScore >= 80 ? 'rgba(16, 185, 129, 0.15)' : client.creditScore >= 60 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(230, 0, 18, 0.15)',
                              color: client.creditScore >= 80 ? 'var(--semaforo-verde)' : client.creditScore >= 60 ? 'var(--motorven-gold)' : 'var(--motorven-red)',
                              border: '1px solid ' + (client.creditScore >= 80 ? 'rgba(16, 185, 129, 0.4)' : client.creditScore >= 60 ? 'rgba(245, 158, 11, 0.4)' : 'rgba(230, 0, 18, 0.4)')
                            }}>
                              {client.creditScore}
                            </div>
                          </td>

                          <td style={{ textAlign: 'center' }}>
                            <span className={'badge ' + client.ratingBadgeClass} style={{ fontSize: '0.72rem', fontWeight: 800 }}>
                              {client.rating}
                            </span>
                          </td>

                          <td>
                            <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>
                              {client.nombre}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              Asesor: {client.vendedorAsignado || 'Principal'}
                            </div>
                          </td>

                          <td>
                            <code style={{ fontFamily: 'var(--font-code)', fontSize: '0.75rem' }}>{client.rif}</code>
                          </td>

                          <td style={{ textAlign: 'center', fontFamily: 'var(--font-code)' }}>
                            {client.diasCreditoAcordados}d
                          </td>

                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-tech)', fontWeight: 700 }}>
                            {formatUsd(client.limiteCreditoUsd)}
                          </td>

                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-tech)', fontWeight: 800, color: client.saldoDeudorTotalUsd > 0 ? 'var(--motorven-red)' : 'var(--semaforo-verde)' }}>
                            {formatUsd(client.saldoDeudorTotalUsd)}
                          </td>

                          <td style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.75rem', color: client.utilizacionPct > 90 ? 'var(--motorven-red)' : client.utilizacionPct > 60 ? 'var(--motorven-gold)' : 'var(--semaforo-verde)' }}>
                              {client.utilizacionPct.toFixed(0)}%
                            </div>
                            <div style={{ width: '50px', height: '4px', background: 'var(--bg-tertiary)', borderRadius: '2px', margin: '3px auto 0', overflow: 'hidden' }}>
                              <div style={{ width: Math.min(100, client.utilizacionPct) + '%', height: '100%', background: client.utilizacionPct > 90 ? 'var(--motorven-red)' : client.utilizacionPct > 60 ? 'var(--motorven-gold)' : 'var(--semaforo-verde)' }} />
                            </div>
                          </td>

                          <td style={{ textAlign: 'center' }}>
                            <span style={{ fontWeight: 700, fontFamily: 'var(--font-code)', color: client.maxDiasMora > 15 ? 'var(--motorven-red)' : client.maxDiasMora > 0 ? 'var(--motorven-gold)' : 'var(--semaforo-verde)' }}>
                              {client.maxDiasMora}d
                            </span>
                          </td>

                          <td style={{ textAlign: 'center' }}>
                            <span
                              className="badge"
                              style={{
                                background: client.colorVeredicto + '20',
                                color: client.colorVeredicto,
                                border: '1px solid ' + client.colorVeredicto + '40',
                                fontSize: '0.68rem',
                                fontWeight: 700
                              }}
                            >
                              {client.textoVeredicto}
                            </span>
                          </td>

                          <td style={{ textAlign: 'center' }}>
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={() => {
                                setSelectedClient(client);
                                setActiveTab('evaluator');
                              }}
                              style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                              title="Evaluar nuevo pedido para este cliente"
                            >
                              Evaluar
                            </button>
                          </td>

                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          )}

          {/* TAB 2: VALIDADOR DE PEDIDO PRE-DESPACHO */}
          {activeTab === 'evaluator' && activeEvaluatedClient && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: '1.25rem', height: '100%' }}>
              
              {/* Ficha Resumen del Cliente */}
              <div className="bento-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div className="bento-card-header">
                  <span className="bento-card-header-title">
                    <Building size={18} color="var(--motorven-navy-light)" />
                    Ficha Crediticia del Cliente
                  </span>
                  <span className={'badge ' + activeEvaluatedClient.ratingBadgeClass}>
                    Rating {activeEvaluatedClient.rating} ({activeEvaluatedClient.creditScore} pts)
                  </span>
                </div>

                <div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    {activeEvaluatedClient.nombre}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    RIF: {activeEvaluatedClient.rif} | Código: {activeEvaluatedClient.coCli} | Asesor: {activeEvaluatedClient.vendedorAsignado || 'Principal'}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                  <div style={{ background: 'var(--bg-tertiary)', padding: '0.75rem', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Límite Otorgado</div>
                    <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>
                      {formatUsd(activeEvaluatedClient.limiteCreditoUsd)}
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-tertiary)', padding: '0.75rem', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Saldo Deudor Actual</div>
                    <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.15rem', fontWeight: 800, color: activeEvaluatedClient.saldoDeudorTotalUsd > 0 ? 'var(--motorven-red)' : 'var(--semaforo-verde)' }}>
                      {formatUsd(activeEvaluatedClient.saldoDeudorTotalUsd)}
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-tertiary)', padding: '0.75rem', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Crédito Disponible</div>
                    <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.15rem', fontWeight: 800, color: 'var(--semaforo-verde)' }}>
                      {formatUsd(activeEvaluatedClient.creditoDisponibleUsd)}
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-tertiary)', padding: '0.75rem', borderRadius: '8px' }}>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Máxima Mora</div>
                    <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.15rem', fontWeight: 800, color: activeEvaluatedClient.maxDiasMora > 0 ? 'var(--motorven-red)' : 'var(--semaforo-verde)' }}>
                      {activeEvaluatedClient.maxDiasMora} Días
                    </div>
                  </div>
                </div>

                {/* Desglose de Factores */}
                <div style={{ background: 'var(--bg-tertiary)', padding: '0.85rem', borderRadius: '8px', fontSize: '0.75rem' }}>
                  <div style={{ fontWeight: 700, marginBottom: '6px', color: 'var(--text-main)' }}>Desglose de Scoring:</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <span>• Puntualidad y Mora:</span>
                    <strong>{activeEvaluatedClient.scoreMora} / 35 pts</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <span>• Utilización de Línea:</span>
                    <strong>{activeEvaluatedClient.scoreUtilizacion} / 25 pts</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <span>• Volumen y Recurrencia:</span>
                    <strong>{activeEvaluatedClient.scoreVolumen} / 20 pts</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                    <span>• Métodos de Pago:</span>
                    <strong>{activeEvaluatedClient.scoreMetodos} / 10 pts</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>• Perfil Fiscal y Jurídico:</span>
                    <strong>{activeEvaluatedClient.scoreFiscal} / 10 pts</strong>
                  </div>
                </div>

                <div>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setActiveTab('ranking')}
                    style={{ width: '100%', fontSize: '0.75rem' }}
                  >
                    ← Cambiar Cliente
                  </button>
                </div>
              </div>

              {/* Simulador de Validación de Nuevo Pedido */}
              <div className="bento-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div className="bento-card-header">
                  <span className="bento-card-header-title">
                    <Sliders size={18} color="var(--semaforo-verde)" />
                    Simulador de Autorización Pre-Despacho
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label className="form-label" style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                      Monto del Nuevo Pedido a Facturar ($ USD):
                    </label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="number"
                        className="form-control"
                        value={simulatedOrderAmountUsd}
                        onChange={(e) => setSimulatedOrderAmountUsd(parseFloat(e.target.value) || 0)}
                        style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'var(--font-tech)' }}
                      />
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        ~ {formatBs(simulatedOrderAmountUsd * tasaBcv)}
                      </span>
                    </div>
                  </div>

                  {/* Veredicto de la Simulación */}
                  {simulationResult && (
                    <div
                      style={{
                        background: simulationResult.colorSimulado + '15',
                        border: '2px solid ' + simulationResult.colorSimulado,
                        borderRadius: '12px',
                        padding: '1.15rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {simulationResult.estadoSimulado === 'AUTORIZADO' ? (
                          <CheckCircle2 size={24} color="var(--semaforo-verde)" />
                        ) : (
                          <AlertTriangle size={24} color={simulationResult.colorSimulado} />
                        )}
                        <span style={{ fontSize: '1.05rem', fontWeight: 900, color: simulationResult.colorSimulado, textTransform: 'uppercase' }}>
                          {simulationResult.estadoSimulado.replace(/_/g, ' ')}
                        </span>
                      </div>

                      <div style={{ fontSize: '0.82rem', color: 'var(--text-main)', fontWeight: 600 }}>
                        {simulationResult.mensajeSimulado}
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-glass)', fontSize: '0.75rem' }}>
                        <div>
                          <span style={{ color: 'var(--text-muted)', display: 'block' }}>Saldo Proyectado:</span>
                          <strong>{formatUsd(simulationResult.nuevoSaldoProyectado)}</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)', display: 'block' }}>Uso de Cupo:</span>
                          <strong>{simulationResult.nuevaUtilizacionPct.toFixed(0)}%</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-muted)', display: 'block' }}>Límite Sugerido:</span>
                          <strong style={{ color: 'var(--semaforo-verde)' }}>{formatUsd(activeEvaluatedClient.limiteSugeridoUsd)}</strong>
                        </div>
                      </div>
                    </div>
                  )}

                </div>

                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                  <button
                    className="btn btn-print-report"
                    onClick={() => {
                      handlePrint();
                      setActiveTab('print');
                    }}
                    style={{ flex: 1, fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <Printer size={15} color="#ffffff" /> Imprimir Reporte
                  </button>
                  {onSelectClientForSale && (
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        onSelectClientForSale(activeEvaluatedClient);
                        onClose();
                      }}
                      style={{ flex: 1, fontSize: '0.82rem', background: 'var(--semaforo-verde)', borderColor: 'var(--semaforo-verde)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                      <Check size={15} /> Facturar en POS
                    </button>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* TAB 3: FICHA FORMAL DE EVALUACIÓN DE CRÉDITO IMPRIMIBLE */}
          {activeTab === 'print' && activeEvaluatedClient && (
            <div style={{ background: '#ffffff', color: '#0f172a', padding: '2rem', borderRadius: '12px', border: '1px solid #cbd5e1', maxWidth: '1000px', margin: '0 auto' }}>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }} className="no-print">
                <button
                  className="btn btn-print-report"
                  onClick={handlePrint}
                >
                  <Printer size={16} color="#ffffff" /> Imprimir Reporte
                </button>
              </div>

              {/* Membrete Oficial */}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #002b7a', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 900, color: '#002b7a' }}>
                    {config.nombreEmpresa || 'SIGNUM MOTORVEN, C.A.'}
                  </h2>
                  <div style={{ fontSize: '0.82rem', color: '#475569', fontWeight: 600 }}>
                    RIF: {config.rif || 'J-30401927-4'} | DICTAMEN DE EVALUACIÓN CREDITICIA & LÍMITE DE RIESGO
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    {config.direccion || 'Zona Industrial III, Carrera 2 con Calle 4, Barquisimeto / Caracas - Venezuela'}
                  </div>
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>
                    DICTAMEN FINANCIERO
                  </div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#002b7a', fontFamily: 'monospace' }}>
                    SCORE-{activeEvaluatedClient.creditScore}/100
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#475569' }}>
                    Fecha: {new Date().toLocaleDateString('es-VE')}
                  </div>
                </div>
              </div>

              {/* Datos del Cliente */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', fontSize: '0.82rem' }}>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.7rem', textTransform: 'uppercase' }}>Razón Social:</span>
                  <strong style={{ color: '#0f172a', fontSize: '0.95rem' }}>{activeEvaluatedClient.nombre}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.7rem', textTransform: 'uppercase' }}>RIF / Identificación:</span>
                  <strong style={{ color: '#0f172a', fontSize: '0.95rem', fontFamily: 'monospace' }}>{activeEvaluatedClient.rif}</strong>
                </div>
                <div>
                  <span style={{ color: '#64748b', display: 'block', fontSize: '0.7rem', textTransform: 'uppercase' }}>Rating Asignado:</span>
                  <strong style={{ color: '#16a34a', fontSize: '1.1rem' }}>RATING {activeEvaluatedClient.rating}</strong>
                </div>
              </div>

              {/* Resumen de Métricas Financieras */}
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', marginBottom: '1.5rem' }}>
                <thead>
                  <tr style={{ background: '#002b7a', color: '#ffffff' }}>
                    <th style={{ padding: '8px 10px', textAlign: 'left' }}>PARÁMETRO DE RIESGO</th>
                    <th style={{ padding: '8px 10px', textAlign: 'center' }}>PUNTAJE OBTENIDO</th>
                    <th style={{ padding: '8px 10px', textAlign: 'right' }}>VALOR AUDITADO</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px 10px' }}>1. Historial de Pagos & Días de Mora Máxima</td>
                    <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>{activeEvaluatedClient.scoreMora} / 35 pts</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>{activeEvaluatedClient.maxDiasMora} días mora</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px 10px' }}>2. Porcentaje de Utilización de Límite Otorgado</td>
                    <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>{activeEvaluatedClient.scoreUtilizacion} / 25 pts</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>{activeEvaluatedClient.utilizacionPct.toFixed(1)}% uso</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px 10px' }}>3. Frecuencia y Volumen de Compra Histórico</td>
                    <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>{activeEvaluatedClient.scoreVolumen} / 20 pts</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>Cliente recurrente</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px 10px' }}>4. Confiabilidad de Instrumentos de Pago</td>
                    <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>{activeEvaluatedClient.scoreMetodos} / 10 pts</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>Divisas / Pagos verificados</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px 10px' }}>5. Perfil Jurídico y Fiscal SENIAT</td>
                    <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700 }}>{activeEvaluatedClient.scoreFiscal} / 10 pts</td>
                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>Formal / Contribuyente</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr style={{ background: '#f1f5f9', fontWeight: 900 }}>
                    <td style={{ padding: '10px' }}>SCORE TOTAL CONSOLIDADO:</td>
                    <td style={{ padding: '10px', textAlign: 'center', fontSize: '1rem', color: '#002b7a' }}>{activeEvaluatedClient.creditScore} / 100 PTS</td>
                    <td style={{ padding: '10px', textAlign: 'right', color: '#16a34a' }}>{activeEvaluatedClient.textoVeredicto}</td>
                  </tr>
                </tfoot>
              </table>

              {/* Recomendación y Límites */}
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '1rem', marginBottom: '2rem', fontSize: '0.82rem' }}>
                <div style={{ fontWeight: 700, color: '#166534', marginBottom: '4px' }}>DICTAMEN Y RECOMENDACIÓN TÉCNICA:</div>
                <div style={{ color: '#15803d' }}>
                  {activeEvaluatedClient.accionSugerida} Límite de crédito dinámico recomendado: <strong>${activeEvaluatedClient.limiteSugeridoUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD</strong> (Plazo sugerido: {activeEvaluatedClient.diasCreditoAcordados} días).
                </div>
              </div>

              {/* Firmas */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '3rem', marginTop: '3rem', paddingTop: '1rem' }}>
                <div style={{ textAlign: 'center', borderTop: '1px solid #94a3b8', paddingTop: '8px' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0f172a' }}>ANALISTA DE CRÉDITO Y COBRANZAS</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>SIGNUM MOTORVEN, C.A.</div>
                </div>

                <div style={{ textAlign: 'center', borderTop: '1px solid #94a3b8', paddingTop: '8px' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#0f172a' }}>GERENCIA DE ADMINISTRACIÓN Y FINANZAS</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b' }}>SIGNUM MOTORVEN, C.A.</div>
                </div>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
}
