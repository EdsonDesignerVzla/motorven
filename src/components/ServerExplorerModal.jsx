import React, { useState, useEffect, useMemo } from 'react';
import {
  Server,
  Database,
  Activity,
  HardDrive,
  Terminal,
  ExternalLink,
  RefreshCw,
  Search,
  Copy,
  Check,
  X,
  Layers,
  Users,
  ShoppingCart,
  Truck,
  Building2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Download,
  Code2,
  ShieldCheck,
  Zap,
  Globe,
  Folder,
  Image as ImageIcon,
  UploadCloud,
  Trash
} from 'lucide-react';
import {
  getProfitBridgeStatus,
  getProfitRealtimeProducts,
  getProfitRealtimeClients,
  triggerProfitSync,
  fetchProfitEndpoint
} from '../services/profitService';
import { isMasterAdmin } from '../services/authService';
import { formatBs, formatUsd } from '../services/formatService';
import {
  listStorageFolder,
  uploadImageToStorage,
  deleteImageFromStorage,
  STORAGE_FOLDERS,
  FOLDER_METADATA,
  STORAGE_BUCKET
} from '../services/imageStorageService';
import { useNotification } from '../context/NotificationContext';
import {
  REAL_SIGNUM_MOTORVEN,
  REAL_PRODUCTS,
  REAL_CLIENTS,
  REAL_SALES,
  REAL_ORDERS,
  REAL_SUPPLIERS,
  REAL_CASH_MOVEMENTS,
  REAL_USERS,
  REAL_PROFIT_INVOICES
} from '../data/supabaseRealData';
import MultiDatabaseExplorerView from '../views/MultiDatabaseExplorerView';

export default function ServerExplorerModal({
  isOpen,
  onClose,
  onSyncComplete,
  onNavigate,
  currentUser,
  products = [],
  clients = [],
  sales = [],
  orders = [],
  suppliers = [],
  cashMovements = []
}) {
  const notify = useNotification();
  const [activeTab, setActiveTab] = useState('tables'); // Default direct to tables
  const [selectedTable, setSelectedTable] = useState('SIGNUM_MOTORVEN'); // Default master table
  const [tableSearch, setTableSearch] = useState('');

  // Estados del servidor y diagnóstico
  const [serverStatus, setServerStatus] = useState({
    isAvailable: false,
    driveOnline: false,
    driveHealth: 'OFFLINE',
    dbHealth: 'DISCONNECTED',
    server: '26.229.220.202:1433',
    database: 'GRUMOTOR',
    isSyncing: false,
    lastSyncTime: null,
    lastSyncStats: null
  });
  const [pinging, setPinging] = useState(false);
  const [pingLatency, setPingLatency] = useState(null);

  // Estados de datos en vivo de Profit
  const [liveProducts, setLiveProducts] = useState(null);
  const [liveClients, setLiveClients] = useState(null);
  const [loadingLiveData, setLoadingLiveData] = useState(false);

  // Estados de la consola API
  const [apiEndpoint, setApiEndpoint] = useState('/api/profit/status');
  const [apiResponse, setApiResponse] = useState(null);
  const [apiLoading, setApiLoading] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  // Estados de sincronización
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [syncError, setSyncError] = useState(null);

  // Estados de Multimedia y Supabase Storage (signum-media)
  const [selectedStorageFolder, setSelectedStorageFolder] = useState(STORAGE_FOLDERS.PRODUCTS);
  const [storageFiles, setStorageFiles] = useState([]);
  const [storageLoading, setStorageLoading] = useState(false);
  const [uploadingToFolder, setUploadingToFolder] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(null);

  const loadFolderFiles = async (folder) => {
    setStorageLoading(true);
    try {
      const res = await listStorageFolder(folder);
      if (res.success) {
        setStorageFiles(res.files || []);
      } else {
        setStorageFiles([]);
      }
    } catch (_) {
      setStorageFiles([]);
    } finally {
      setStorageLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'storage') {
      loadFolderFiles(selectedStorageFolder);
    }
  }, [isOpen, activeTab, selectedStorageFolder]);

  const handleStorageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingToFolder(true);
    try {
      const cleanName = file.name.split('.')[0] || 'media';
      const res = await uploadImageToStorage(file, selectedStorageFolder, cleanName);
      if (res.success) {
        await loadFolderFiles(selectedStorageFolder);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUploadingToFolder(false);
      e.target.value = '';
    }
  };

  const handleStorageDelete = async (filePath) => {
    const confirmed = await notify.confirm({
      title: '¿Eliminar Archivo del Servidor?',
      message: `¿Está seguro de eliminar permanentemente el archivo "${filePath}" del almacenamiento?`,
      confirmText: 'Sí, Eliminar Archivo',
      cancelText: 'Cancelar',
      isDestructive: true
    });
    if (!confirmed) return;
    await deleteImageFromStorage(filePath);
    await loadFolderFiles(selectedStorageFolder);
    notify.success('Archivo eliminado del almacenamiento.');
  };

  // Al abrir el modal, consultar estado inicial y primer endpoint
  useEffect(() => {
    if (isOpen) {
      checkServerHealth();
      executeApiQuery('/api/profit/status');
    }
  }, [isOpen]);

  const checkServerHealth = async () => {
    setPinging(true);
    const start = performance.now();
    try {
      const st = await getProfitBridgeStatus();
      const elapsed = Math.round(performance.now() - start);
      setPingLatency(st.isAvailable ? elapsed : null);
      setServerStatus(prev => ({
        ...prev,
        ...st,
        server: st.server || '26.229.220.202:1433',
        database: st.database || 'GRUMOTOR'
      }));
    } catch (_) {
      setPingLatency(null);
    } finally {
      setPinging(false);
    }
  };

  const handleFetchLiveData = async () => {
    setLoadingLiveData(true);
    try {
      const [prods, clis] = await Promise.all([
        getProfitRealtimeProducts(),
        getProfitRealtimeClients()
      ]);
      if (prods) setLiveProducts(prods);
      if (clis) setLiveClients(clis);
    } catch (err) {
      console.warn('Error al consultar datos en vivo:', err);
    } finally {
      setLoadingLiveData(false);
    }
  };

  const executeApiQuery = async (endpointToFetch = apiEndpoint) => {
    setApiLoading(true);
    setCopiedJson(false);
    try {
      const result = await fetchProfitEndpoint(endpointToFetch);
      setApiResponse(result);
    } catch (err) {
      setApiResponse({
        success: false,
        status: 0,
        statusText: 'CLIENT_ERROR',
        timeMs: 0,
        url: `http://localhost:3005${endpointToFetch}`,
        error: err.message
      });
    } finally {
      setApiLoading(false);
    }
  };

  const handleTriggerSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    setSyncError(null);
    try {
      const res = await triggerProfitSync();
      if (res && res.success) {
        setSyncResult({
          articles: res.articlesSynced || products.length,
          clients: res.clientsSynced || clients.length,
          orders: res.ordersSynced || 0,
          time: new Date().toLocaleTimeString()
        });
        if (onSyncComplete) onSyncComplete();
        checkServerHealth();
      } else {
        throw new Error(res?.error || 'No se pudo completar la sincronización');
      }
    } catch (err) {
      setSyncError(err.message || 'Error al comunicar con el puente de Profit Plus');
    } finally {
      setSyncing(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  // Datos de la tabla activa con filtro de búsqueda
  const currentTableData = useMemo(() => {
    let sourceData = [];
    let isLiveProfit = false;

    if (selectedTable === 'SIGNUM_MOTORVEN') {
      sourceData = REAL_SIGNUM_MOTORVEN;
    } else if (selectedTable === 'products') {
      if (liveProducts && liveProducts.length > 0) {
        sourceData = liveProducts;
        isLiveProfit = true;
      } else {
        sourceData = (products && products.length > 0) ? products : REAL_PRODUCTS;
      }
    } else if (selectedTable === 'clients') {
      if (liveClients && liveClients.length > 0) {
        sourceData = liveClients;
        isLiveProfit = true;
      } else {
        sourceData = (clients && clients.length > 0) ? clients : REAL_CLIENTS;
      }
    } else if (selectedTable === 'users') {
      sourceData = REAL_USERS;
    } else if (selectedTable === 'sales') {
      sourceData = (sales && sales.length > 0) ? sales : REAL_SALES;
    } else if (selectedTable === 'invoices') {
      sourceData = REAL_PROFIT_INVOICES;
    } else if (selectedTable === 'orders') {
      sourceData = (orders && orders.length > 0) ? orders : REAL_ORDERS;
    } else if (selectedTable === 'suppliers') {
      sourceData = (suppliers && suppliers.length > 0) ? suppliers : REAL_SUPPLIERS;
    } else if (selectedTable === 'cash') {
      sourceData = (cashMovements && cashMovements.length > 0) ? cashMovements : REAL_CASH_MOVEMENTS;
    }

    if (!tableSearch.trim()) {
      return { data: sourceData, isLive: isLiveProfit, total: sourceData.length };
    }

    const term = tableSearch.toLowerCase().trim();
    const filtered = sourceData.filter(item => {
      return Object.values(item).some(val => {
        if (val === null || val === undefined) return false;
        if (typeof val === 'object') return false;
        return String(val).toLowerCase().includes(term);
      });
    });

    return { data: filtered, isLive: isLiveProfit, total: sourceData.length };
  }, [selectedTable, liveProducts, liveClients, products, clients, sales, orders, suppliers, cashMovements, tableSearch]);

  const handleExportJson = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentTableData.data, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `servidor_${selectedTable}_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    } catch (_) {}
  };

  if (!isOpen) return null;
  if (currentUser && !isMasterAdmin(currentUser)) return null;

  const isDark = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'var(--bg-modal-overlay, rgba(3, 7, 18, 0.85))',
        backdropFilter: 'blur(8px)',
        zIndex: 100010,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        animation: 'fadeIn 0.2s ease-out'
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-modal, #0c1427)',
          border: isDark ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid rgba(0, 43, 122, 0.2)',
          borderRadius: '18px',
          width: '100%',
          maxWidth: '1080px',
          height: '88vh',
          maxHeight: '860px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: isDark
            ? '0 25px 60px -10px rgba(0, 0, 0, 0.85), 0 0 50px rgba(2, 132, 199, 0.2)'
            : '0 25px 50px -10px rgba(0, 43, 122, 0.25), 0 4px 20px rgba(0, 0, 0, 0.08)',
          overflow: 'hidden',
          color: 'var(--text-primary)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera Principal */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            background: isDark
              ? 'linear-gradient(135deg, rgba(0, 43, 122, 0.6) 0%, rgba(10, 16, 32, 0.95) 100%)'
              : 'linear-gradient(135deg, #eef4ff 0%, #f8fafc 100%)',
            borderBottom: isDark ? '1px solid rgba(56, 189, 248, 0.25)' : '1px solid rgba(0, 43, 122, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #0284c7 0%, #002b7a 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(2, 132, 199, 0.35)',
                color: '#fff'
              }}
            >
              <Server size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-heading, #fff)', letterSpacing: '-0.02em' }}>
                  Explorador del Servidor & Base de Datos
                </h2>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    background: serverStatus.isAvailable ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                    border: `1px solid ${serverStatus.isAvailable ? 'rgba(16, 185, 129, 0.4)' : 'rgba(245, 158, 11, 0.4)'}`,
                    color: serverStatus.isAvailable ? '#10b981' : '#f59e0b'
                  }}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: serverStatus.isAvailable ? '#10b981' : '#f59e0b',
                      boxShadow: serverStatus.isAvailable ? '0 0 6px #10b981' : '0 0 6px #f59e0b'
                    }}
                  />
                  {serverStatus.isAvailable ? 'API Bridge En Línea' : 'Operando con Réplica'}
                </span>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>SQL Server (Profit Plus 2K8 - GRUMOTOR)</span>
                <span>•</span>
                <span>Micro-API :3005</span>
                <span>•</span>
                <span>Base DB_SIGNUM_MOTORVEN (Supabase)</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <a
              href="http://localhost:3005/"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '0.45rem 0.85rem',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 600,
                background: isDark ? 'rgba(2, 132, 199, 0.18)' : '#e0f2fe',
                border: '1px solid rgba(2, 132, 199, 0.35)',
                color: isDark ? '#38bdf8' : '#0369a1',
                textDecoration: 'none',
                cursor: 'pointer'
              }}
              title="Abrir endpoint directo del servidor en una nueva pestaña"
            >
              <ExternalLink size={13} />
              <span>Abrir API en Navegador</span>
            </a>

            <button
              type="button"
              onClick={() => window.open('?view=supabase-tables', '_blank')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '0.45rem 0.85rem',
                borderRadius: '8px',
                fontSize: '0.78rem',
                fontWeight: 600,
                background: isDark ? 'rgba(16, 185, 129, 0.18)' : '#ecfdf5',
                border: '1px solid rgba(16, 185, 129, 0.35)',
                color: isDark ? '#34d399' : '#059669',
                cursor: 'pointer'
              }}
              title="Abrir explorador de tablas de Supabase en una hoja nueva del navegador"
            >
              <Database size={13} />
              <span>Tablas Supabase (Hoja Nueva)</span>
            </button>

            <button
              onClick={onClose}
              style={{
                background: 'var(--bg-tertiary, rgba(255, 255, 255, 0.08))',
                border: '1px solid var(--border-glass, rgba(255, 255, 255, 0.15))',
                borderRadius: '8px',
                width: '34px',
                height: '34px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted, #94a3b8)',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              title="Cerrar Explorador"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Barra de Pestañas de Navegación del Explorador */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '0 1.5rem',
            background: isDark ? 'rgba(0, 0, 0, 0.25)' : '#f1f5f9',
            borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 43, 122, 0.1)',
            gap: '0.5rem',
            flexShrink: 0
          }}
        >
          <button
            onClick={() => setActiveTab('status')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.75rem 1rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'status' ? '2px solid #0284c7' : '2px solid transparent',
              color: activeTab === 'status' ? (isDark ? '#38bdf8' : '#002b7a') : 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <Activity size={15} />
            <span>Diagnóstico & Conexión</span>
          </button>

          <button
            onClick={() => setActiveTab('tables')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.75rem 1rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'tables' ? '2px solid #0284c7' : '2px solid transparent',
              color: activeTab === 'tables' ? (isDark ? '#38bdf8' : '#002b7a') : 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <Database size={15} />
            <span>Explorador de Tablas (Local)</span>
          </button>

          <button
            onClick={() => setActiveTab('profit-databases')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.75rem 1rem',
              fontSize: '0.85rem',
              fontWeight: 800,
              background: activeTab === 'profit-databases' ? 'rgba(2, 132, 199, 0.15)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'profit-databases' ? '2px solid #0284c7' : '2px solid transparent',
              color: activeTab === 'profit-databases' ? (isDark ? '#38bdf8' : '#002b7a') : 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <Database size={15} color="#10b981" />
            <span>26 BDs Profit (SQL Server)</span>
            <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '4px', background: '#10b981', color: '#fff', fontWeight: 800 }}>NUEVO</span>
          </button>

          <button
            onClick={() => setActiveTab('api')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.75rem 1rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'api' ? '2px solid #0284c7' : '2px solid transparent',
              color: activeTab === 'api' ? (isDark ? '#38bdf8' : '#002b7a') : 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <Code2 size={15} />
            <span>Consola de API & JSON</span>
          </button>

          <button
            onClick={() => setActiveTab('sync')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.75rem 1rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'sync' ? '2px solid #0284c7' : '2px solid transparent',
              color: activeTab === 'sync' ? (isDark ? '#38bdf8' : '#002b7a') : 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <Zap size={15} />
            <span>Sincronización & Respaldo</span>
          </button>

          <button
            onClick={() => setActiveTab('storage')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.75rem 1rem',
              fontSize: '0.85rem',
              fontWeight: 700,
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === 'storage' ? '2px solid #0284c7' : '2px solid transparent',
              color: activeTab === 'storage' ? (isDark ? '#38bdf8' : '#002b7a') : 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            <Folder size={15} />
            <span>Multimedia & Storage (signum-media)</span>
          </button>

          {onNavigate && (
            <button
              onClick={() => {
                onClose();
                onNavigate('bases-datos');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '0.5rem 0.85rem',
                fontSize: '0.82rem',
                fontWeight: 800,
                background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.25) 0%, rgba(16, 185, 129, 0.2) 100%)',
                border: '1px solid rgba(56, 189, 248, 0.5)',
                borderRadius: '8px',
                color: '#38bdf8',
                cursor: 'pointer',
                marginLeft: 'auto',
                transition: 'all 0.2s',
                alignSelf: 'center'
              }}
              title="Abrir el Explorador Completo de las 26 Bases de Datos de Profit Plus"
            >
              <Database size={14} color="#10b981" />
              <span>Ver las 26 BDs de Profit</span>
              <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '4px', background: '#10b981', color: '#fff', fontWeight: 800 }}>NUEVO</span>
            </button>
          )}
        </div>

        {/* Contenido Dinámico de las Pestañas */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* ============================================================== */}
          {/* TAB 1: DIAGNÓSTICO & CONEXIÓN                                  */}
          {/* ============================================================== */}
          {activeTab === 'status' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Tarjetas de los 3 Servicios Clave */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                {/* 1. SQL Server Profit Plus */}
                <div
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.03)' : '#f8fafc',
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 43, 122, 0.12)',
                    borderRadius: '14px',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <HardDrive size={18} color="#0284c7" />
                      <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>SQL Server (Profit 2K8)</span>
                    </div>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '10px',
                        background: serverStatus.driveOnline ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                        color: serverStatus.driveOnline ? '#10b981' : '#f59e0b'
                      }}
                    >
                      {serverStatus.driveOnline ? 'ONLINE' : 'RÉPLICA ACTIVA'}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Servidor / Host:</span>
                      <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{serverStatus.server}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Base de Datos:</span>
                      <span style={{ fontWeight: 600, color: '#0284c7' }}>{serverStatus.database}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Estado Disco:</span>
                      <span style={{ fontWeight: 600 }}>{serverStatus.driveHealth}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Red de Enlace:</span>
                      <span style={{ fontWeight: 600 }}>Radmin VPN / LAN</span>
                    </div>
                  </div>
                </div>

                {/* 2. Micro-API Local Puente (:3005) */}
                <div
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.03)' : '#f8fafc',
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 43, 122, 0.12)',
                    borderRadius: '14px',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Server size={18} color="#10b981" />
                      <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Servidor Micro-API Local</span>
                    </div>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '10px',
                        background: serverStatus.isAvailable ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: serverStatus.isAvailable ? '#10b981' : '#ef4444'
                      }}
                    >
                      {serverStatus.isAvailable ? 'ACTIVO (PUERTO 3005)' : 'EN ESPERA'}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>URL Local:</span>
                      <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>http://localhost:3005</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Latencia Ping:</span>
                      <span style={{ fontWeight: 600, color: pingLatency ? '#10b981' : 'var(--text-muted)' }}>
                        {pingLatency ? `${pingLatency} ms` : 'N/A'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Script Demonio:</span>
                      <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>server.js</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Intervalo Auto-Sync:</span>
                      <span style={{ fontWeight: 600 }}>Cada 3 minutos</span>
                    </div>
                  </div>
                </div>

                {/* 3. Base de Datos Supabase Cloud DB_SIGNUM_MOTORVEN */}
                <div
                  style={{
                    background: isDark ? 'rgba(255, 255, 255, 0.03)' : '#f8fafc',
                    border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 43, 122, 0.12)',
                    borderRadius: '14px',
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Globe size={18} color="#38bdf8" />
                      <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>DB_SIGNUM_MOTORVEN (Supabase)</span>
                    </div>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '10px',
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: '#10b981'
                      }}
                    >
                      FULL CRUD (100%)
                    </span>
                  </div>

                  <div style={{ fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Servidor Base de Datos:</span>
                      <span style={{ fontWeight: 600, fontFamily: 'monospace', color: '#3ecf8e' }}>Supabase Local (:54321)</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Esquemas:</span>
                      <span style={{ fontWeight: 600, color: '#38bdf8' }}>db_signum_motorven / public</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Permisos Activos:</span>
                      <span style={{ fontWeight: 700, color: '#10b981' }}>Lectura, Escritura, Borrar, Editar</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Sincronización Profit:</span>
                      <span style={{ fontWeight: 600, color: '#10b981' }}>Tiempo Real Automática</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Botón de Comprobación y Ping */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1rem',
                  borderRadius: '12px',
                  background: isDark ? 'rgba(2, 132, 199, 0.1)' : '#eff6ff',
                  border: isDark ? '1px solid rgba(2, 132, 199, 0.25)' : '1px solid #bfdbfe'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Activity size={20} color="#0284c7" />
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 700 }}>Probar Conectividad y Ping del Servidor</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      Consulta el estado físico de los discos y la disponibilidad de los endpoints en tiempo real.
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={checkServerHealth}
                    disabled={pinging}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '0.55rem 1rem',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      background: '#0284c7',
                      border: 'none',
                      color: '#fff',
                      cursor: pinging ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <RefreshCw size={14} className={pinging ? 'spin-animation' : ''} />
                    <span>{pinging ? 'Comprobando...' : 'Hacer Ping Ahora'}</span>
                  </button>

                  <button
                    onClick={handleFetchLiveData}
                    disabled={loadingLiveData}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '0.55rem 1rem',
                      borderRadius: '8px',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      background: isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0',
                      border: '1px solid var(--border-glass)',
                      color: 'var(--text-primary)',
                      cursor: loadingLiveData ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <Zap size={14} color="#f59e0b" />
                    <span>{loadingLiveData ? 'Cargando...' : 'Consultar Datos en Vivo'}</span>
                  </button>
                </div>
              </div>

              {/* Guía Operativa de Ejecución del Servidor */}
              <div
                style={{
                  background: isDark ? 'rgba(15, 23, 42, 0.6)' : '#ffffff',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 43, 122, 0.1)',
                  borderRadius: '12px',
                  padding: '1.25rem'
                }}
              >
                <div style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Terminal size={16} color="#0284c7" />
                  <span>Guía para Iniciar el Micro-Servicio Profit Bridge</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                  Si el servidor API local (puerto 3005) se encuentra desconectado, ejecute el siguiente comando en la consola o haga doble clic en el archivo batch:
                </div>
                <div
                  style={{
                    marginTop: '0.5rem',
                    background: '#030712',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    fontFamily: 'monospace',
                    fontSize: '0.8rem',
                    color: '#38bdf8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    border: '1px solid rgba(56, 189, 248, 0.2)'
                  }}
                >
                  <code>scripts/profit-bridge/iniciar_servidor_profit.bat</code>
                  <button
                    onClick={() => copyToClipboard('scripts/profit-bridge/iniciar_servidor_profit.bat')}
                    style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                    title="Copiar comando"
                  >
                    {copiedJson ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 2: EXPLORADOR DE TABLAS                                    */}
          {/* ============================================================== */}
          {activeTab === 'tables' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
              {/* Selector de Tablas y Filtro */}
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem' }}>
                {/* Píldoras de Tablas */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {[
                    { id: 'SIGNUM_MOTORVEN', label: 'SIGNUM_MOTORVEN (Master)', icon: Database, count: REAL_SIGNUM_MOTORVEN.length },
                    { id: 'products', label: 'Lubricantes (art)', icon: Layers, count: (liveProducts || (products && products.length > 0 ? products : REAL_PRODUCTS)).length },
                    { id: 'clients', label: 'Clientes (clientes)', icon: Users, count: (liveClients || (clients && clients.length > 0 ? clients : REAL_CLIENTS)).length },
                    { id: 'users', label: 'Usuarios (users)', icon: ShieldCheck, count: REAL_USERS.length },
                    { id: 'sales', label: 'Ventas (factura)', icon: ShoppingCart, count: (sales && sales.length > 0 ? sales : REAL_SALES).length },
                    { id: 'invoices', label: 'Facturas Profit (invoices)', icon: ShoppingCart, count: REAL_PROFIT_INVOICES.length },
                    { id: 'orders', label: 'Pedidos (pedidos)', icon: Truck, count: (orders && orders.length > 0 ? orders : REAL_ORDERS).length },
                    { id: 'suppliers', label: 'Proveedores (prov)', icon: Building2, count: (suppliers && suppliers.length > 0 ? suppliers : REAL_SUPPLIERS).length },
                    { id: 'cash', label: 'Caja & Bancos', icon: Activity, count: (cashMovements && cashMovements.length > 0 ? cashMovements : REAL_CASH_MOVEMENTS).length }
                  ].map(tab => {
                    const Icon = tab.icon;
                    const isSelected = selectedTable === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => {
                          setSelectedTable(tab.id);
                          setTableSearch('');
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '0.45rem 0.85rem',
                          borderRadius: '8px',
                          fontSize: '0.8rem',
                          fontWeight: 700,
                          background: isSelected
                            ? '#0284c7'
                            : (isDark ? 'rgba(255, 255, 255, 0.05)' : '#e2e8f0'),
                          border: isSelected
                            ? '1px solid #38bdf8'
                            : '1px solid transparent',
                          color: isSelected ? '#fff' : 'var(--text-muted)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <Icon size={14} />
                        <span>{tab.label}</span>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            padding: '1px 5px',
                            borderRadius: '10px',
                            background: isSelected ? 'rgba(0, 0, 0, 0.25)' : (isDark ? 'rgba(255, 255, 255, 0.1)' : '#cbd5e1'),
                            color: isSelected ? '#fff' : 'var(--text-primary)'
                          }}
                        >
                          {tab.count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Acciones de exportación y consulta */}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={handleExportJson}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '0.45rem 0.85rem',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      background: isDark ? 'rgba(16, 185, 129, 0.15)' : '#dcfce7',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      color: isDark ? '#6ee7b7' : '#15803d',
                      cursor: 'pointer'
                    }}
                    title="Exportar registros filtrados a formato JSON"
                  >
                    <Download size={13} />
                    <span>Exportar JSON</span>
                  </button>
                </div>
              </div>

              {/* Barra de Búsqueda y Fuente de Datos */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  padding: '0.65rem 1rem',
                  borderRadius: '10px',
                  background: isDark ? 'rgba(255, 255, 255, 0.03)' : '#f8fafc',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 43, 122, 0.1)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                  <Search size={16} color="var(--text-muted)" />
                  <input
                    type="text"
                    value={tableSearch}
                    onChange={(e) => setTableSearch(e.target.value)}
                    placeholder={`Buscar en tabla ${selectedTable} por cualquier campo...`}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      width: '100%',
                      outline: 'none'
                    }}
                  />
                  {tableSearch && (
                    <button
                      onClick={() => setTableSearch('')}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.78rem', flexShrink: 0 }}>
                  <span style={{ color: 'var(--text-muted)' }}>
                    Mostrando <strong>{currentTableData.data.length}</strong> de {currentTableData.total}
                  </span>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontWeight: 700,
                      fontSize: '0.72rem',
                      background: currentTableData.isLive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(2, 132, 199, 0.15)',
                      color: currentTableData.isLive ? '#10b981' : '#0284c7',
                      border: `1px solid ${currentTableData.isLive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(2, 132, 199, 0.3)'}`
                    }}
                  >
                    {currentTableData.isLive ? '⚡ PROFIT REALTIME' : '☁️ RÉPLICA SUPABASE'}
                  </span>
                </div>
              </div>

              {/* Vista Tabular */}
              <div
                style={{
                  flex: 1,
                  overflow: 'auto',
                  borderRadius: '12px',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 43, 122, 0.1)',
                  background: isDark ? 'rgba(10, 16, 32, 0.6)' : '#ffffff',
                  maxHeight: '440px'
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                  <thead
                    style={{
                      position: 'sticky',
                      top: 0,
                      background: isDark ? '#0f172a' : '#eef4ff',
                      zIndex: 10,
                      borderBottom: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 43, 122, 0.15)'
                    }}
                  >
                    {selectedTable === 'SIGNUM_MOTORVEN' && (
                      <tr>
                        <th style={{ padding: '0.75rem 1rem' }}>Módulo</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Entidad / Colección</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Origen ERP</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Estatus Base de Datos</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Registros Sincronizados</th>
                      </tr>
                    )}
                    {selectedTable === 'users' && (
                      <tr>
                        <th style={{ padding: '0.75rem 1rem' }}>Usuario</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Nombre Completo</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Email</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Rol Asignado</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Estatus</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Último Acceso</th>
                      </tr>
                    )}
                    {selectedTable === 'invoices' && (
                      <tr>
                        <th style={{ padding: '0.75rem 1rem' }}>N° Factura</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Fecha</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Cliente</th>
                        <th style={{ padding: '0.75rem 1rem' }}>RIF</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Vendedor</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Total USD</th>
                      </tr>
                    )}
                    {selectedTable === 'products' && (
                      <tr>
                        <th style={{ padding: '0.75rem 1rem' }}>Código</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Descripción / Lubricante</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Categoría</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Viscosidad</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Stock Actual</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Precio Detal</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Precio Mayor</th>
                      </tr>
                    )}
                    {selectedTable === 'clients' && (
                      <tr>
                        <th style={{ padding: '0.75rem 1rem' }}>Código</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Nombre / Razón Social</th>
                        <th style={{ padding: '0.75rem 1rem' }}>RIF</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Ciudad / Zona</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Tipo</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Límite Crédito</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Saldo Deudor</th>
                      </tr>
                    )}
                    {selectedTable === 'sales' && (
                      <tr>
                        <th style={{ padding: '0.75rem 1rem' }}>ID / Factura</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Fecha</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Cliente</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Método Pago</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Total USD</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Total Bs.</th>
                      </tr>
                    )}
                    {selectedTable === 'orders' && (
                      <tr>
                        <th style={{ padding: '0.75rem 1rem' }}>N° Pedido</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Fecha</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Cliente</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Estado</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Monto Total</th>
                      </tr>
                    )}
                    {selectedTable === 'suppliers' && (
                      <tr>
                        <th style={{ padding: '0.75rem 1rem' }}>Código</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Proveedor</th>
                        <th style={{ padding: '0.75rem 1rem' }}>RIF</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Teléfono</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Saldo Deudor</th>
                      </tr>
                    )}
                    {selectedTable === 'cash' && (
                      <tr>
                        <th style={{ padding: '0.75rem 1rem' }}>Fecha</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Concepto</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Tipo</th>
                        <th style={{ padding: '0.75rem 1rem' }}>Método</th>
                        <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Monto ($)</th>
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {currentTableData.data.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                          No se encontraron registros que coincidan con la búsqueda.
                        </td>
                      </tr>
                    ) : (
                      currentTableData.data.slice(0, 150).map((row, idx) => {
                        const isEven = idx % 2 === 0;
                        const rowBg = isEven
                          ? (isDark ? 'rgba(255, 255, 255, 0.015)' : '#ffffff')
                          : (isDark ? 'rgba(255, 255, 255, 0.04)' : '#f8fafc');

                        if (selectedTable === 'SIGNUM_MOTORVEN') {
                          return (
                            <tr key={row.id || idx} style={{ background: rowBg, borderBottom: '1px solid var(--border-glass)' }}>
                              <td style={{ padding: '0.65rem 1rem', fontWeight: 700, color: '#38bdf8' }}>
                                {row.modulo}
                              </td>
                              <td style={{ padding: '0.65rem 1rem', fontWeight: 600 }}>
                                {row.entidad}
                              </td>
                              <td style={{ padding: '0.65rem 1rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                                {row.origen_erp}
                              </td>
                              <td style={{ padding: '0.65rem 1rem' }}>
                                <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                                  ● {row.estatus_base_datos}
                                </span>
                              </td>
                              <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontWeight: 700, color: '#38bdf8' }}>
                                {row.registros_sincronizados?.toLocaleString()}
                              </td>
                            </tr>
                          );
                        }

                        if (selectedTable === 'users') {
                          return (
                            <tr key={row.id || row.username || idx} style={{ background: rowBg, borderBottom: '1px solid var(--border-glass)' }}>
                              <td style={{ padding: '0.65rem 1rem', fontFamily: 'monospace', fontWeight: 700, color: '#38bdf8' }}>
                                {row.username}
                              </td>
                              <td style={{ padding: '0.65rem 1rem', fontWeight: 600 }}>
                                {row.nombre}
                              </td>
                              <td style={{ padding: '0.65rem 1rem', color: 'var(--text-muted)' }}>
                                {row.email}
                              </td>
                              <td style={{ padding: '0.65rem 1rem' }}>
                                <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                                  {row.rol}
                                </span>
                              </td>
                              <td style={{ padding: '0.65rem 1rem' }}>
                                <span style={{ padding: '2px 8px', borderRadius: '6px', fontSize: '0.72rem', fontWeight: 700, background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}>
                                  {row.activo ? 'ACTIVO' : 'INACTIVO'}
                                </span>
                              </td>
                              <td style={{ padding: '0.65rem 1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {row.ultimo_acceso || 'Hoy'}
                              </td>
                            </tr>
                          );
                        }

                        if (selectedTable === 'invoices') {
                          return (
                            <tr key={row.id || row.factura_numero || idx} style={{ background: rowBg, borderBottom: '1px solid var(--border-glass)' }}>
                              <td style={{ padding: '0.65rem 1rem', fontFamily: 'monospace', fontWeight: 700, color: '#0284c7' }}>
                                {row.factura_numero}
                              </td>
                              <td style={{ padding: '0.65rem 1rem', fontSize: '0.75rem' }}>
                                {row.fecha}
                              </td>
                              <td style={{ padding: '0.65rem 1rem', fontWeight: 600 }}>
                                {row.cliente_nombre}
                              </td>
                              <td style={{ padding: '0.65rem 1rem', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                                {row.rif}
                              </td>
                              <td style={{ padding: '0.65rem 1rem' }}>
                                {row.vendedor}
                              </td>
                              <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                                {formatUsd(Number(row.monto_total_usd || 0))}
                              </td>
                            </tr>
                          );
                        }

                        if (selectedTable === 'products') {
                          return (
                            <tr key={row.id || row.codigo || idx} style={{ background: rowBg, borderBottom: '1px solid var(--border-glass)' }}>
                              <td style={{ padding: '0.65rem 1rem', fontFamily: 'monospace', fontWeight: 600, color: '#0284c7' }}>
                                {row.codigo || row.id}
                              </td>
                              <td style={{ padding: '0.65rem 1rem', fontWeight: 600 }}>
                                {row.descripcion}
                              </td>
                              <td style={{ padding: '0.65rem 1rem' }}>
                                <span style={{ padding: '2px 6px', borderRadius: '6px', fontSize: '0.72rem', background: 'rgba(2, 132, 199, 0.1)', color: '#0284c7' }}>
                                  {row.categoria || 'Lubricantes'}
                                </span>
                              </td>
                              <td style={{ padding: '0.65rem 1rem' }}>{row.viscosidad || 'N/A'}</td>
                              <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontWeight: 700, color: Number(row.stock || 0) <= Number(row.stock_minimo || row.stockMinimo || 5) ? '#ef4444' : '#10b981' }}>
                                {Number(row.stock || 0)}
                              </td>
                              <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontWeight: 600 }}>
                                {formatUsd(Number(row.precio_usd_detal || row.precioUsdDetal || 0))}
                              </td>
                              <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontWeight: 600, color: '#10b981' }}>
                                {formatUsd(Number(row.precio_usd_mayor || row.precioUsdMayor || 0))}
                              </td>
                            </tr>
                          );
                        }

                        if (selectedTable === 'clients') {
                          return (
                            <tr key={row.id || row.codigo || idx} style={{ background: rowBg, borderBottom: '1px solid var(--border-glass)' }}>
                              <td style={{ padding: '0.65rem 1rem', fontFamily: 'monospace', fontWeight: 600, color: '#0284c7' }}>
                                {row.codigo || row.id}
                              </td>
                              <td style={{ padding: '0.65rem 1rem', fontWeight: 600 }}>{row.nombre}</td>
                              <td style={{ padding: '0.65rem 1rem', fontFamily: 'monospace' }}>{row.rif}</td>
                              <td style={{ padding: '0.65rem 1rem' }}>{row.ciudad || row.zonaVenta || 'N/A'}</td>
                              <td style={{ padding: '0.65rem 1rem' }}>{row.tipoCliente || row.tipo_cliente || 'Mayorista'}</td>
                              <td style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>
                                {formatUsd(Number(row.limiteCreditoUsd || row.limite_credito_usd || 0))}
                              </td>
                              <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontWeight: 700, color: Number(row.saldoDeudorUsd || row.saldo_deudor_usd || 0) > 0 ? '#ef4444' : '#10b981' }}>
                                {formatUsd(Number(row.saldoDeudorUsd || row.saldo_deudor_usd || 0))}
                              </td>
                            </tr>
                          );
                        }

                        if (selectedTable === 'sales') {
                          return (
                            <tr key={row.id || idx} style={{ background: rowBg, borderBottom: '1px solid var(--border-glass)' }}>
                              <td style={{ padding: '0.65rem 1rem', fontFamily: 'monospace', fontWeight: 600 }}>
                                #{row.id || row.numeroFactura || idx + 1}
                              </td>
                              <td style={{ padding: '0.65rem 1rem' }}>{row.fecha || 'N/A'}</td>
                              <td style={{ padding: '0.65rem 1rem', fontWeight: 600 }}>{row.clienteNombre || row.cliente || 'Consumidor Final'}</td>
                              <td style={{ padding: '0.65rem 1rem' }}>{row.metodoPago || 'Efectivo / Mixto'}</td>
                              <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                                {formatUsd(Number(row.totalUsd || row.total_usd || 0))}
                              </td>
                              <td style={{ padding: '0.65rem 1rem', textAlign: 'right' }}>
                                {formatBs(Number(row.totalBs || row.total_bs || 0))}
                              </td>
                            </tr>
                          );
                        }

                        if (selectedTable === 'orders') {
                          return (
                            <tr key={row.id || idx} style={{ background: rowBg, borderBottom: '1px solid var(--border-glass)' }}>
                              <td style={{ padding: '0.65rem 1rem', fontFamily: 'monospace', fontWeight: 600, color: '#0284c7' }}>
                                {row.id || row.numero_pedido || `PED-${idx + 1}`}
                              </td>
                              <td style={{ padding: '0.65rem 1rem' }}>{row.fecha || 'N/A'}</td>
                              <td style={{ padding: '0.65rem 1rem', fontWeight: 600 }}>{row.cliente || row.cliente_nombre}</td>
                              <td style={{ padding: '0.65rem 1rem' }}>
                                <span style={{ padding: '2px 8px', borderRadius: '10px', fontSize: '0.72rem', background: 'rgba(2, 132, 199, 0.15)', color: '#0284c7', fontWeight: 700 }}>
                                  {row.status || row.estado || 'CONFIRMADO'}
                                </span>
                              </td>
                              <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontWeight: 700, color: '#10b981' }}>
                                {formatUsd(Number(row.total_usd || row.total || 0))}
                              </td>
                            </tr>
                          );
                        }

                        if (selectedTable === 'suppliers') {
                          return (
                            <tr key={row.id || idx} style={{ background: rowBg, borderBottom: '1px solid var(--border-glass)' }}>
                              <td style={{ padding: '0.65rem 1rem', fontFamily: 'monospace', color: '#0284c7' }}>{row.id || row.codigo}</td>
                              <td style={{ padding: '0.65rem 1rem', fontWeight: 600 }}>{row.nombre || row.proveedor}</td>
                              <td style={{ padding: '0.65rem 1rem', fontFamily: 'monospace' }}>{row.rif || 'N/A'}</td>
                              <td style={{ padding: '0.65rem 1rem' }}>{row.telefono || 'N/A'}</td>
                              <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontWeight: 700, color: '#ef4444' }}>
                                {formatUsd(Number(row.saldoDeudor || row.saldo || 0))}
                              </td>
                            </tr>
                          );
                        }

                        if (selectedTable === 'cash') {
                          return (
                            <tr key={row.id || idx} style={{ background: rowBg, borderBottom: '1px solid var(--border-glass)' }}>
                              <td style={{ padding: '0.65rem 1rem' }}>{row.fecha || 'N/A'}</td>
                              <td style={{ padding: '0.65rem 1rem', fontWeight: 600 }}>{row.concepto || row.descripcion}</td>
                              <td style={{ padding: '0.65rem 1rem' }}>
                                <span style={{ padding: '2px 6px', borderRadius: '6px', fontSize: '0.72rem', background: row.tipo === 'INGRESO' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', color: row.tipo === 'INGRESO' ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                                  {row.tipo || 'MOVIMIENTO'}
                                </span>
                              </td>
                              <td style={{ padding: '0.65rem 1rem' }}>{row.metodo || row.banco || 'Caja Chica'}</td>
                              <td style={{ padding: '0.65rem 1rem', textAlign: 'right', fontWeight: 700, color: row.tipo === 'INGRESO' ? '#10b981' : '#ef4444' }}>
                                {formatUsd(Number(row.montoUsd || row.monto || 0))}
                              </td>
                            </tr>
                          );
                        }

                        return null;
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 2.5: EXPLORADOR MULTI-BASE DE DATOS (26 BDS PROFIT PLUS)   */}
          {/* ============================================================== */}
          {activeTab === 'profit-databases' && (
            <div style={{ height: '100%', overflowY: 'auto' }}>
              <MultiDatabaseExplorerView
                currentUser={currentUser}
                theme={isDark ? 'dark' : 'light'}
              />
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 3: CONSOLA DE API & JSON                                   */}
          {/* ============================================================== */}
          {activeTab === 'api' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
              {/* Barra de Petición HTTP */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.75rem',
                  borderRadius: '12px',
                  background: isDark ? 'rgba(255, 255, 255, 0.03)' : '#f8fafc',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 43, 122, 0.1)'
                }}
              >
                <span
                  style={{
                    padding: '0.4rem 0.75rem',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                    background: '#10b981',
                    color: '#fff'
                  }}
                >
                  GET
                </span>

                <select
                  value={apiEndpoint}
                  onChange={(e) => {
                    setApiEndpoint(e.target.value);
                    executeApiQuery(e.target.value);
                  }}
                  style={{
                    background: isDark ? '#0c1427' : '#ffffff',
                    border: '1px solid var(--border-glass)',
                    borderRadius: '6px',
                    padding: '0.45rem 0.75rem',
                    color: 'var(--text-primary)',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    fontFamily: 'monospace',
                    flex: 1,
                    outline: 'none'
                  }}
                >
                  <option value="/api/profit/status">/api/profit/status (Estado y KPIs del Servidor)</option>
                  <option value="/api/profit/products">/api/profit/products (Catálogo de Lubricantes en Vivo)</option>
                  <option value="/api/profit/clients">/api/profit/clients (Cartera de Clientes en Vivo)</option>
                </select>

                <button
                  onClick={() => executeApiQuery(apiEndpoint)}
                  disabled={apiLoading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '0.45rem 1rem',
                    borderRadius: '6px',
                    fontSize: '0.82rem',
                    fontWeight: 700,
                    background: '#0284c7',
                    border: 'none',
                    color: '#fff',
                    cursor: apiLoading ? 'not-allowed' : 'pointer'
                  }}
                >
                  <RefreshCw size={13} className={apiLoading ? 'spin-animation' : ''} />
                  <span>{apiLoading ? 'Consultando...' : 'Enviar Request'}</span>
                </button>
              </div>

              {/* Status Header de la Respuesta */}
              {apiResponse && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '6px',
                        fontWeight: 700,
                        background: apiResponse.success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        color: apiResponse.success ? '#10b981' : '#ef4444',
                        border: `1px solid ${apiResponse.success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                      }}
                    >
                      Status: {apiResponse.status} {apiResponse.statusText}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      Latencia: <strong>{apiResponse.timeMs} ms</strong>
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      {apiResponse.url}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => copyToClipboard(JSON.stringify(apiResponse.data || apiResponse, null, 2))}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '0.35rem 0.75rem',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        background: isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0',
                        border: '1px solid var(--border-glass)',
                        color: 'var(--text-primary)',
                        cursor: 'pointer'
                      }}
                    >
                      {copiedJson ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
                      <span>{copiedJson ? '¡Copiado!' : 'Copiar JSON'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Visor de Código JSON */}
              <div
                style={{
                  flex: 1,
                  background: '#030712',
                  border: isDark ? '1px solid rgba(56, 189, 248, 0.2)' : '1px solid #cbd5e1',
                  borderRadius: '12px',
                  padding: '1rem',
                  overflow: 'auto',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.8rem',
                  color: '#38bdf8',
                  maxHeight: '440px'
                }}
              >
                {apiLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
                    <RefreshCw size={20} className="spin-animation" style={{ marginRight: '8px' }} />
                    Consultando servidor...
                  </div>
                ) : (
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {JSON.stringify(apiResponse?.data || apiResponse, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 4: SINCRONIZACIÓN & RESPALDO                               */}
          {/* ============================================================== */}
          {activeTab === 'sync' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Tarjeta de Acción Inmediata */}
              <div
                style={{
                  background: isDark
                    ? 'linear-gradient(135deg, rgba(2, 132, 199, 0.15) 0%, rgba(15, 23, 42, 0.6) 100%)'
                    : '#f0f9ff',
                  border: isDark ? '1px solid rgba(2, 132, 199, 0.3)' : '1px solid #bae6fd',
                  borderRadius: '14px',
                  padding: '1.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem'
                }}
              >
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: isDark ? '#f8fafc' : '#0369a1' }}>
                    Sincronización Total Profit Plus ↔ Supabase Cloud
                  </h3>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Descarga en tiempo real los 21 módulos: Artículos, Clientes, Facturas, Pedidos, Bancos, Proveedores, CxP, etc.
                  </div>
                </div>

                <button
                  onClick={handleTriggerSync}
                  disabled={syncing}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '0.75rem 1.5rem',
                    borderRadius: '10px',
                    fontSize: '0.9rem',
                    fontWeight: 800,
                    background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    border: 'none',
                    color: '#fff',
                    boxShadow: '0 4px 15px rgba(2, 132, 199, 0.4)',
                    cursor: syncing ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <RefreshCw size={16} className={syncing ? 'spin-animation' : ''} />
                  <span>{syncing ? 'Sincronizando Todo...' : 'Sincronizar Ahora'}</span>
                </button>
              </div>

              {/* Mensajes de Resultado */}
              {syncResult && (
                <div
                  style={{
                    background: isDark ? 'rgba(16, 185, 129, 0.15)' : '#d1fae5',
                    border: '1px solid #10b981',
                    borderRadius: '12px',
                    padding: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    color: isDark ? '#86efac' : '#065f46'
                  }}
                >
                  <CheckCircle2 size={24} color="#10b981" />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>¡Sincronización completada con éxito! ({syncResult.time})</div>
                    <div style={{ fontSize: '0.8rem', marginTop: '2px' }}>
                      Se actualizaron {syncResult.articles} lubricantes, {syncResult.clients} clientes y {syncResult.orders} pedidos en la base de datos de SIGNUM.
                    </div>
                  </div>
                </div>
              )}

              {syncError && (
                <div
                  style={{
                    background: isDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
                    border: '1px solid #ef4444',
                    borderRadius: '12px',
                    padding: '1rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    color: isDark ? '#fca5a5' : '#991b1b'
                  }}
                >
                  <AlertCircle size={24} color="#ef4444" />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Aviso de Sincronización</div>
                    <div style={{ fontSize: '0.8rem', marginTop: '2px' }}>{syncError}</div>
                  </div>
                </div>
              )}

              {/* Métricas Estadísticas de Última Sincronización */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                <div style={{ background: isDark ? 'rgba(255, 255, 255, 0.03)' : '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Lubricantes Sincronizados</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0284c7', marginTop: '4px' }}>
                    {products.length}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#10b981' }}>Catálogo OILSTONE ®</div>
                </div>

                <div style={{ background: isDark ? 'rgba(255, 255, 255, 0.03)' : '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Clientes en Cartera</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#10b981', marginTop: '4px' }}>
                    {clients.length}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#10b981' }}>Activos en Profit Plus</div>
                </div>

                <div style={{ background: isDark ? 'rgba(255, 255, 255, 0.03)' : '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Pedidos Preventa</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#f59e0b', marginTop: '4px' }}>
                    {orders.length}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#f59e0b' }}>En tránsito / confirmados</div>
                </div>

                <div style={{ background: isDark ? 'rgba(255, 255, 255, 0.03)' : '#f8fafc', padding: '1rem', borderRadius: '12px', border: '1px solid var(--border-glass)' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Última Actualización</div>
                  <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '8px' }}>
                    {serverStatus.lastSyncTime ? new Date(serverStatus.lastSyncTime).toLocaleTimeString() : 'Automática'}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Daemon en segundo plano</div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 5: MULTIMEDIA & SUPABASE STORAGE ('signum-media')          */}
          {/* ============================================================== */}
          {activeTab === 'storage' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%' }}>
              {/* Encabezado y Selector de Carpetas */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                  padding: '1rem',
                  borderRadius: '12px',
                  background: isDark ? 'rgba(255, 255, 255, 0.03)' : '#f8fafc',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 43, 122, 0.1)'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Folder size={18} color="#0284c7" />
                    <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>
                      Almacenamiento Multimedia: <code>{STORAGE_BUCKET}</code>
                    </span>
                    <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontWeight: 700 }}>
                      PÚBLICO • FULL CRUD
                    </span>
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Imágenes de la aplicación organizadas por carpetas en la nube de Supabase.
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={() => loadFolderFiles(selectedStorageFolder)}
                    disabled={storageLoading}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '0.45rem 0.85rem',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      background: isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0',
                      border: 'none',
                      color: 'var(--text-primary)',
                      cursor: 'pointer'
                    }}
                  >
                    <RefreshCw size={13} className={storageLoading ? 'spin-animation' : ''} />
                    <span>Refrescar</span>
                  </button>

                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '0.45rem 0.95rem',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      fontWeight: 700,
                      background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                      color: '#fff',
                      cursor: uploadingToFolder ? 'not-allowed' : 'pointer',
                      boxShadow: '0 2px 8px rgba(2, 132, 199, 0.35)'
                    }}
                  >
                    <UploadCloud size={14} />
                    <span>{uploadingToFolder ? 'Subiendo...' : `Subir a /${selectedStorageFolder}`}</span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleStorageUpload}
                      disabled={uploadingToFolder}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
              </div>

              {/* Píldoras de Carpetas Oficiales */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {FOLDER_METADATA.map(folder => {
                  const isSelected = selectedStorageFolder === folder.id;
                  return (
                    <button
                      key={folder.id}
                      onClick={() => setSelectedStorageFolder(folder.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '0.5rem 0.85rem',
                        borderRadius: '8px',
                        fontSize: '0.8rem',
                        fontWeight: 700,
                        background: isSelected ? '#0284c7' : (isDark ? 'rgba(255, 255, 255, 0.05)' : '#e2e8f0'),
                        border: isSelected ? '1px solid #38bdf8' : '1px solid transparent',
                        color: isSelected ? '#fff' : 'var(--text-muted)',
                        cursor: 'pointer',
                        transition: 'all 0.15s'
                      }}
                      title={folder.description}
                    >
                      <span>{folder.icon}</span>
                      <span>{folder.name}</span>
                      <code style={{ fontSize: '0.7rem', opacity: 0.8 }}>({folder.id}/)</code>
                    </button>
                  );
                })}
              </div>

              {/* Lista y Grilla de Archivos de la Carpeta */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  borderRadius: '12px',
                  border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 43, 122, 0.1)',
                  background: isDark ? 'rgba(10, 16, 32, 0.6)' : '#ffffff',
                  padding: '1.25rem',
                  minHeight: '300px'
                }}
              >
                {storageLoading ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    <RefreshCw size={24} className="spin-animation" style={{ margin: '0 auto 10px auto' }} />
                    <div>Consultando archivos en <code>{selectedStorageFolder}/</code>...</div>
                  </div>
                ) : storageFiles.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    <ImageIcon size={36} color="var(--text-muted)" style={{ margin: '0 auto 10px auto', opacity: 0.5 }} />
                    <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>Carpeta vacía: <code>{selectedStorageFolder}/</code></div>
                    <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>
                      Puede subir imágenes usando el botón superior "Subir a /{selectedStorageFolder}" o directamente desde las vistas de Productos o Usuarios.
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
                    {storageFiles.map(file => (
                      <div
                        key={file.id || file.name}
                        style={{
                          borderRadius: '10px',
                          border: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid #e2e8f0',
                          background: isDark ? 'rgba(255, 255, 255, 0.02)' : '#f8fafc',
                          overflow: 'hidden',
                          display: 'flex',
                          flexDirection: 'column'
                        }}
                      >
                        {/* Vista Previa de la Imagen */}
                        <div
                          style={{
                            height: '140px',
                            background: '#030712',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflow: 'hidden',
                            position: 'relative'
                          }}
                        >
                          <img
                            src={file.publicUrl}
                            alt={file.name}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            onError={(e) => {
                              e.target.style.display = 'none';
                              e.target.parentNode.innerHTML = '<div style="font-size:2rem;">📄</div>';
                            }}
                          />
                        </div>

                        {/* Metadatos y Acciones */}
                        <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                          <div
                            style={{
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              wordBreak: 'break-all',
                              color: 'var(--text-primary)'
                            }}
                            title={file.name}
                          >
                            {file.name}
                          </div>

                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                            <span>{file.metadata?.size ? `${Math.round(file.metadata.size / 1024)} KB` : 'Archivo'}</span>
                            <span>{file.created_at ? new Date(file.created_at).toLocaleDateString() : ''}</span>
                          </div>

                          <div style={{ display: 'flex', gap: '6px', marginTop: 'auto', paddingTop: '6px' }}>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(file.publicUrl);
                                setCopiedUrl(file.name);
                                setTimeout(() => setCopiedUrl(null), 2000);
                              }}
                              style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '4px',
                                padding: '4px 6px',
                                borderRadius: '6px',
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                background: copiedUrl === file.name ? 'rgba(16, 185, 129, 0.2)' : (isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'),
                                border: 'none',
                                color: copiedUrl === file.name ? '#10b981' : 'var(--text-primary)',
                                cursor: 'pointer'
                              }}
                              title="Copiar URL pública del archivo"
                            >
                              {copiedUrl === file.name ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                              <span>{copiedUrl === file.name ? 'Copiada' : 'URL'}</span>
                            </button>

                            <a
                              href={file.publicUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                fontSize: '0.72rem',
                                background: isDark ? 'rgba(2, 132, 199, 0.2)' : '#e0f2fe',
                                border: 'none',
                                color: isDark ? '#38bdf8' : '#0369a1',
                                textDecoration: 'none'
                              }}
                              title="Abrir imagen en nueva pestaña"
                            >
                              <ExternalLink size={12} />
                            </a>

                            <button
                              onClick={() => handleStorageDelete(file.fullPath)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                fontSize: '0.72rem',
                                background: isDark ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2',
                                border: 'none',
                                color: '#ef4444',
                                cursor: 'pointer'
                              }}
                              title="Eliminar archivo del almacenamiento"
                            >
                              <Trash size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer con Acciones */}
        <div
          style={{
            padding: '1rem 1.5rem',
            background: isDark ? 'rgba(0, 0, 0, 0.35)' : '#f8fafc',
            borderTop: isDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 43, 122, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0
          }}
        >
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck size={14} color="#10b981" />
            <span>SIGNUM MOTORVEN Enterprise • Conector Oficial Profit Plus 2K8</span>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={onClose}
              style={{
                padding: '0.55rem 1.25rem',
                borderRadius: '8px',
                fontSize: '0.85rem',
                fontWeight: 600,
                background: isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0',
                border: '1px solid var(--border-glass)',
                color: 'var(--text-primary)',
                cursor: 'pointer'
              }}
            >
              Cerrar Explorador
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
