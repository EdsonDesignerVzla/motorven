import React, { useState, useEffect, useRef } from 'react';
import {
  Smartphone,
  Tablet,
  Laptop,
  Monitor,
  RotateCw,
  Maximize2,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  ExternalLink,
  Layers,
  Sparkles,
  Check,
  Eye,
  Sliders,
  Compass,
  LayoutGrid,
  Square,
  ShieldCheck,
  ArrowLeft
} from 'lucide-react';

const DEVICE_PRESETS = [
  // --- SMARTPHONES ---
  {
    id: 'iphone-15-pro',
    name: 'iPhone 15 / 16 Pro',
    category: 'smartphone',
    brand: 'Apple',
    width: 393,
    height: 852,
    ratio: '19.5:9',
    diagonal: '6.1"',
    os: 'iOS',
    hasNotch: false,
    hasDynamicIsland: true,
    bezelRadius: 48,
    bezelWidth: 10
  },
  {
    id: 'iphone-15-pro-max',
    name: 'iPhone 15 / 16 Pro Max',
    category: 'smartphone',
    brand: 'Apple',
    width: 430,
    height: 932,
    ratio: '19.5:9',
    diagonal: '6.7"',
    os: 'iOS',
    hasNotch: false,
    hasDynamicIsland: true,
    bezelRadius: 52,
    bezelWidth: 10
  },
  {
    id: 'iphone-14',
    name: 'iPhone 13 / 14',
    category: 'smartphone',
    brand: 'Apple',
    width: 390,
    height: 844,
    ratio: '19.5:9',
    diagonal: '6.1"',
    os: 'iOS',
    hasNotch: true,
    hasDynamicIsland: false,
    bezelRadius: 46,
    bezelWidth: 10
  },
  {
    id: 'iphone-se',
    name: 'iPhone SE (3ra Gen)',
    category: 'smartphone',
    brand: 'Apple',
    width: 375,
    height: 667,
    ratio: '16:9',
    diagonal: '4.7"',
    os: 'iOS',
    hasNotch: false,
    hasDynamicIsland: false,
    bezelRadius: 36,
    bezelWidth: 12
  },
  {
    id: 'samsung-s24-ultra',
    name: 'Samsung Galaxy S24 Ultra',
    category: 'smartphone',
    brand: 'Samsung',
    width: 412,
    height: 915,
    ratio: '20:9',
    diagonal: '6.8"',
    os: 'Android',
    hasNotch: false,
    hasDynamicIsland: false,
    punchHole: true,
    bezelRadius: 28,
    bezelWidth: 8
  },
  {
    id: 'samsung-s24',
    name: 'Samsung Galaxy S24 / S23',
    category: 'smartphone',
    brand: 'Samsung',
    width: 360,
    height: 780,
    ratio: '19.5:9',
    diagonal: '6.2"',
    os: 'Android',
    hasNotch: false,
    hasDynamicIsland: false,
    punchHole: true,
    bezelRadius: 32,
    bezelWidth: 8
  },

  // --- TABLETS ---
  {
    id: 'ipad-pro-129',
    name: 'iPad Pro 12.9"',
    category: 'tablet',
    brand: 'Apple',
    width: 1024,
    height: 1366,
    ratio: '4:3',
    diagonal: '12.9"',
    os: 'iPadOS',
    bezelRadius: 28,
    bezelWidth: 14
  },
  {
    id: 'ipad-air',
    name: 'iPad Air / 10.9"',
    category: 'tablet',
    brand: 'Apple',
    width: 820,
    height: 1180,
    ratio: '4:3',
    diagonal: '10.9"',
    os: 'iPadOS',
    bezelRadius: 26,
    bezelWidth: 14
  },
  {
    id: 'ipad-pro-11',
    name: 'iPad Pro 11"',
    category: 'tablet',
    brand: 'Apple',
    width: 834,
    height: 1194,
    ratio: '4:3',
    diagonal: '11.0"',
    os: 'iPadOS',
    bezelRadius: 26,
    bezelWidth: 14
  },
  {
    id: 'ipad-mini',
    name: 'iPad Mini 8.3"',
    category: 'tablet',
    brand: 'Apple',
    width: 744,
    height: 1133,
    ratio: '3:2',
    diagonal: '8.3"',
    os: 'iPadOS',
    bezelRadius: 24,
    bezelWidth: 12
  },
  {
    id: 'galaxy-tab-s9',
    name: 'Samsung Galaxy Tab S9',
    category: 'tablet',
    brand: 'Samsung',
    width: 800,
    height: 1280,
    ratio: '16:10',
    diagonal: '11.0"',
    os: 'Android',
    bezelRadius: 20,
    bezelWidth: 12
  },

  // --- LAPTOPS & DESKTOP ---
  {
    id: 'macbook-air',
    name: 'MacBook Air / Laptop Estándar',
    category: 'laptop',
    brand: 'Laptop',
    width: 1280,
    height: 800,
    ratio: '16:10',
    diagonal: '13.3"',
    os: 'macOS/Win',
    bezelRadius: 12,
    bezelWidth: 16
  },
  {
    id: 'laptop-hd',
    name: 'Laptop Negocios (1366x768)',
    category: 'laptop',
    brand: 'Laptop',
    width: 1366,
    height: 768,
    ratio: '16:9',
    diagonal: '14.0"',
    os: 'Windows',
    bezelRadius: 10,
    bezelWidth: 14
  },
  {
    id: 'laptop-fhd',
    name: 'Laptop Full HD (1536x864)',
    category: 'laptop',
    brand: 'Laptop',
    width: 1536,
    height: 864,
    ratio: '16:9',
    diagonal: '15.6"',
    os: 'Windows',
    bezelRadius: 10,
    bezelWidth: 14
  },
  {
    id: 'desktop-fhd',
    name: 'Monitor Escritorio 1080p',
    category: 'desktop',
    brand: 'Desktop',
    width: 1920,
    height: 1080,
    ratio: '16:9',
    diagonal: '24.0"',
    os: 'Desktop',
    bezelRadius: 8,
    bezelWidth: 12
  }
];

const APP_MODULES = [
  { id: 'dashboard', name: '📊 Dashboard Principal' },
  { id: 'ventas', name: '⚡ Facturación POS & Caja' },
  { id: 'inventario', name: '📦 Inventario & Stock' },
  { id: 'pedidos', name: '📑 Pedidos & Pipeline' },
  { id: 'vendedores', name: '👥 Fuerza de Ventas' },
  { id: 'rentabilidad', name: '📈 Rentabilidad & BI' },
  { id: 'compras', name: '🛒 Compras & Gastos' },
  { id: 'flujocaja', name: '🏦 Flujo de Caja & Bancos' },
  { id: 'seniat', name: '🏛️ SENIAT Cierre Fiscal' },
  { id: 'auditoria', name: '📜 Libro Diario & Auditoría' },
  { id: 'usuarios', name: '🔐 Gestión de Usuarios' }
];

function getBreakpointBadge(width) {
  if (width <= 360) return { label: 'XS (≤ 360px)', desc: 'Ultra-Compacto', color: '#f59e0b' };
  if (width <= 480) return { label: 'SM (≤ 480px)', desc: 'Smartphones Estándar', color: '#10b981' };
  if (width <= 768) return { label: 'MD (≤ 768px)', desc: 'Tablets Verticales', color: '#0284c7' };
  if (width <= 1024) return { label: 'LG (≤ 1024px)', desc: 'Tablets Horizontales', color: '#8b5cf6' };
  if (width <= 1440) return { label: 'XL (≤ 1440px)', desc: 'Laptops Estándar', color: '#06b6d4' };
  return { label: '2XL (≥ 1440px)', desc: 'UltraWide / Desktop', color: '#3b82f6' };
}

export default function DeviceSimulatorView() {
  const [selectedDeviceId, setSelectedDeviceId] = useState('iphone-15-pro');
  const [categoryFilter, setCategoryFilter] = useState('all'); // 'all', 'smartphone', 'tablet', 'laptop'
  const [orientation, setOrientation] = useState('portrait'); // 'portrait', 'landscape'
  const [activeModule, setActiveModule] = useState('dashboard');
  const [zoomLevel, setZoomLevel] = useState('auto'); // 'auto', 0.5, 0.67, 0.75, 0.9, 1.0
  const [showDeviceFrame, setShowDeviceFrame] = useState(true);
  const [isMultiView, setIsMultiView] = useState(false);
  const [iframeKey, setIframeKey] = useState(1);
  const [containerDimensions, setContainerDimensions] = useState({ width: 1200, height: 800 });
  const viewportRef = useRef(null);

  const selectedDevice = DEVICE_PRESETS.find(d => d.id === selectedDeviceId) || DEVICE_PRESETS[0];

  // Calcular dimensiones efectivas según la orientación
  const isLandscape = orientation === 'landscape';
  const effectiveWidth = isLandscape
    ? Math.max(selectedDevice.width, selectedDevice.height)
    : Math.min(selectedDevice.width, selectedDevice.height);
  const effectiveHeight = isLandscape
    ? Math.min(selectedDevice.width, selectedDevice.height)
    : Math.max(selectedDevice.width, selectedDevice.height);

  // Medir contenedor para el cálculo del zoom automático
  useEffect(() => {
    const updateSize = () => {
      if (viewportRef.current) {
        setContainerDimensions({
          width: viewportRef.current.clientWidth - 48,
          height: viewportRef.current.clientHeight - 48
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Calcular el factor de escala
  const computedScale = (() => {
    if (zoomLevel !== 'auto') return Number(zoomLevel);
    const availableW = containerDimensions.width;
    const availableH = containerDimensions.height;
    const marginBuffer = showDeviceFrame ? 60 : 20;
    const scaleW = availableW / (effectiveWidth + marginBuffer);
    const scaleH = availableH / (effectiveHeight + marginBuffer);
    const minScale = Math.min(scaleW, scaleH);
    return Math.min(1.0, Math.max(0.35, parseFloat(minScale.toFixed(2))));
  })();

  // Construir la URL para el iframe interno
  const baseUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}`
    : '/';
  const iframeSrc = `${baseUrl}?embedded=true#${activeModule}`;

  const currentBreakpoint = getBreakpointBadge(effectiveWidth);

  // Lista de dispositivos filtrada por categoría
  const filteredDevices = categoryFilter === 'all'
    ? DEVICE_PRESETS
    : DEVICE_PRESETS.filter(d => d.category === categoryFilter);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        height: '100dvh',
        backgroundColor: '#090d16',
        color: '#f8fafc',
        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
        overflow: 'hidden'
      }}
    >
      {/* ========================================================================= */}
      {/* 1. BARRA SUPERIOR DE HERRAMIENTAS Y CONTROLES DEL SIMULADOR */}
      {/* ========================================================================= */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          padding: '0.65rem 1.25rem',
          backgroundColor: '#0d1322',
          borderBottom: '1px solid rgba(56, 189, 248, 0.2)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
          zIndex: 100
        }}
      >
        {/* Izquierda: Logotipo y Nombre del Simulador */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 15px rgba(2, 132, 199, 0.5)',
              color: '#fff'
            }}
          >
            <Smartphone size={20} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 900, fontSize: '0.95rem', letterSpacing: '0.5px', color: '#fff' }}>
                VISOR RESPONSIVE MULTI-DISPOSITIVO
              </span>
              <span
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: 'rgba(16, 185, 129, 0.2)',
                  color: '#10b981',
                  border: '1px solid rgba(16, 185, 129, 0.4)'
                }}
              >
                100% ADAPTATIVO
              </span>
            </div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              Signum Motorven • Pruebas en tiempo real para iOS, Android, Tablets y PC
            </div>
          </div>
        </div>

        {/* Centro: Selector de Dispositivo y Filtros de Categoría */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Selector de Categoría Rápido */}
          <div
            style={{
              display: 'flex',
              background: '#161f36',
              borderRadius: '8px',
              padding: '3px',
              border: '1px solid rgba(255, 255, 255, 0.1)'
            }}
          >
            <button
              type="button"
              onClick={() => { setCategoryFilter('all'); setIsMultiView(false); }}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: 'none',
                background: categoryFilter === 'all' && !isMultiView ? '#0284c7' : 'transparent',
                color: categoryFilter === 'all' && !isMultiView ? '#fff' : '#94a3b8',
                fontSize: '0.74rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => { setCategoryFilter('smartphone'); setIsMultiView(false); }}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: 'none',
                background: categoryFilter === 'smartphone' && !isMultiView ? '#0284c7' : 'transparent',
                color: categoryFilter === 'smartphone' && !isMultiView ? '#fff' : '#94a3b8',
                fontSize: '0.74rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer'
              }}
            >
              <Smartphone size={13} /> Celulares
            </button>
            <button
              type="button"
              onClick={() => { setCategoryFilter('tablet'); setIsMultiView(false); }}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: 'none',
                background: categoryFilter === 'tablet' && !isMultiView ? '#0284c7' : 'transparent',
                color: categoryFilter === 'tablet' && !isMultiView ? '#fff' : '#94a3b8',
                fontSize: '0.74rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer'
              }}
            >
              <Tablet size={13} /> Tablets
            </button>
            <button
              type="button"
              onClick={() => { setCategoryFilter('laptop'); setIsMultiView(false); }}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: 'none',
                background: categoryFilter === 'laptop' && !isMultiView ? '#0284c7' : 'transparent',
                color: categoryFilter === 'laptop' && !isMultiView ? '#fff' : '#94a3b8',
                fontSize: '0.74rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer'
              }}
            >
              <Laptop size={13} /> PC / Laptop
            </button>
            <button
              type="button"
              onClick={() => setIsMultiView(!isMultiView)}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: 'none',
                background: isMultiView ? '#10b981' : 'transparent',
                color: isMultiView ? '#fff' : '#94a3b8',
                fontSize: '0.74rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer'
              }}
              title="Ver Teléfono + Tablet + Laptop lado a lado"
            >
              <LayoutGrid size={13} /> Multi-Vista
            </button>
          </div>

          {/* Menú Desplegable de Dispositivos Específicos */}
          {!isMultiView && (
            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              style={{
                background: '#161f36',
                color: '#fff',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '0.8rem',
                fontWeight: 700,
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <optgroup label="📱 Smartphones (iOS & Android)">
                {DEVICE_PRESETS.filter(d => d.category === 'smartphone').map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.width} × {d.height})
                  </option>
                ))}
              </optgroup>
              <optgroup label="📟 Tablets (iPad & Galaxy Tab)">
                {DEVICE_PRESETS.filter(d => d.category === 'tablet').map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.width} × {d.height})
                  </option>
                ))}
              </optgroup>
              <optgroup label="💻 Laptops & Monitores">
                {DEVICE_PRESETS.filter(d => d.category === 'laptop' || d.category === 'desktop').map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.width} × {d.height})
                  </option>
                ))}
              </optgroup>
            </select>
          )}

          {/* Selector de Módulo de la App a Probar */}
          <select
            value={activeModule}
            onChange={(e) => setActiveModule(e.target.value)}
            style={{
              background: '#0f172a',
              color: '#38bdf8',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '0.8rem',
              fontWeight: 700,
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            {APP_MODULES.map(m => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        {/* Derecha: Rotar, Zoom, Marco, Recargar y Volver */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Botón Rotar Orientación */}
          {!isMultiView && (
            <button
              type="button"
              onClick={() => setOrientation(orientation === 'portrait' ? 'landscape' : 'portrait')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                background: '#161f36',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '8px',
                padding: '6px 10px',
                fontSize: '0.76rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
              title="Rotar entre Vertical y Horizontal"
            >
              <RotateCw size={14} />
              <span>{isLandscape ? 'Horizontal' : 'Vertical'}</span>
            </button>
          )}

          {/* Toggle de Marco Físico Realista */}
          {!isMultiView && (
            <button
              type="button"
              onClick={() => setShowDeviceFrame(!showDeviceFrame)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                background: showDeviceFrame ? 'rgba(2, 132, 199, 0.25)' : '#161f36',
                color: showDeviceFrame ? '#38bdf8' : '#94a3b8',
                border: `1px solid ${showDeviceFrame ? '#0284c7' : 'rgba(255, 255, 255, 0.15)'}`,
                borderRadius: '8px',
                padding: '6px 10px',
                fontSize: '0.76rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
              title="Alternar marco de carcasa realista"
            >
              <Square size={14} />
              <span>Marco Realista</span>
            </button>
          )}

          {/* Selector de Zoom */}
          {!isMultiView && (
            <select
              value={zoomLevel}
              onChange={(e) => setZoomLevel(e.target.value)}
              style={{
                background: '#161f36',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '8px',
                padding: '6px 8px',
                fontSize: '0.76rem',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              <option value="auto">Auto-Ajustar ({Math.round(computedScale * 100)}%)</option>
              <option value="1.0">100% (Real)</option>
              <option value="0.9">90%</option>
              <option value="0.75">75%</option>
              <option value="0.67">67%</option>
              <option value="0.5">50%</option>
            </select>
          )}

          {/* Botón Refrescar Iframe */}
          <button
            type="button"
            onClick={() => setIframeKey(prev => prev + 1)}
            style={{
              background: '#161f36',
              color: '#38bdf8',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              borderRadius: '8px',
              padding: '6px 10px',
              fontSize: '0.76rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Recargar vista previa del dispositivo"
          >
            <RefreshCw size={14} />
          </button>

          {/* Botón Abrir Directamente en Pestaña Nueva */}
          <button
            type="button"
            onClick={() => window.open(`${baseUrl}#${activeModule}`, '_blank')}
            style={{
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '0.76rem',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              boxShadow: '0 2px 8px rgba(2, 132, 199, 0.4)'
            }}
          >
            <ExternalLink size={14} />
            <span>Abrir App</span>
          </button>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. ÁREA DE VISUALIZACIÓN PRINCIPAL (VIEWPORT CANVAS) */}
      {/* ========================================================================= */}
      <div
        ref={viewportRef}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'auto',
          padding: '24px',
          position: 'relative',
          background: 'radial-gradient(circle at center, #111827 0%, #090d16 100%)'
        }}
      >
        {/* Tira Informativa de Dimensiones y Breakpoint CSS Activo */}
        <div
          style={{
            position: 'absolute',
            bottom: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '24px',
            padding: '6px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            fontSize: '0.75rem',
            color: '#cbd5e1',
            zIndex: 50,
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.4)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontWeight: 800, color: '#fff' }}>{selectedDevice.name}</span>
            <span style={{ color: '#64748b' }}>•</span>
            <span style={{ color: '#38bdf8', fontWeight: 700 }}>{effectiveWidth} × {effectiveHeight} px</span>
            <span style={{ color: '#64748b' }}>({selectedDevice.ratio})</span>
          </div>

          <div style={{ width: '1px', height: '14px', background: 'rgba(255, 255, 255, 0.2)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: '#94a3b8' }}>Breakpoint CSS:</span>
            <span
              style={{
                background: currentBreakpoint.color,
                color: '#fff',
                padding: '2px 8px',
                borderRadius: '10px',
                fontWeight: 800,
                fontSize: '0.7rem'
              }}
            >
              {currentBreakpoint.label}
            </span>
            <span style={{ color: '#94a3b8', fontSize: '0.7rem' }}>({currentBreakpoint.desc})</span>
          </div>

          <div style={{ width: '1px', height: '14px', background: 'rgba(255, 255, 255, 0.2)' }} />

          <div style={{ color: '#94a3b8' }}>
            Zoom: <strong style={{ color: '#fff' }}>{Math.round(computedScale * 100)}%</strong>
          </div>
        </div>

        {/* --- MODO 1: VISTA DE UN SOLO DISPOSITIVO --- */}
        {!isMultiView && (
          <div
            style={{
              transform: `scale(${computedScale})`,
              transformOrigin: 'center center',
              transition: 'transform 0.25s ease-out',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}
          >
            {/* Contenedor del Marco Físico del Dispositivo */}
            <div
              style={{
                width: `${effectiveWidth}px`,
                height: `${effectiveHeight}px`,
                position: 'relative',
                borderRadius: showDeviceFrame ? `${selectedDevice.bezelRadius || 36}px` : '12px',
                boxShadow: showDeviceFrame
                  ? '0 0 0 12px #1e293b, 0 0 0 14px #334155, 0 25px 60px -15px rgba(0, 0, 0, 0.8), 0 0 35px rgba(2, 132, 199, 0.15)'
                  : '0 10px 40px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.1)',
                overflow: 'hidden',
                backgroundColor: '#070c18',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              {/* Barra de Estado Realista Superior (iOS / Android) */}
              {showDeviceFrame && !isLandscape && selectedDevice.category === 'smartphone' && (
                <div
                  style={{
                    height: '42px',
                    backgroundColor: '#070c18',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 20px',
                    color: '#ffffff',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    userSelect: 'none',
                    position: 'relative',
                    flexShrink: 0,
                    zIndex: 80,
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                  }}
                >
                  {/* Hora */}
                  <div style={{ width: '54px', letterSpacing: '-0.2px' }}>
                    9:41
                  </div>

                  {/* Dynamic Island o Notch o Punch Hole en el centro */}
                  {selectedDevice.hasDynamicIsland && (
                    <div
                      style={{
                        width: '110px',
                        height: '26px',
                        backgroundColor: '#000',
                        borderRadius: '20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0 8px',
                        border: '1px solid #1e293b'
                      }}
                    >
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#0b1329', border: '1px solid #334155' }} />
                      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#111827', border: '1px solid #475569' }} />
                    </div>
                  )}

                  {selectedDevice.hasNotch && (
                    <div
                      style={{
                        width: '130px',
                        height: '22px',
                        backgroundColor: '#000',
                        borderBottomLeftRadius: '14px',
                        borderBottomRightRadius: '14px',
                        border: '1px solid #1e293b',
                        borderTop: 'none'
                      }}
                    />
                  )}

                  {selectedDevice.punchHole && (
                    <div
                      style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: '#000',
                        border: '1.5px solid #334155'
                      }}
                    />
                  )}

                  {!selectedDevice.hasDynamicIsland && !selectedDevice.hasNotch && !selectedDevice.punchHole && (
                    <div style={{ fontSize: '0.68rem', color: '#64748b' }}>Motorven</div>
                  )}

                  {/* Iconos de Estado (Señal, 5G, Batería) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '54px', justifyContent: 'flex-end', fontSize: '0.7rem' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 800 }}>5G</span>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1.5px', height: '9px' }}>
                      <div style={{ width: '2px', height: '3px', background: '#fff', borderRadius: '1px' }} />
                      <div style={{ width: '2px', height: '5px', background: '#fff', borderRadius: '1px' }} />
                      <div style={{ width: '2px', height: '7px', background: '#fff', borderRadius: '1px' }} />
                      <div style={{ width: '2px', height: '9px', background: '#fff', borderRadius: '1px' }} />
                    </div>
                    <div style={{ width: '18px', height: '9px', border: '1.5px solid #fff', borderRadius: '3px', padding: '1px', display: 'flex', alignItems: 'center' }}>
                      <div style={{ width: '100%', height: '100%', background: '#10b981', borderRadius: '1px' }} />
                    </div>
                  </div>
                </div>
              )}

              {/* Contenedor del Iframe de la Aplicación */}
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  width: '100%',
                  position: 'relative',
                  backgroundColor: '#ffffff'
                }}
              >
                <iframe
                  key={`${selectedDeviceId}-${orientation}-${iframeKey}`}
                  src={iframeSrc}
                  title={`Simulador ${selectedDevice.name}`}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    display: 'block'
                  }}
                />
              </div>

              {/* Barra de Inicio Inferior (Home Indicator Bar) en iOS */}
              {showDeviceFrame && selectedDevice.os === 'iOS' && !isLandscape && (
                <div
                  style={{
                    height: '16px',
                    backgroundColor: '#070c18',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}
                >
                  <div
                    style={{
                      width: '135px',
                      height: '4px',
                      backgroundColor: 'rgba(255, 255, 255, 0.4)',
                      borderRadius: '4px'
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- MODO 2: MULTI-VISTA COMPARATIVA (TELÉFONO + TABLET + LAPTOP) --- */}
        {isMultiView && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'center',
              gap: '32px',
              flexWrap: 'nowrap',
              padding: '20px'
            }}
          >
            {/* 1. Teléfono: iPhone 15 Pro */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#38bdf8' }}>
                📱 Smartphone (393 × 852 px)
              </div>
              <div
                style={{
                  width: '393px',
                  height: '750px',
                  borderRadius: '36px',
                  boxShadow: '0 0 0 10px #1e293b, 0 20px 40px rgba(0, 0, 0, 0.8)',
                  overflow: 'hidden',
                  backgroundColor: '#070c18',
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
                <div
                  style={{
                    height: '38px',
                    backgroundColor: '#070c18',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 16px',
                    color: '#ffffff',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    flexShrink: 0,
                    borderBottom: '1px solid rgba(255, 255, 255, 0.05)'
                  }}
                >
                  <span>9:41</span>
                  <div
                    style={{
                      width: '90px',
                      height: '22px',
                      backgroundColor: '#000',
                      borderRadius: '16px',
                      border: '1px solid #1e293b'
                    }}
                  />
                  <span>5G • 100%</span>
                </div>
                <div style={{ flex: 1, minHeight: 0, width: '100%', position: 'relative' }}>
                  <iframe
                    src={iframeSrc}
                    title="Phone Preview"
                    style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                  />
                </div>
              </div>
            </div>

            {/* 2. Tablet: iPad Air */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#10b981' }}>
                📟 Tablet Portrait (768 × 950 px)
              </div>
              <div
                style={{
                  width: '768px',
                  height: '750px',
                  borderRadius: '24px',
                  boxShadow: '0 0 0 10px #1e293b, 0 20px 40px rgba(0, 0, 0, 0.8)',
                  overflow: 'hidden',
                  backgroundColor: '#0f172a'
                }}
              >
                <iframe
                  src={iframeSrc}
                  title="Tablet Preview"
                  style={{ width: '100%', height: '100%', border: 'none' }}
                />
              </div>
            </div>

            {/* 3. Laptop: 1280 × 800 px escalada */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#f59e0b' }}>
                💻 Laptop HD (1280 × 800 px)
              </div>
              <div
                style={{
                  width: '1000px',
                  height: '750px',
                  borderRadius: '16px',
                  boxShadow: '0 0 0 10px #1e293b, 0 20px 40px rgba(0, 0, 0, 0.8)',
                  overflow: 'hidden',
                  backgroundColor: '#0f172a'
                }}
              >
                <iframe
                  src={iframeSrc}
                  title="Laptop Preview"
                  style={{ width: '100%', height: '100%', border: 'none' }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
