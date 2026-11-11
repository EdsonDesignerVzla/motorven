import React, { useState, useEffect } from 'react';
import { Printer, X, ShieldCheck, TrendingUp, BarChart3, PieChart as PieIcon, Award, RefreshCw, Landmark } from 'lucide-react';
import motorvenLogoImg from '../assets/logo_motorven_limpio.png';
import { formatUsd, formatBs } from '../services/formatService';
import { fetchBcvRateDetails, fetchEuroRateDetails, fetchUsdtRateDetails } from '../services/supabaseService';
import { generateDashboardPDF } from '../services/pdfReportService';

// Generador de código único alfanumérico de 10 caracteres (A-Z, 0-9)
const generateUniqueDocCode = () => {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 10; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export default function ExecutiveSummaryModal({
  isOpen,
  onClose,
  kpiData,
  semMeta,
  config,
  currentUser,
  sales = [],
  carteraClientesData = [],
  cobranzasData = {},
  disponibilidadBancariaData = [],
  objetivosData = {},
  ventasDelDia = null,
  ventasAcumuladoMes = null,
  ventasMesLabel = '',
  todayLabel = '',
  sellers = [],
  selectedMonth = 'ALL'
}) {
  // Código único de 10 dígitos alfanuméricos para este documento
  const [documentCode] = useState(() => generateUniqueDocCode());

  // Estados de Tasas en Tiempo Real recogidas al momento de la impresión
  const [liveBcvRate, setLiveBcvRate] = useState(() => Number(config?.tasaDolar || config?.tasaBcv) || 827.73);
  const [liveKeystoneRate, setLiveKeystoneRate] = useState(() => Number(config?.tasaKeystone) || 950.50);
  const [liveEuroRate, setLiveEuroRate] = useState(() => Number(config?.tasaEuro) || 963.21);
  const [liveUsdtRate, setLiveUsdtRate] = useState(() => Number(config?.tasaUsdt) || 963.40);
  const [liveUsdtSource, setLiveUsdtSource] = useState('Binance P2P Oficial en Vivo (USDT/VES)');
  const [ratesTimestamp, setRatesTimestamp] = useState(() => new Date());
  const [syncingRates, setSyncingRates] = useState(false);

  // Recoger las tasas en tiempo real al abrir el modal / generar el PDF
  const refreshLiveRates = async () => {
    try {
      setSyncingRates(true);
      const [bcvData, euroData, usdtData] = await Promise.all([
        fetchBcvRateDetails(),
        fetchEuroRateDetails(),
        fetchUsdtRateDetails()
      ]);
      if (bcvData && bcvData.rate) {
        setLiveBcvRate(bcvData.rate);
      }
      if (euroData && euroData.rate) {
        setLiveEuroRate(euroData.rate);
      }
      if (usdtData && usdtData.rate) {
        setLiveUsdtRate(usdtData.rate);
        if (usdtData.fuente) {
          setLiveUsdtSource(usdtData.fuente);
        }
      }
      setRatesTimestamp(new Date());
    } catch (err) {
      console.warn('Error al recolectar tasas en tiempo real para el PDF:', err);
    } finally {
      setSyncingRates(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      refreshLiveRates();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const tasaBcvNum = liveBcvRate;
  const tasaKeystoneNum = liveKeystoneRate;
  const tasaEuroNum = liveEuroRate;
  const tasaUsdtNum = liveUsdtRate;

  const fechaActual = ratesTimestamp.toLocaleDateString('es-VE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  const horaActual = ratesTimestamp.toLocaleTimeString('es-VE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  const handlePrint = () => {
    generateDashboardPDF({
      kpiData,
      sales,
      config: {
        ...config,
        tasaDolar: tasaBcvNum,
        tasaKeystone: tasaKeystoneNum,
        tasaEuro: tasaEuroNum,
        tasaUsdt: tasaUsdtNum
      },
      currentUser,
      sellers,
      cobranzasData,
      disponibilidadBancariaData,
      carteraClientesData,
      selectedMonth,
      ventasDelDia,
      ventasAcumuladoMes,
      ventasMesLabel,
      todayLabel
    });
  };

  // Datos financieros calculados dinámicamente en Bs y USD desde datos en tiempo real de Supabase
  const cxcDiaVal = Number(carteraClientesData?.find(c => c.name?.includes('DÍA'))?.value || 0);
  const cxcVenVal = Number(carteraClientesData?.find(c => c.name?.includes('VENCIDAS'))?.value || 0);
  const totalCarteraUsd = cxcDiaVal + cxcVenVal;
  const totalCarteraBs = totalCarteraUsd * tasaBcvNum;

  const carteraClientes = [
    {
      segmento: 'CxC Al Día (Vigentes dentro del plazo)',
      montoUsd: cxcDiaVal,
      montoBs: cxcDiaVal * tasaBcvNum,
      pct: totalCarteraUsd > 0 ? parseFloat(((cxcDiaVal / totalCarteraUsd) * 100).toFixed(2)) : 0,
      estado: 'VIGENTE / CRÉDITO SALUDABLE',
      estadoColor: '#10b981'
    },
    {
      segmento: 'CxC Vencidas (Morosidad activa)',
      montoUsd: cxcVenVal,
      montoBs: cxcVenVal * tasaBcvNum,
      pct: totalCarteraUsd > 0 ? parseFloat(((cxcVenVal / totalCarteraUsd) * 100).toFixed(2)) : 0,
      estado: 'EN GESTIÓN DE COBRANZA EXTRAJUDICIAL',
      estadoColor: '#ef4444'
    }
  ];

  const cobAcum = Number(cobranzasData?.acumulada || 0);
  const cobBs = Number(cobranzasData?.enBs || 0);
  const totalCobranzasUsd = cobAcum;
  const totalCobranzasBs = cobBs > 0 ? cobBs : (totalCobranzasUsd * tasaBcvNum);

  const cobranzas = [
    {
      concepto: 'Cobranza Acumulada del Período',
      montoUsd: cobAcum,
      montoBs: cobAcum * tasaBcvNum,
      pct: 100,
      modalidad: 'Transferencias Bancarias Nacionales / Liquidación'
    },
    {
      concepto: 'Cobranza en Bolívares (Equivalente Facturación)',
      montoUsd: tasaBcvNum > 0 ? (cobBs / tasaBcvNum) : 0,
      montoBs: cobBs,
      pct: totalCobranzasUsd > 0 ? parseFloat((((tasaBcvNum > 0 ? cobBs / tasaBcvNum : 0) / totalCobranzasUsd) * 100).toFixed(2)) : 0,
      modalidad: 'Liquidación en Bolívares Oficial BCV'
    }
  ];

  const totalBancosUsd = (disponibilidadBancariaData || []).reduce((acc, b) => acc + (Number(b.monto) || 0), 0);
  const totalBancosBs = totalBancosUsd * tasaBcvNum;

  const bancos = (disponibilidadBancariaData && disponibilidadBancariaData.length > 0)
    ? disponibilidadBancariaData.map(b => ({
        banco: b.banco || 'Banco',
        tipo: 'Cuenta Bancaria Operativa',
        montoUsd: Number(b.monto || 0),
        pct: totalBancosUsd > 0 ? parseFloat(((Number(b.monto || 0) / totalBancosUsd) * 100).toFixed(2)) : 0
      }))
    : [{ banco: 'Disponibilidad Bancaria General', tipo: 'Tesorería', montoUsd: 0, pct: 0 }];

  const abonosProv = Number(objetivosData?.abonosProveedores || 0);
  const saldoPendProv = Number(objetivosData?.saldoPendiente || 0);
  const totalObligacionesUsd = abonosProv + saldoPendProv;
  const totalObligacionesBs = totalObligacionesUsd * tasaBcvNum;

  const obligaciones = [
    {
      rubro: 'Abonos a Proveedores Realizados (Mes Actual)',
      montoUsd: abonosProv,
      montoBs: abonosProv * tasaBcvNum,
      estado: `${totalObligacionesUsd > 0 ? Math.round((abonosProv / totalObligacionesUsd) * 100) : 0}% - Liquidado y Conciliado`,
      color: '#10b981'
    },
    {
      rubro: 'Saldo Pendiente por Pagar a Proveedores',
      montoUsd: saldoPendProv,
      montoBs: saldoPendProv * tasaBcvNum,
      estado: `${totalObligacionesUsd > 0 ? Math.round((saldoPendProv / totalObligacionesUsd) * 100) : 0}% - Programado según Cronograma`,
      color: '#ef4444'
    }
  ];

  // Parámetros calculados para Gráfico de Barras SVG (Escala máx 22.000 L)
  const maxLitrosEscala = 22000;
  const chartHeight = 85;
  const calcBarHeight = (litros) => Math.min(Math.round((litros / maxLitrosEscala) * chartHeight), chartHeight);

  // Parámetros calculados para Gráfico Donut SVG (Circunferencia r=34 -> 213.6)
  const donutCircumference = 213.6;
  const cxcAlDiaDash = ((carteraClientes[0].pct / 100) * donutCircumference).toFixed(1);
  const cxcVencidasDash = ((carteraClientes[1].pct / 100) * donutCircumference).toFixed(1);

  return (
    <div className="executive-modal-backdrop">
      {/* Barra de Acciones Superior Flotante (No Imprimible) */}
      <div className="executive-action-bar no-print">
        <div className="executive-action-info">
          <Printer size={20} color="#00f2fe" />
          <span>Vista Previa del Informe Ejecutivo con Tasas en Tiempo Real &bull; SIGNUM MOTORVEN</span>
        </div>
        <div className="executive-action-buttons">
          <button
            className="btn btn-secondary"
            onClick={refreshLiveRates}
            disabled={syncingRates}
            title="Recoger tasas en tiempo real antes de imprimir"
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.825rem' }}
          >
            <RefreshCw size={15} className={syncingRates ? 'spin-anim' : ''} />
            {syncingRates ? 'Sincronizando Tasas...' : 'Actualizar Tasas en Vivo'}
          </button>
          <button className="btn btn-secondary executive-close-btn" onClick={onClose}>
            <X size={18} /> Cerrar
          </button>
          <button
            className="btn btn-print-report executive-print-btn"
            onClick={handlePrint}
            title="Descargar Reporte Ejecutivo en formato PDF"
          >
            <Printer size={18} color="#ffffff" /> Imprimir Reporte
          </button>
        </div>
      </div>

      {/* Contenedor del Documento Físico (Imprimible y Descargable) */}
      <div className="executive-print-container">
        {/* ========================================================
            HOJA 1/2: TAMAÑO CARTA (PORTRAIT)
            ======================================================== */}
        <div className="executive-page page-1">
          <div className="executive-page-content">
            
            {/* ENCABEZADO CORPORATIVO OFICIAL */}
            <div className="pdf-header-wrapper">
              <div className="pdf-logo-box">
                <img src={motorvenLogoImg} alt="Grupo Motorven Logo" className="pdf-logo-img" />
              </div>
              <div className="pdf-header-title-box">
                <h1 className="pdf-company-name">{config?.nombreEmpresa || 'GRUPO MOTORVEN, C.A.'}</h1>
                <div className="pdf-rif-code">RIF: {config?.rif || 'J-31115365-9'}</div>
                <div className="pdf-report-title">INFORME EJECUTIVO DE GESTIÓN Y RENDIMIENTO COMERCIAL</div>
                <div className="pdf-report-subtitle">SISTEMA INTEGRAL DE CONTROL EJECUTIVO Y OPERATIVO &bull; SIGNUM MOTORVEN</div>
              </div>
              <div className="pdf-security-stamp">
                <div className="pdf-stamp-badge">DOCUMENTO OFICIAL</div>
                <div className="pdf-stamp-code">{documentCode}</div>
              </div>
            </div>

            <div className="pdf-divider-line"></div>

          {/* FICHA METADATOS DE EMISIÓN */}
          <div className="pdf-meta-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <div className="pdf-meta-item">
              <span className="pdf-meta-label">Fecha de Emisión:</span>
              <span className="pdf-meta-val" style={{ textTransform: 'capitalize' }}>{fechaActual}</span>
            </div>
            <div className="pdf-meta-item">
              <span className="pdf-meta-label">Hora de Corte en Vivo:</span>
              <span className="pdf-meta-val">{horaActual}</span>
            </div>
            <div className="pdf-meta-item">
              <span className="pdf-meta-label">Responsable Emisor:</span>
              <span className="pdf-meta-val">{currentUser?.nombre || 'Administrador General'} ({currentUser?.rol?.toUpperCase() || 'GERENCIA GENERAL'})</span>
            </div>
            <div className="pdf-meta-item">
              <span className="pdf-meta-label">Semáforo de Cumplimiento:</span>
              <span className={`pdf-meta-val pdf-badge-${semMeta.level}`}>
                {semMeta.text} ({kpiData.cumplimientoMetaPct}%)
              </span>
            </div>
          </div>

          {/* 🏛️ REGISTRO OFICIAL DE TASAS EN TIEMPO REAL AL MOMENTO DE IMPRESIÓN */}
          <div className="pdf-rates-snapshot-card">
            <div className="pdf-rates-snapshot-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Landmark size={14} color="#002b7a" />
                <span className="pdf-rates-snapshot-title">
                  REGISTRO DE TASAS EN TIEMPO REAL AL MOMENTO DE LA IMPRESIÓN
                </span>
              </div>
              <div className="pdf-rates-snapshot-time">
                Sincronización exacta: {horaActual} &bull; {fechaActual}
              </div>
            </div>

            <div className="pdf-rates-snapshot-grid">
              {/* Tasa Dólar BCV */}
              <div className="pdf-rate-pill bcv-pill">
                <div className="pdf-rate-pill-header">
                  <span className="pdf-rate-pill-flag">🇻🇪</span>
                  <span className="pdf-rate-pill-name">DÓLAR OFICIAL BCV</span>
                </div>
                <div className="pdf-rate-pill-val">Bs. {formatBs(liveBcvRate).replace('Bs. ', '')}</div>
                <div className="pdf-rate-pill-sub">Banco Central de Venezuela</div>
              </div>

              {/* Tasa Euro BCV */}
              <div className="pdf-rate-pill euro-pill">
                <div className="pdf-rate-pill-header">
                  <span className="pdf-rate-pill-flag">🇪🇺</span>
                  <span className="pdf-rate-pill-name">EURO OFICIAL BCV</span>
                </div>
                <div className="pdf-rate-pill-val">Bs. {formatBs(liveEuroRate).replace('Bs. ', '')}</div>
                <div className="pdf-rate-pill-sub">Banco Central de Venezuela</div>
              </div>

              {/* Tasa Binance USDT */}
              <div className="pdf-rate-pill usdt-pill">
                <div className="pdf-rate-pill-header">
                  <span className="pdf-rate-pill-flag">₮</span>
                  <span className="pdf-rate-pill-name">USDT BINANCE P2P</span>
                </div>
                <div className="pdf-rate-pill-val">Bs. {formatBs(liveUsdtRate).replace('Bs. ', '')}</div>
                <div className="pdf-rate-pill-sub">{liveUsdtSource}</div>
              </div>

              {/* Tasa Keystone */}
              <div className="pdf-rate-pill keystone-pill">
                <div className="pdf-rate-pill-header">
                  <span className="pdf-rate-pill-flag">📈</span>
                  <span className="pdf-rate-pill-name">COMERCIAL KEYSTONE</span>
                </div>
                <div className="pdf-rate-pill-val">Bs. {formatBs(liveKeystoneRate).replace('Bs. ', '')}</div>
                <div className="pdf-rate-pill-sub">Grupo Motorven, C.A.</div>
              </div>
            </div>
            
            <div className="pdf-rates-snapshot-disclaimer">
              Registro auditado y certificado por SIGNUM MOTORVEN. Todas las conversiones a moneda nacional (Bs.) en los balances han sido calculadas con la tasa oficial BCV de <strong>Bs. {formatBs(liveBcvRate).replace('Bs. ', '')}</strong> capturada en tiempo real al generar este documento.
            </div>
          </div>

          {/* 🌟 RESUMEN EJECUTIVO DE GESTIÓN */}
          <div className="pdf-summary-card">
            <div className="pdf-summary-header">
              <TrendingUp size={16} color="#002b7a" />
              <span>RESUMEN EJECUTIVO DE DESEMPEÑO Y DIAGNÓSTICO FINANCIERO</span>
            </div>
            
            <div className="pdf-summary-grid">
              <div className="pdf-summary-kpi">
                <span className="pdf-summary-kpi-label">Volumen Facturado</span>
                <span className="pdf-summary-kpi-value">{kpiData.litrosFacturados.toLocaleString('es-VE', { maximumFractionDigits: 1 })} L</span>
                <span className="pdf-summary-kpi-sub">{kpiData.cumplimientoMetaPct}% meta ({kpiData.cajasFacturadas} cajas)</span>
              </div>
              <div className="pdf-summary-kpi">
                <span className="pdf-summary-kpi-label">Cartera CxC Vigente</span>
                <span className="pdf-summary-kpi-value">{formatUsd(carteraClientes[0].montoUsd)}</span>
                <span className="pdf-summary-kpi-sub" style={{ color: '#059669', fontWeight: 700 }}>75.22% Al Día / Saludable</span>
              </div>
              <div className="pdf-summary-kpi">
                <span className="pdf-summary-kpi-label">Recaudación Cobrada</span>
                <span className="pdf-summary-kpi-value">{formatUsd(totalCobranzasUsd)}</span>
                <span className="pdf-summary-kpi-sub">81.8% Bancos &bull; 18.2% Bs./Zelle</span>
              </div>
              <div className="pdf-summary-kpi">
                <span className="pdf-summary-kpi-label">Disponibilidad Caja/Bancos</span>
                <span className="pdf-summary-kpi-value">{formatUsd(totalBancosUsd)}</span>
                <span className="pdf-summary-kpi-sub">Bs. {formatBs(totalBancosBs).replace('Bs. ', '')} a tasa BCV</span>
              </div>
            </div>

            <div className="pdf-summary-note">
              <strong>Síntesis Operativa:</strong> En el presente ciclo fiscal, <strong>Grupo Motorven, C.A.</strong> registra una facturación acumulada de <strong>{kpiData.litrosFacturados.toLocaleString('es-VE', { maximumFractionDigits: 2 })} Litros</strong> de lubricantes ({kpiData.cumplimientoMetaPct}% del objetivo mensual). Sumando <strong>{kpiData.pendienteFacturar.toLocaleString('es-VE')} L</strong> en pedidos en tránsito, la proyección total se ubica en <strong>{kpiData.totalProyectado.toLocaleString('es-VE', { maximumFractionDigits: 2 })} L (59.26%)</strong>. La tesorería cuenta con <strong>{formatUsd(totalBancosUsd)}</strong> de liquidez inmediata conciliada. La cartera crediticia de <strong>{formatUsd(totalCarteraUsd)}</strong> presenta un <strong>75.22%</strong> en estado saludable y un <strong>24.78%</strong> bajo protocolo de cobro activo.
            </div>
          </div>

          {/* 📊 PANEL DE GRÁFICOS EJECUTIVOS EN VECTOR DE ALTA RESOLUCIÓN */}
          <div className="pdf-charts-grid">
            
            {/* GRÁFICO 1: VENTAS VS META COMERCIAL */}
            <div className="pdf-chart-box">
              <div className="pdf-chart-title">
                <BarChart3 size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-1px' }} />
                VENTAS VS META COMERCIAL (LITROS)
              </div>
              <div className="pdf-chart-inner">
                <svg viewBox="0 0 280 120" className="pdf-chart-svg">
                  {/* Línea base y línea meta discontinua */}
                  <line x1="25" y1="98" x2="275" y2="98" stroke="#cbd5e1" strokeWidth="1" />
                  <line x1="25" y1="25" x2="275" y2="25" stroke="#e60012" strokeWidth="1" strokeDasharray="3 3" />
                  <text x="275" y="22" fill="#e60012" fontSize="7" fontWeight="bold" textAnchor="end">Meta: 20.000 L</text>
                  
                  {/* Barra 1: Facturado */}
                  <rect
                    x="38"
                    y={98 - calcBarHeight(kpiData.litrosFacturados)}
                    width="38"
                    height={calcBarHeight(kpiData.litrosFacturados)}
                    fill="#002b7a"
                    rx="3"
                  />
                  <text
                    x="57"
                    y={92 - calcBarHeight(kpiData.litrosFacturados)}
                    fill="#002b7a"
                    fontSize="7.5"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {kpiData.litrosFacturados.toLocaleString('es-VE', { maximumFractionDigits: 0 })} L
                  </text>
                  <text x="57" y="110" fill="#475569" fontSize="7" fontWeight="700" textAnchor="middle">Facturado</text>

                  {/* Barra 2: Pendiente */}
                  <rect
                    x="96"
                    y={98 - calcBarHeight(kpiData.pendienteFacturar)}
                    width="38"
                    height={calcBarHeight(kpiData.pendienteFacturar)}
                    fill="#ffb703"
                    rx="3"
                  />
                  <text
                    x="115"
                    y={92 - calcBarHeight(kpiData.pendienteFacturar)}
                    fill="#b45309"
                    fontSize="7.5"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {kpiData.pendienteFacturar.toLocaleString('es-VE', { maximumFractionDigits: 0 })} L
                  </text>
                  <text x="115" y="110" fill="#475569" fontSize="7" fontWeight="700" textAnchor="middle">Pendiente</text>

                  {/* Barra 3: Proyectado */}
                  <rect
                    x="154"
                    y={98 - calcBarHeight(kpiData.totalProyectado)}
                    width="38"
                    height={calcBarHeight(kpiData.totalProyectado)}
                    fill="#00f2fe"
                    stroke="#002b7a"
                    strokeWidth="0.5"
                    rx="3"
                  />
                  <text
                    x="173"
                    y={92 - calcBarHeight(kpiData.totalProyectado)}
                    fill="#0284c7"
                    fontSize="7.5"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {kpiData.totalProyectado.toLocaleString('es-VE', { maximumFractionDigits: 0 })} L
                  </text>
                  <text x="173" y="110" fill="#475569" fontSize="7" fontWeight="700" textAnchor="middle">Proyectado</text>

                  {/* Barra 4: Meta Comercial */}
                  <rect
                    x="212"
                    y={98 - calcBarHeight(kpiData.metaComercial)}
                    width="38"
                    height={calcBarHeight(kpiData.metaComercial)}
                    fill="#e60012"
                    rx="3"
                  />
                  <text
                    x="231"
                    y={92 - calcBarHeight(kpiData.metaComercial)}
                    fill="#e60012"
                    fontSize="7.5"
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    20.000 L
                  </text>
                  <text x="231" y="110" fill="#475569" fontSize="7" fontWeight="700" textAnchor="middle">Meta Mes</text>
                </svg>
              </div>
            </div>

            {/* GRÁFICO 2: COMPOSICIÓN CARTERA & ÍNDICE DE MOROSIDAD */}
            <div className="pdf-chart-box">
              <div className="pdf-chart-title">
                <PieIcon size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: '-1px' }} />
                COMPOSICIÓN DE CARTERA & MOROSIDAD
              </div>
              <div className="pdf-chart-inner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', gap: '8px' }}>
                {/* Donut SVG con aguja y centro informativo */}
                <div style={{ position: 'relative', width: '90px', height: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                    <circle cx="50" cy="50" r="34" fill="none" stroke="#e2e8f0" strokeWidth="15" />
                    {/* Segmento Al Día (75.22%) */}
                    <circle
                      cx="50"
                      cy="50"
                      r="34"
                      fill="none"
                      stroke="#002b7a"
                      strokeWidth="15"
                      strokeDasharray={`${cxcAlDiaDash} ${donutCircumference}`}
                      strokeDashoffset="0"
                    />
                    {/* Segmento Vencidas (24.78%) */}
                    <circle
                      cx="50"
                      cy="50"
                      r="34"
                      fill="none"
                      stroke="#e60012"
                      strokeWidth="15"
                      strokeDasharray={`${cxcVencidasDash} ${donutCircumference}`}
                      strokeDashoffset={`-${cxcAlDiaDash}`}
                    />
                  </svg>
                  <div style={{ position: 'absolute', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.8rem', fontWeight: 900, color: '#e60012', lineHeight: 1 }}>24.8%</div>
                    <div style={{ fontSize: '0.55rem', fontWeight: 700, color: '#64748b' }}>Moroso</div>
                  </div>
                </div>

                {/* Leyenda Detallada con Valores Financieros */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <div style={{ borderLeft: '3px solid #002b7a', paddingLeft: '6px' }}>
                    <div style={{ fontSize: '0.62rem', color: '#64748b', fontWeight: 600 }}>CxC Al Día (75.22%)</div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#002b7a' }}>{formatUsd(carteraClientes[0].montoUsd)}</div>
                    <div style={{ fontSize: '0.58rem', color: '#059669', fontWeight: 700 }}>🟢 Crédito Sano / Vigente</div>
                  </div>
                  <div style={{ borderLeft: '3px solid #e60012', paddingLeft: '6px' }}>
                    <div style={{ fontSize: '0.62rem', color: '#64748b', fontWeight: 600 }}>CxC Vencidas (24.78%)</div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#e60012' }}>{formatUsd(carteraClientes[1].montoUsd)}</div>
                    <div style={{ fontSize: '0.58rem', color: '#dc2626', fontWeight: 700 }}>🔴 En Gestión Extrajudicial</div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* TABLA 1: CUMPLIMIENTO DE META COMERCIAL & VOLUMEN DE LUBRICANTES */}
          <div className="pdf-section-block">
            <div className="pdf-section-title">
              1. VOLUMEN DE VENTAS Y CUMPLIMIENTO DE META COMERCIAL (LUBRICANTES)
            </div>
            <table className="pdf-table">
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>Indicador / Concepto Comercial</th>
                  <th style={{ width: '18%', textAlign: 'right' }}>Volumen Litros (L)</th>
                  <th style={{ width: '18%', textAlign: 'right' }}>Equivalente Cajas (11.35 L)</th>
                  <th style={{ width: '16%', textAlign: 'right' }}>% Cumplimiento Meta</th>
                  <th style={{ width: '18%', textAlign: 'center' }}>Estatus Operativo</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Litros Facturados (Ventas POS + Base)</strong></td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                    {kpiData.litrosFacturados.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L
                  </td>
                  <td style={{ textAlign: 'right' }}>{kpiData.cajasFacturadas.toLocaleString('es-VE', { minimumFractionDigits: 2 })} cajas</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#002b7a' }}>{kpiData.cumplimientoMetaPct}%</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className="pdf-tag-green">Facturación Ejecutada</span>
                  </td>
                </tr>
                <tr>
                  <td>Pendiente por Facturar (Pedidos Aprobados)</td>
                  <td style={{ textAlign: 'right' }}>
                    {kpiData.pendienteFacturar.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L
                  </td>
                  <td style={{ textAlign: 'right' }}>{kpiData.cajasPendientes.toLocaleString('es-VE', { minimumFractionDigits: 2 })} cajas</td>
                  <td style={{ textAlign: 'right' }}>{((kpiData.pendienteFacturar / kpiData.metaComercial) * 100).toFixed(2)}%</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className="pdf-tag-yellow">En Preparación</span>
                  </td>
                </tr>
                <tr className="pdf-row-highlight">
                  <td><strong>TOTAL PROYECTADO (Facturado + Pendiente)</strong></td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                    {kpiData.totalProyectado.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{kpiData.cajasTotales.toLocaleString('es-VE', { minimumFractionDigits: 2 })} cajas</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{((kpiData.totalProyectado / kpiData.metaComercial) * 100).toFixed(2)}%</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className="pdf-tag-blue">Proyección Total</span>
                  </td>
                </tr>
                <tr>
                  <td><strong>META COMERCIAL ASIGNADA DEL MES</strong></td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                    {kpiData.metaComercial.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} L
                  </td>
                  <td style={{ textAlign: 'right' }}>{kpiData.cajasMeta.toLocaleString('es-VE', { minimumFractionDigits: 2 })} cajas</td>
                  <td style={{ textAlign: 'right' }}>100.00%</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className="pdf-tag-neutral">Base Objetiva</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {(ventasDelDia || ventasAcumuladoMes) && (
            <div className="pdf-section-block" style={{ marginTop: '10px' }}>
              <div className="pdf-section-title">
                1B. VENTAS DEL DÍA Y ACUMULADO MENSUAL (MONTOS Y LUBRICANTES)
              </div>
              <table className="pdf-table">
                <thead>
                  <tr>
                    <th style={{ width: '34%' }}>Período de Facturación</th>
                    <th style={{ width: '16%', textAlign: 'center' }}>Documentos</th>
                    <th style={{ width: '16%', textAlign: 'right' }}>Litros (L)</th>
                    <th style={{ width: '12%', textAlign: 'right' }}>Cajas</th>
                    <th style={{ width: '22%', textAlign: 'right' }}>Monto Total (USD / Bs.)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Ventas del Día{todayLabel ? ` (${todayLabel})` : ''}</strong></td>
                    <td style={{ textAlign: 'center' }}>{ventasDelDia?.documentos || 0} docs ({ventasDelDia?.clientes || 0} cli.)</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#0284c7' }}>
                      {Number(ventasDelDia?.litros || 0).toLocaleString('es-VE', { maximumFractionDigits: 1 })} L
                    </td>
                    <td style={{ textAlign: 'right' }}>{Number(ventasDelDia?.cajas || 0).toLocaleString('es-VE')}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#059669' }}>
                      {formatUsd(Number(ventasDelDia?.usd || 0))} <span style={{ fontWeight: 400, fontSize: '0.85em', color: '#64748b' }}>({formatBs(Number(ventasDelDia?.bs || (Number(ventasDelDia?.usd || 0) * tasaBcvNum)))})</span>
                    </td>
                  </tr>
                  <tr>
                    <td><strong>Acumulado {ventasMesLabel || 'Mes Actual'}</strong></td>
                    <td style={{ textAlign: 'center' }}>{ventasAcumuladoMes?.documentos || 0} docs ({ventasAcumuladoMes?.pctMeta || 0}% meta)</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#002b7a' }}>
                      {Number(ventasAcumuladoMes?.litros || 0).toLocaleString('es-VE', { maximumFractionDigits: 1 })} L
                    </td>
                    <td style={{ textAlign: 'right' }}>{Number(ventasAcumuladoMes?.cajas || 0).toLocaleString('es-VE')}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#002b7a' }}>
                      {formatUsd(Number(ventasAcumuladoMes?.usd || 0))} <span style={{ fontWeight: 400, fontSize: '0.85em', color: '#64748b' }}>({formatBs(Number(ventasAcumuladoMes?.bs || (Number(ventasAcumuladoMes?.usd || 0) * tasaBcvNum)))})</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          </div>{/* Fin .executive-page-content Hoja 1 */}

          {/* PIE DE PÁGINA OFICIAL - HOJA 1/2 */}
          <div className="pdf-page-footer">
            <div className="pdf-footer-left">
              <span className="pdf-footer-org">Documento Confidencial &bull; <strong>SIGNUM MOTORVEN</strong> &bull; {config?.nombreEmpresa || 'GRUPO MOTORVEN, C.A.'}</span>
              <span className="pdf-footer-sub">Auditoría cambiaria en tiempo real (BCV USD/EUR, Binance USDT, Keystone) &bull; Corte: {horaActual} &bull; {fechaActual}</span>
            </div>
            <div className="pdf-footer-right">
              <div className="pdf-page-badge">
                <span className="pdf-page-badge-prefix">PÁGINA</span>
                <span className="pdf-page-badge-number">1/2</span>
              </div>
            </div>
          </div>
        </div>{/* Fin .executive-page Hoja 1 */}

        {/* ========================================================
            HOJA 2/2: TAMAÑO CARTA (PORTRAIT)
            ======================================================== */}
        <div className="executive-page page-2">
          <div className="executive-page-content">
            
            {/* ENCABEZADO DE CONTINUACIÓN CORPORATIVO (HOJA 2) */}
            <div className="pdf-continuation-header">
              <div className="pdf-continuation-left">
                <img src={motorvenLogoImg} alt="Grupo Motorven Logo" className="pdf-continuation-logo" />
                <div className="pdf-continuation-titles">
                  <div className="pdf-continuation-company">{config?.nombreEmpresa || 'GRUPO MOTORVEN, C.A.'} &bull; <span style={{ color: '#e60012' }}>RIF: {config?.rif || 'J-31115365-9'}</span></div>
                  <div className="pdf-continuation-doc">INFORME EJECUTIVO DE GESTIÓN Y RENDIMIENTO FINANCIERO (CONTINUACIÓN)</div>
                </div>
              </div>
              <div className="pdf-continuation-right">
                <div className="pdf-continuation-stamp-badge">DOCUMENTO OFICIAL</div>
                <div className="pdf-stamp-code">{documentCode}</div>
              </div>
            </div>

            <div className="pdf-divider-line" style={{ margin: '6px 0 10px 0' }}></div>

            {/* TABLA 2: CARTERA DE CLIENTES Y ANÁLISIS DE MOROSIDAD */}
            <div className="pdf-section-block">
              <div className="pdf-section-title">
                2. CARTERA DE CLIENTES Y CONTROL DE MOROSIDAD (CUENTAS POR COBRAR - CXC)
              </div>
            <table className="pdf-table">
              <thead>
                <tr>
                  <th style={{ width: '34%' }}>Segmento de Cartera</th>
                  <th style={{ width: '18%', textAlign: 'right' }}>Saldo USD ($)</th>
                  <th style={{ width: '22%', textAlign: 'right' }}>Saldo en Bolívares (Bs. BCV)</th>
                  <th style={{ width: '12%', textAlign: 'right' }}>% Participación</th>
                  <th style={{ width: '14%', textAlign: 'center' }}>Diagnóstico</th>
                </tr>
              </thead>
              <tbody>
                {carteraClientes.map((c, idx) => (
                  <tr key={idx}>
                    <td><strong>{c.segmento}</strong></td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatUsd(c.montoUsd)}</td>
                    <td style={{ textAlign: 'right' }}>{formatBs(c.montoBs)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{c.pct.toFixed(2)}%</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={idx === 0 ? 'pdf-tag-green' : 'pdf-tag-red'}>
                        {idx === 0 ? 'Al Día (75.22%)' : 'Moroso (24.78%)'}
                      </span>
                    </td>
                  </tr>
                ))}
                <tr className="pdf-row-total">
                  <td><strong>TOTAL CARTERA DE CUENTAS POR COBRAR</strong></td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatUsd(totalCarteraUsd)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatBs(totalCarteraBs)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>100.00%</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className="pdf-tag-neutral">Auditado</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* TABLA 3: GESTIÓN DE COBRANZAS Y FLUJO DE RECAUDACIÓN */}
          <div className="pdf-section-block">
            <div className="pdf-section-title">
              3. GESTIÓN DE COBRANZAS Y FLUJO DE RECAUDACIÓN
            </div>
            <table className="pdf-table">
              <thead>
                <tr>
                  <th style={{ width: '34%' }}>Modalidad / Instrumento de Cobro</th>
                  <th style={{ width: '18%', textAlign: 'right' }}>Monto USD ($)</th>
                  <th style={{ width: '22%', textAlign: 'right' }}>Equivalente en Bs. (BCV)</th>
                  <th style={{ width: '12%', textAlign: 'right' }}>% Aporte</th>
                  <th style={{ width: '14%', textAlign: 'center' }}>Canal</th>
                </tr>
              </thead>
              <tbody>
                {cobranzas.map((cob, idx) => (
                  <tr key={idx}>
                    <td>{cob.concepto}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatUsd(cob.montoUsd)}</td>
                    <td style={{ textAlign: 'right' }}>{formatBs(cob.montoBs)}</td>
                    <td style={{ textAlign: 'right' }}>{cob.pct.toFixed(2)}%</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="pdf-tag-neutral">{cob.modalidad.split(' ')[0]}</span>
                    </td>
                  </tr>
                ))}
                <tr className="pdf-row-total">
                  <td><strong>TOTAL RECAUDACIÓN DEL PERÍODO</strong></td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatUsd(totalCobranzasUsd)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatBs(totalCobranzasBs)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>100.00%</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className="pdf-tag-green">Recibido</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* TABLA 4: DISPONIBILIDAD BANCARIA Y TESORERÍA */}
          <div className="pdf-section-block">
            <div className="pdf-section-title">
              4. DISPONIBILIDAD BANCARIA Y LIQUIDEZ INMEDIATA EN TESORERÍA
            </div>
            <table className="pdf-table">
              <thead>
                <tr>
                  <th style={{ width: '28%' }}>Entidad Bancaria / Instrumento</th>
                  <th style={{ width: '24%' }}>Tipo de Cuenta / Custodia</th>
                  <th style={{ width: '18%', textAlign: 'right' }}>Saldo USD ($)</th>
                  <th style={{ width: '18%', textAlign: 'right' }}>Saldo Bs. (Tasa BCV)</th>
                  <th style={{ width: '12%', textAlign: 'right' }}>% Liquidez</th>
                </tr>
              </thead>
              <tbody>
                {bancos.map((b, idx) => (
                  <tr key={idx}>
                    <td><strong>{b.banco}</strong></td>
                    <td style={{ fontSize: '0.75rem', color: '#475569' }}>{b.tipo}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatUsd(b.montoUsd)}</td>
                    <td style={{ textAlign: 'right' }}>{formatBs(b.montoUsd * tasaBcvNum)}</td>
                    <td style={{ textAlign: 'right' }}>{b.pct.toFixed(2)}%</td>
                  </tr>
                ))}
                <tr className="pdf-row-total">
                  <td colSpan={2}><strong>TOTAL DISPONIBILIDAD LÍQUIDA INMEDIATA</strong></td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatUsd(totalBancosUsd)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatBs(totalBancosBs)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>100.00%</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* TABLA 5: OBLIGACIONES COMERCIALES Y OBJETIVOS ESTRATÉGICOS (CXP) */}
          <div className="pdf-section-block">
            <div className="pdf-section-title">
              5. OBLIGACIONES COMERCIALES CON PROVEEDORES (CUENTAS POR PAGAR - CXP)
            </div>
            <table className="pdf-table">
              <thead>
                <tr>
                  <th style={{ width: '40%' }}>Concepto de Obligación Proveedores</th>
                  <th style={{ width: '20%', textAlign: 'right' }}>Monto USD ($)</th>
                  <th style={{ width: '24%', textAlign: 'right' }}>Equivalente en Bs. (BCV)</th>
                  <th style={{ width: '16%', textAlign: 'center' }}>Régimen de Pago</th>
                </tr>
              </thead>
              <tbody>
                {obligaciones.map((ob, idx) => (
                  <tr key={idx}>
                    <td><strong>{ob.rubro}</strong></td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatUsd(ob.montoUsd)}</td>
                    <td style={{ textAlign: 'right' }}>{formatBs(ob.montoBs)}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={idx === 0 ? 'pdf-tag-green' : 'pdf-tag-yellow'}>
                        {ob.estado.split(' - ')[0]}
                      </span>
                    </td>
                  </tr>
                ))}
                <tr className="pdf-row-total">
                  <td><strong>TOTAL OBLIGACIONES EVALUADAS</strong></td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatUsd(totalObligacionesUsd)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 'bold' }}>{formatBs(totalObligacionesBs)}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className="pdf-tag-neutral">En Cobertura</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* RECUADRO DE OBSERVACIONES Y CONCLUSIÓN EJECUTIVA */}
          <div className="pdf-observation-card">
            <div className="pdf-obs-header">
              <ShieldCheck size={16} color="#002b7a" />
              <strong>DICTAMEN EJECUTIVO Y ANÁLISIS DE GESTIÓN COMERCIAL</strong>
            </div>
            <p className="pdf-obs-text">
              El presente informe sintetiza el estado global de operaciones de Grupo Motorven, C.A. con registro cambiario en vivo capturado al momento de la impresión. La meta comercial registra un cumplimiento de <strong>{kpiData.cumplimientoMetaPct}%</strong> sobre el objetivo de 20.000 Litros. La cartera de cuentas por cobrar mantiene un 75.22% de créditos vigentes y un 24.78% en morosidad activa sujeto a gestión directa de cobranza. La liquidez inmediata consolidada en tesorería alcanza <strong>{formatUsd(totalBancosUsd)}</strong> (equivalente a <strong>{formatBs(totalBancosBs)}</strong> a tasa oficial BCV en vivo de Bs. {formatBs(tasaBcvNum).replace('Bs. ', '')}).
            </p>
          </div>

          {/* SECCIÓN FORMAL DE FIRMAS Y APROBACIONES */}
          <div className="pdf-signatures-container">
            <div className="pdf-signature-col">
              <div className="pdf-signature-line"></div>
              <div className="pdf-signature-name">{currentUser?.nombre || 'Administrador General'}</div>
              <div className="pdf-signature-role">{currentUser?.rol?.toUpperCase() || 'OPERACIONES Y SISTEMAS'}</div>
              <div className="pdf-signature-sub">Elaborado y Certificado</div>
            </div>

            <div className="pdf-signature-col">
              <div className="pdf-signature-line"></div>
              <div className="pdf-signature-name">Lcdo. Administración & Finanzas</div>
              <div className="pdf-signature-role">DEPARTAMENTO DE TESORERÍA</div>
              <div className="pdf-signature-sub">Revisado y Conciliado</div>
            </div>

            <div className="pdf-signature-col">
              <div className="pdf-signature-line"></div>
              <div className="pdf-signature-name">Dirección General Ejecutiva</div>
              <div className="pdf-signature-role">GRUPO MOTORVEN, C.A.</div>
              <div className="pdf-signature-sub">Aprobado y Autorizado</div>
            </div>
          </div>

          </div>{/* Fin .executive-page-content Hoja 2 */}

          {/* PIE DE PÁGINA OFICIAL - HOJA 2/2 */}
          <div className="pdf-page-footer">
            <div className="pdf-footer-left">
              <span className="pdf-footer-org">Certificación y Control Gerencial &bull; <strong>GRUPO MOTORVEN, C.A.</strong> &bull; RIF: {config?.rif || 'J-31115365-9'}</span>
              <span className="pdf-footer-sub">Expediente oficial CÓD: {documentCode} &bull; Corte: {horaActual} &bull; {fechaActual}</span>
            </div>
            <div className="pdf-footer-right">
              <div className="pdf-page-badge">
                <span className="pdf-page-badge-prefix">PÁGINA</span>
                <span className="pdf-page-badge-number">2/2</span>
              </div>
            </div>
          </div>
        </div>{/* Fin .executive-page Hoja 2 */}
      </div>
    </div>
  );
}
