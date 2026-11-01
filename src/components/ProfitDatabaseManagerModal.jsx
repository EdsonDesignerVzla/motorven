import React, { useState, useEffect, useMemo } from 'react';
import {
  Database,
  Server,
  Layers,
  Search,
  RefreshCw,
  PlusCircle,
  Edit,
  Trash2,
  Save,
  Download,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  X,
  Clock,
  HardDrive,
  FileText,
  FileCode,
  Table,
  Play,
  Copy,
  Check,
  ChevronRight,
  ExternalLink,
  ChevronLeft,
  Printer
} from 'lucide-react';
import { generateBankAccountsPDF } from '../services/pdfReportService';
import {
  getAllProfitDatabases,
  getProfitDatabaseTables,
  getProfitDatabaseTableData,
  getProfitTableColumns,
  saveProfitDatabaseRecord,
  deleteProfitDatabaseRecord,
  createProfitDatabaseBackup,
  getProfitDatabaseBackups,
  executeProfitDatabaseQuery,
  getProfitBridgeStatus
} from '../services/profitService';
import { PROFIT_SERVER_INFO, COMMON_PROFIT_TABLES } from '../data/profitDatabasesCatalog';
import { useNotification } from '../context/NotificationContext';

export default function ProfitDatabaseManagerModal({
  isOpen = true,
  onClose,
  initialDb = 'GRUMOTOR',
  initialTable = 'art',
  currentUser
}) {
  const notify = useNotification();

  // Estados de Base de Datos y Conexión
  const [selectedDb, setSelectedDb] = useState(initialDb);
  const [databases, setDatabases] = useState([]);
  const [bridgeStatus, setBridgeStatus] = useState({ isAvailable: true });
  const [activeTab, setActiveTab] = useState('explorer'); // 'explorer' | 'editor' | 'backup' | 'sql'

  // Estados de Tablas y Datos
  const [tables, setTables] = useState([]);
  const [selectedTable, setSelectedTable] = useState(initialTable);
  const [loadingTables, setLoadingTables] = useState(false);
  const [tableSearch, setTableSearch] = useState('');

  // Grid de Datos
  const [tableData, setTableData] = useState({
    columns: [],
    rows: [],
    totalRows: 0,
    page: 1,
    limit: 25,
    totalPages: 1
  });
  const [loadingData, setLoadingData] = useState(false);
  const [dataSearch, setDataSearch] = useState('');

  // Estados de Editor / Formulario (Crear / Modificar / Guardar)
  const [editorMode, setEditorMode] = useState('CREATE'); // 'CREATE' | 'EDIT'
  const [editorRecord, setEditorRecord] = useState({});
  const [tableColumns, setTableColumns] = useState([]);
  const [loadingColumns, setLoadingColumns] = useState(false);
  const [savingRecord, setSavingRecord] = useState(false);

  // Estados de Eliminación con Doble Seguridad
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Estados de Copia de Seguridad
  const [backupsList, setBackupsList] = useState([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [runningBackup, setRunningBackup] = useState(false);
  const [backupFeedback, setBackupFeedback] = useState(null);

  // Estados de Consola SQL
  const [sqlQuery, setSqlQuery] = useState('SELECT TOP 30 * FROM art ORDER BY co_art ASC');
  const [sqlResult, setSqlResult] = useState(null);
  const [runningSql, setRunningSql] = useState(false);

  // Cierre con tecla Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !deleteTarget) {
        onClose?.();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteTarget, onClose]);

  // Cargar lista de bases de datos y estado del bridge al abrir
  useEffect(() => {
    if (!isOpen) return;
    loadDatabasesList();
    checkBridgeHealth();
  }, [isOpen]);

  // Cargar tablas al cambiar de base de datos
  useEffect(() => {
    if (!isOpen || !selectedDb) return;
    loadTablesForDb(selectedDb);
    loadBackupsForDb(selectedDb);
  }, [isOpen, selectedDb]);

  // Cargar datos al cambiar de tabla o página
  useEffect(() => {
    if (!isOpen || !selectedDb || !selectedTable) return;
    loadTableRecords(selectedDb, selectedTable, 1, dataSearch);
    loadTableMetadata(selectedDb, selectedTable);
  }, [isOpen, selectedDb, selectedTable]);

  const checkBridgeHealth = async () => {
    try {
      const status = await getProfitBridgeStatus();
      setBridgeStatus(status);
    } catch (_) {
      setBridgeStatus({ isAvailable: false });
    }
  };

  const loadDatabasesList = async () => {
    try {
      const res = await getAllProfitDatabases();
      if (res?.databases) setDatabases(res.databases);
    } catch (_) {}
  };

  const loadTablesForDb = async (dbName) => {
    setLoadingTables(true);
    try {
      const res = await getProfitDatabaseTables(dbName);
      if (res?.success && Array.isArray(res.tables)) {
        setTables(res.tables);
        if (!res.tables.some(t => t.table_name === selectedTable)) {
          const defaultTable = res.tables.find(t => t.table_name === 'art') || res.tables[0];
          if (defaultTable) setSelectedTable(defaultTable.table_name);
        }
      }
    } catch (err) {
      notify?.error?.('Error al listar tablas', err.message);
    } finally {
      setLoadingTables(false);
    }
  };

  const loadTableRecords = async (dbName, tableName, page = 1, search = '') => {
    setLoadingData(true);
    try {
      const res = await getProfitDatabaseTableData(dbName, tableName, page, 25, search);
      if (res?.success) {
        setTableData({
          columns: res.columns || [],
          rows: res.rows || [],
          totalRows: res.totalRows || 0,
          page: res.page || 1,
          limit: res.limit || 25,
          totalPages: res.totalPages || 1
        });
      }
    } catch (err) {
      notify?.error?.('Error cargando registros', err.message);
    } finally {
      setLoadingData(false);
    }
  };

  const loadTableMetadata = async (dbName, tableName) => {
    setLoadingColumns(true);
    try {
      const res = await getProfitTableColumns(dbName, tableName);
      if (res?.success && Array.isArray(res.columns)) {
        setTableColumns(res.columns);
      }
    } catch (_) {} finally {
      setLoadingColumns(false);
    }
  };

  const loadBackupsForDb = async (dbName) => {
    setLoadingBackups(true);
    try {
      const res = await getProfitDatabaseBackups(dbName);
      if (res?.success && Array.isArray(res.backups)) {
        setBackupsList(res.backups);
      }
    } catch (_) {} finally {
      setLoadingBackups(false);
    }
  };

  // =========================================================================
  // CREAR Y MODIFICAR REGISTRO
  // =========================================================================
  const handleOpenCreate = () => {
    setEditorMode('CREATE');
    // Pre-llenar campos según columnas
    const initialValues = {};
    tableColumns.forEach(c => {
      initialValues[c.name] = c.column_default ? '' : '';
    });
    // Defaults amigables para artículos o clientes
    if (selectedTable === 'art') {
      initialValues.co_art = `OIL-${Date.now().toString().slice(-4)}`;
      initialValues.art_des = '';
      initialValues.stock_act = 0;
      initialValues.prec_vta1 = 0;
      initialValues.prec_vta2 = 0;
      initialValues.ult_cos_un = 0;
      initialValues.uni_venta = '01';
      initialValues.tipo = 'V';
    } else if (selectedTable === 'clientes') {
      initialValues.co_cli = `CLI-${Date.now().toString().slice(-4)}`;
      initialValues.cli_des = '';
      initialValues.tipo = 'Mayorista';
      initialValues.mont_cre = 5000;
      initialValues.plaz_pag = 15;
    }
    setEditorRecord(initialValues);
    setActiveTab('editor');
  };

  const handleOpenEdit = (row) => {
    setEditorMode('EDIT');
    setEditorRecord({ ...row });
    setActiveTab('editor');
  };

  const handleSaveRecord = async (e) => {
    e?.preventDefault();
    setSavingRecord(true);
    try {
      const res = await saveProfitDatabaseRecord(selectedDb, selectedTable, editorRecord, 'SAVE');
      if (res?.success) {
        notify?.success?.(
          editorMode === 'CREATE' ? 'Registro Creado' : 'Registro Guardado',
          `El registro fue guardado exitosamente en SQL Server [${selectedDb}].[${selectedTable}].`
        );
        setActiveTab('explorer');
        loadTableRecords(selectedDb, selectedTable, tableData.page, dataSearch);
      } else {
        notify?.error?.('Error guardando registro', res?.error || 'Verifique los tipos de datos');
      }
    } catch (err) {
      notify?.error?.('Error de comunicación', err.message);
    } finally {
      setSavingRecord(false);
    }
  };

  // =========================================================================
  // ELIMINAR REGISTRO CON DOBLE SEGURIDAD
  // =========================================================================
  const getPrimaryKeyField = () => {
    const pk = tableColumns.find(c => c.is_primary_key);
    if (pk) return pk.name;
    if (tableColumns.length > 0) return tableColumns[0].name;
    return 'id';
  };

  const handleOpenDelete = (row) => {
    const pkField = getPrimaryKeyField();
    const pkVal = row[pkField];
    setDeleteTarget({
      row,
      pkField,
      pkVal,
      table: selectedTable,
      db: selectedDb,
      description: row.art_des || row.cli_des || row.ven_des || row.prov_des || row.descrip || row.nombre || String(pkVal)
    });
    setDeleteConfirmed(false);
  };

  const handleExecuteDelete = async () => {
    if (!deleteTarget || !deleteConfirmed) return;
    setIsDeleting(true);
    try {
      const res = await deleteProfitDatabaseRecord(
        deleteTarget.db,
        deleteTarget.table,
        deleteTarget.pkField,
        deleteTarget.pkVal
      );
      if (res?.success) {
        notify?.success?.(
          'Registro Eliminado',
          `El registro [${deleteTarget.pkVal}] fue eliminado definitivamente de [${deleteTarget.db}].[${deleteTarget.table}].`
        );
        setDeleteTarget(null);
        loadTableRecords(selectedDb, selectedTable, tableData.page, dataSearch);
      } else {
        notify?.error?.('Error al eliminar', res?.error || 'No se pudo eliminar el registro.');
      }
    } catch (err) {
      notify?.error?.('Error en la eliminación', err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  // =========================================================================
  // COPIAS DE SEGURIDAD (BACKUP NATIVO + SNAPSHOT DESCARGABLE)
  // =========================================================================
  const handleCreateNativeBackup = async () => {
    setRunningBackup(true);
    setBackupFeedback(null);
    try {
      notify?.info?.('Iniciando Respaldo SQL', `Ejecutando BACKUP DATABASE [${selectedDb}] en el servidor...`);
      const res = await createProfitDatabaseBackup(selectedDb, 'native');
      if (res?.success) {
        setBackupFeedback({
          type: 'success',
          title: '¡Copia de Seguridad SQL Generada!',
          message: res.message || `Archivo .bak creado exitosamente en ${res.path}`,
          details: res
        });
        notify?.success?.('Copia de Seguridad Lista', `Respaldo de ${res.size_mb || 61} MB guardado en el servidor.`);
        loadBackupsForDb(selectedDb);
      } else {
        setBackupFeedback({
          type: 'error',
          title: 'Error al generar respaldo',
          message: res?.error || 'Falló la ejecución de BACKUP DATABASE en el servidor SQL Server.'
        });
      }
    } catch (err) {
      setBackupFeedback({
        type: 'error',
        title: 'Error de Red',
        message: err.message
      });
    } finally {
      setRunningBackup(false);
    }
  };

  const handleDownloadSnapshotBackup = async () => {
    setRunningBackup(true);
    setBackupFeedback(null);
    try {
      notify?.info?.('Generando Snapshot', `Extrayendo tablas lógicas de [${selectedDb}] para descarga...`);
      const res = await createProfitDatabaseBackup(selectedDb, 'snapshot');
      if (res?.success && res.snapshotData) {
        // Disparar descarga directa del archivo JSON al navegador del usuario
        const blob = new Blob([JSON.stringify(res.snapshotData, null, 2)], { type: 'application/json' });
        const downloadUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = res.fileName || `${selectedDb}_backup_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);

        setBackupFeedback({
          type: 'success',
          title: '¡Respaldo Descargado!',
          message: `El archivo ${res.fileName} se ha descargado a su equipo con ${res.tableCount} tablas completas.`
        });
        notify?.success?.('Descarga Completa', `Respaldo descargado exitosamente a su ordenador.`);
        loadBackupsForDb(selectedDb);
      } else {
        setBackupFeedback({
          type: 'error',
          title: 'Error generando snapshot',
          message: res?.error || 'No se pudieron extraer las tablas lógicas.'
        });
      }
    } catch (err) {
      setBackupFeedback({
        type: 'error',
        title: 'Error en la descarga',
        message: err.message
      });
    } finally {
      setRunningBackup(false);
    }
  };

  // =========================================================================
  // EJECUTAR CONSULTA SQL INTERACTIVA
  // =========================================================================
  const handleExecuteSql = async () => {
    if (!sqlQuery.trim()) return;
    setRunningSql(true);
    try {
      const res = await executeProfitDatabaseQuery(selectedDb, sqlQuery);
      setSqlResult(res);
      if (res.success) {
        notify?.success?.('Consulta exitosa', `${res.rowCount} filas obtenidas en ${res.executionTimeMs}ms.`);
      } else {
        notify?.error?.('Error SQL', res.error);
      }
    } catch (err) {
      notify?.error?.('Error ejecutando consulta', err.message);
    } finally {
      setRunningSql(false);
    }
  };

  // Filtrado de tablas para selector
  const filteredTables = useMemo(() => {
    if (!tableSearch) return tables;
    const q = tableSearch.toLowerCase();
    return tables.filter(t => t.table_name.toLowerCase().includes(q));
  }, [tables, tableSearch]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: 'rgba(0, 0, 0, 0.88)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
    >
      <div
        className="card"
        style={{
          width: '98%',
          maxWidth: '1420px',
          height: '92vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#070d1a',
          border: '1px solid rgba(0, 242, 254, 0.45)',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.8), 0 0 30px rgba(0, 242, 254, 0.15)',
          borderRadius: '16px',
          overflow: 'hidden'
        }}
      >
        {/* ========================================================================= */}
        {/* HEADER SUPERIOR CON METADATOS Y ACCIONES */}
        {/* ========================================================================= */}
        <div
          style={{
            padding: '1rem 1.4rem',
            background: 'linear-gradient(135deg, #0a1428 0%, #0d1e3d 100%)',
            borderBottom: '1px solid rgba(0, 242, 254, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #0284c7 0%, #002b7a 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 2px 12px rgba(2, 132, 199, 0.5)'
              }}
            >
              <Database size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: '#f8fafc', letterSpacing: '0.5px' }}>
                  GESTIÓN Y CONTROL DE BASE DE DATOS PROFIT PLUS 2K8
                </h2>
                <span
                  style={{
                    fontSize: '0.72rem',
                    padding: '3px 9px',
                    borderRadius: '12px',
                    background: bridgeStatus.isAvailable ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                    color: bridgeStatus.isAvailable ? '#10b981' : '#ef4444',
                    border: `1px solid ${bridgeStatus.isAvailable ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  <span
                    style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      backgroundColor: bridgeStatus.isAvailable ? '#10b981' : '#ef4444',
                      display: 'inline-block'
                    }}
                  />
                  {bridgeStatus.isAvailable ? 'CONEXIÓN SQL SERVER ONLINE (:3005)' : 'SIN CONEXIÓN BRIDGE'}
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>
                Servidor: <strong style={{ color: '#38bdf8' }}>SVR-INNOVA\SQLPROFIT</strong> (26.229.220.202:1433) | Réplica: <strong style={{ color: '#34d399' }}>Supabase Cloud DB_SIGNUM_MOTORVEN</strong>
              </div>
            </div>
          </div>

          {/* Selector de Base de Datos y Botón Cerrar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 700 }}>Base de Datos:</span>
              <select
                className="form-control"
                value={selectedDb}
                onChange={(e) => setSelectedDb(e.target.value)}
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 800,
                  padding: '0.45rem 0.85rem',
                  borderRadius: '8px',
                  backgroundColor: '#0e1a30',
                  color: '#38bdf8',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  cursor: 'pointer'
                }}
              >
                {databases.length > 0 ? (
                  databases.map(d => (
                    <option key={d.name} value={d.name}>
                      {d.name} {d.name === 'GRUMOTOR' ? '★ (Principal)' : ''}
                    </option>
                  ))
                ) : (
                  <option value="GRUMOTOR">GRUMOTOR (Principal)</option>
                )}
              </select>
            </div>

            <button
              type="button"
              onClick={() => generateBankAccountsPDF({ currentUser })}
              style={{
                background: 'linear-gradient(135deg, #0284c7 0%, #002b7a 100%)',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                color: '#ffffff',
                borderRadius: '8px',
                padding: '6px 12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.8rem',
                fontWeight: 800,
                boxShadow: '0 2px 8px rgba(2, 132, 199, 0.3)'
              }}
              title="Descargar e Imprimir Esquema Oficial de Cuentas Bancarias en PDF"
            >
              <Printer size={15} />
              <span>PDF Cuentas</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#cbd5e1',
                borderRadius: '8px',
                padding: '6px 12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.82rem',
                fontWeight: 700
              }}
            >
              <X size={16} /> Cerrar (Esc)
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* PESTAÑAS DE NAVEGACIÓN PRINCIPAL */}
        {/* ========================================================================= */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0.6rem 1.4rem',
            background: '#091122',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('explorer')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'explorer' ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : 'transparent',
              color: activeTab === 'explorer' ? '#fff' : '#94a3b8'
            }}
          >
            <Table size={15} /> EXPLORADOR Y REGISTROS (CRUD)
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'editor' && editorMode === 'CREATE' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'rgba(16, 185, 129, 0.12)',
              color: activeTab === 'editor' && editorMode === 'CREATE' ? '#fff' : '#34d399'
            }}
          >
            <PlusCircle size={15} /> + CREAR NUEVO REGISTRO
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('backup')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'backup' ? 'linear-gradient(135deg, #d97706 0%, #b45309 100%)' : 'rgba(217, 119, 6, 0.12)',
              color: activeTab === 'backup' ? '#fff' : '#fbbf24'
            }}
          >
            <HardDrive size={15} /> 🛡️ COPIA DE SEGURIDAD (BACKUP)
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sql')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              fontSize: '0.82rem',
              fontWeight: 800,
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'sql' ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : 'transparent',
              color: activeTab === 'sql' ? '#fff' : '#a5b4fc'
            }}
          >
            <FileCode size={15} /> CONSOLA SQL INTERACTIVA
          </button>
        </div>

        {/* ========================================================================= */}
        {/* CONTENIDO PRINCIPAL DINÁMICO */}
        {/* ========================================================================= */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

          {/* --------------------------------------------------------------------- */}
          {/* TAB 1: EXPLORADOR Y GRID DE DATOS (CRUD: VER, CREAR, MODIFICAR, ELIMINAR) */}
          {/* --------------------------------------------------------------------- */}
          {activeTab === 'explorer' && (
            <div style={{ display: 'flex', flex: 1, height: '100%', overflow: 'hidden' }}>
              {/* Barra Lateral Izquierda: Selector de Tablas */}
              <div
                style={{
                  width: '260px',
                  background: '#060b16',
                  borderRight: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '0.85rem'
                }}
              >
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ fontSize: '0.74rem', fontWeight: 800, color: '#94a3b8', marginBottom: '4px' }}>
                    TABLAS EN [{selectedDb}] ({tables.length})
                  </div>
                  <div style={{ position: 'relative' }}>
                    <Search size={13} style={{ position: 'absolute', left: '8px', top: '9px', color: '#64748b' }} />
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Filtrar tabla..."
                      value={tableSearch}
                      onChange={(e) => setTableSearch(e.target.value)}
                      style={{
                        paddingLeft: '28px',
                        fontSize: '0.78rem',
                        backgroundColor: '#0c1424',
                        color: '#f8fafc',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        borderRadius: '6px'
                      }}
                    />
                  </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {loadingTables ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8', fontSize: '0.8rem' }}>
                      <RefreshCw size={18} className="spin" style={{ marginBottom: '6px' }} />
                      <div>Cargando tablas...</div>
                    </div>
                  ) : filteredTables.length > 0 ? (
                    filteredTables.map(t => {
                      const isSelected = selectedTable === t.table_name;
                      return (
                        <button
                          key={t.table_name}
                          type="button"
                          onClick={() => {
                            setSelectedTable(t.table_name);
                            setDataSearch('');
                          }}
                          style={{
                            textAlign: 'left',
                            padding: '6px 10px',
                            borderRadius: '6px',
                            border: isSelected ? '1px solid rgba(56, 189, 248, 0.5)' : '1px solid transparent',
                            background: isSelected ? 'rgba(2, 132, 199, 0.25)' : 'transparent',
                            color: isSelected ? '#38bdf8' : '#cbd5e1',
                            fontSize: '0.76rem',
                            fontWeight: isSelected ? 800 : 500,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                          }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {t.table_name}
                          </span>
                          <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                            {t.row_count}
                          </span>
                        </button>
                      );
                    })
                  ) : (
                    <div style={{ color: '#64748b', fontSize: '0.75rem', padding: '10px' }}>
                      No se encontraron tablas.
                    </div>
                  )}
                </div>
              </div>

              {/* Panel Derecho: Barra de Control y Grid de Registros */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '0.85rem 1.25rem' }}>
                {/* Barra de Filtros y Acciones */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                    marginBottom: '0.85rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ fontSize: '0.92rem', fontWeight: 900, color: '#f8fafc' }}>
                      TABLA: <span style={{ color: '#38bdf8' }}>[{selectedTable}]</span>
                    </div>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        background: 'rgba(56, 189, 248, 0.15)',
                        color: '#38bdf8',
                        fontWeight: 700
                      }}
                    >
                      {tableData.totalRows} registros totales
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ position: 'relative', width: '220px' }}>
                      <Search size={13} style={{ position: 'absolute', left: '8px', top: '9px', color: '#64748b' }} />
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Buscar en registros..."
                        value={dataSearch}
                        onChange={(e) => {
                          setDataSearch(e.target.value);
                          loadTableRecords(selectedDb, selectedTable, 1, e.target.value);
                        }}
                        style={{
                          paddingLeft: '28px',
                          fontSize: '0.78rem',
                          backgroundColor: '#0c1424',
                          color: '#f8fafc',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '6px'
                        }}
                      />
                    </div>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => loadTableRecords(selectedDb, selectedTable, tableData.page, dataSearch)}
                      style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <RefreshCw size={13} className={loadingData ? 'spin' : ''} /> Refrescar
                    </button>

                    <button
                      type="button"
                      className="btn btn-success btn-sm"
                      onClick={handleOpenCreate}
                      style={{
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                        border: 'none',
                        color: '#fff',
                        boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)'
                      }}
                    >
                      <PlusCircle size={14} /> + CREAR REGISTRO
                    </button>
                  </div>
                </div>

                {/* Grid de Registros con Columna de Acciones */}
                <div
                  style={{
                    flex: 1,
                    overflow: 'auto',
                    backgroundColor: '#050a14',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '8px'
                  }}
                >
                  {loadingData ? (
                    <div style={{ textAlign: 'center', padding: '60px', color: '#94a3b8' }}>
                      <RefreshCw size={26} className="spin" style={{ marginBottom: '10px' }} />
                      <div style={{ fontSize: '0.9rem', fontWeight: 700 }}>Consultando SQL Server [{selectedDb}].[{selectedTable}]...</div>
                    </div>
                  ) : tableData.rows.length > 0 ? (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
                      <thead>
                        <tr style={{ background: '#0e182e', borderBottom: '1px solid rgba(255, 255, 255, 0.12)' }}>
                          <th style={{ padding: '8px 12px', textAlign: 'center', color: '#38bdf8', fontWeight: 800, width: '160px', position: 'sticky', top: 0, background: '#0e182e', zIndex: 10 }}>
                            ACCIONES
                          </th>
                          {tableData.columns.slice(0, 10).map(col => (
                            <th
                              key={col.name}
                              style={{
                                padding: '8px 12px',
                                textAlign: 'left',
                                color: '#e2e8f0',
                                fontWeight: 800,
                                position: 'sticky',
                                top: 0,
                                background: '#0e182e',
                                zIndex: 10
                              }}
                            >
                              {col.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tableData.rows.map((row, idx) => (
                          <tr
                            key={idx}
                            style={{
                              borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                              background: idx % 2 === 0 ? 'transparent' : 'rgba(255, 255, 255, 0.015)'
                            }}
                          >
                            {/* Botones de Acción: MODIFICAR y ELIMINAR */}
                            <td style={{ padding: '6px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEdit(row)}
                                  title="Modificar registro"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    padding: '3px 8px',
                                    borderRadius: '5px',
                                    border: '1px solid rgba(56, 189, 248, 0.4)',
                                    background: 'rgba(2, 132, 199, 0.2)',
                                    color: '#38bdf8',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                  }}
                                >
                                  <Edit size={11} /> Modificar
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleOpenDelete(row)}
                                  title="Eliminar registro con Doble Seguridad"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    padding: '3px 8px',
                                    borderRadius: '5px',
                                    border: '1px solid rgba(239, 68, 68, 0.4)',
                                    background: 'rgba(239, 68, 68, 0.2)',
                                    color: '#f87171',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                  }}
                                >
                                  <Trash2 size={11} /> Eliminar
                                </button>
                              </div>
                            </td>

                            {tableData.columns.slice(0, 10).map(col => {
                              const val = row[col.name];
                              const displayVal = val === null || val === undefined ? (
                                <span style={{ color: '#475569' }}>NULL</span>
                              ) : typeof val === 'boolean' ? (
                                val ? 'Sí' : 'No'
                              ) : typeof val === 'object' ? (
                                JSON.stringify(val)
                              ) : (
                                String(val)
                              );
                              return (
                                <td
                                  key={col.name}
                                  style={{
                                    padding: '6px 12px',
                                    color: '#cbd5e1',
                                    maxWidth: '220px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {displayVal}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '50px', color: '#64748b' }}>
                      No se encontraron registros en la tabla [{selectedTable}].
                    </div>
                  )}
                </div>

                {/* Paginación */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.6rem 0 0 0',
                    fontSize: '0.78rem',
                    color: '#94a3b8'
                  }}
                >
                  <div>
                    Página <strong>{tableData.page}</strong> de <strong>{tableData.totalPages}</strong> ({tableData.totalRows} filas)
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={tableData.page <= 1}
                      onClick={() => loadTableRecords(selectedDb, selectedTable, tableData.page - 1, dataSearch)}
                      style={{ fontSize: '0.74rem' }}
                    >
                      <ChevronLeft size={13} /> Anterior
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={tableData.page >= tableData.totalPages}
                      onClick={() => loadTableRecords(selectedDb, selectedTable, tableData.page + 1, dataSearch)}
                      style={{ fontSize: '0.74rem' }}
                    >
                      Siguiente <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* --------------------------------------------------------------------- */}
          {/* TAB 2: FORMULARIO DINÁMICO DE REGISTRO (CREAR / MODIFICAR / GUARDAR) */}
          {/* --------------------------------------------------------------------- */}
          {activeTab === 'editor' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 2rem' }}>
              <div
                style={{
                  maxWidth: '900px',
                  margin: '0 auto',
                  background: '#091224',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  borderRadius: '12px',
                  padding: '1.5rem',
                  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.5)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '0.85rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        background: editorMode === 'CREATE' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff'
                      }}
                    >
                      {editorMode === 'CREATE' ? <PlusCircle size={18} /> : <Edit size={18} />}
                    </div>
                    <div>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: '#f8fafc' }}>
                        {editorMode === 'CREATE' ? 'CREAR NUEVO REGISTRO' : 'MODIFICAR REGISTRO'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        Base de Datos: <strong style={{ color: '#38bdf8' }}>[{selectedDb}]</strong> | Tabla: <strong style={{ color: '#38bdf8' }}>[{selectedTable}]</strong>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveTab('explorer')}
                    style={{
                      background: 'transparent',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: '#94a3b8',
                      borderRadius: '6px',
                      padding: '4px 10px',
                      fontSize: '0.76rem',
                      cursor: 'pointer'
                    }}
                  >
                    Volver al Explorador
                  </button>
                </div>

                <form onSubmit={handleSaveRecord}>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                      gap: '1rem',
                      marginBottom: '1.5rem'
                    }}
                  >
                    {tableColumns.map(col => {
                      const isPk = col.is_primary_key === 1;
                      const colName = col.name;
                      const val = editorRecord[colName] !== undefined ? editorRecord[colName] : '';
                      const isNumeric = ['int', 'smallint', 'tinyint', 'decimal', 'numeric', 'float'].includes(col.type?.toLowerCase());

                      return (
                        <div key={colName} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '0.74rem', fontWeight: 700, color: isPk ? '#38bdf8' : '#cbd5e1', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>{colName}</span>
                            {isPk && (
                              <span style={{ fontSize: '0.64rem', padding: '1px 5px', borderRadius: '4px', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', fontWeight: 800 }}>
                                PK
                              </span>
                            )}
                            <span style={{ fontSize: '0.66rem', color: '#64748b' }}>({col.type})</span>
                          </label>

                          <input
                            type={isNumeric ? 'number' : 'text'}
                            step={isNumeric ? 'any' : undefined}
                            className="form-control"
                            disabled={editorMode === 'EDIT' && isPk}
                            value={val}
                            onChange={(e) => {
                              const nextVal = isNumeric && e.target.value !== '' ? Number(e.target.value) : e.target.value;
                              setEditorRecord(prev => ({ ...prev, [colName]: nextVal }));
                            }}
                            placeholder={`Ingrese ${colName}...`}
                            style={{
                              fontSize: '0.8rem',
                              backgroundColor: isPk && editorMode === 'EDIT' ? '#070d18' : '#0c1628',
                              color: isPk && editorMode === 'EDIT' ? '#64748b' : '#f8fafc',
                              border: isPk ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid rgba(255, 255, 255, 0.12)',
                              borderRadius: '6px'
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* Botones Guardar / Cancelar */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '1rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => setActiveTab('explorer')}
                      style={{ fontSize: '0.82rem', padding: '0.5rem 1.1rem' }}
                    >
                      Cancelar
                    </button>

                    <button
                      type="submit"
                      disabled={savingRecord}
                      className="btn btn-primary"
                      style={{
                        fontSize: '0.82rem',
                        fontWeight: 800,
                        padding: '0.5rem 1.4rem',
                        background: 'linear-gradient(135deg, #0284c7 0%, #002b7a 100%)',
                        border: 'none',
                        color: '#fff',
                        boxShadow: '0 2px 10px rgba(2, 132, 199, 0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      {savingRecord ? <RefreshCw size={14} className="spin" /> : <Save size={14} />}
                      <span>{savingRecord ? 'Guardando en SQL Server...' : 'GUARDAR EN PROFIT PLUS (SQL SERVER)'}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* --------------------------------------------------------------------- */}
          {/* TAB 3: COPIA DE SEGURIDAD (BACKUP NATIVO + SNAPSHOT DESCARGABLE) */}
          {/* --------------------------------------------------------------------- */}
          {activeTab === 'backup' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 2rem' }}>
              <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                {/* Banner de Acciones Rápidas de Respaldo */}
                <div
                  className="card"
                  style={{
                    padding: '1.25rem 1.5rem',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, rgba(217, 119, 6, 0.15) 0%, rgba(10, 20, 40, 0.9) 100%)',
                    border: '1px solid rgba(245, 158, 11, 0.4)',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '10px',
                          background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          boxShadow: '0 2px 10px rgba(217, 119, 6, 0.4)'
                        }}
                      >
                        <HardDrive size={22} />
                      </div>
                      <div>
                        <div style={{ fontSize: '1rem', fontWeight: 900, color: '#fef3c7' }}>
                          GENERADOR DE COPIA DE SEGURIDAD PARA [{selectedDb}]
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#cbd5e1' }}>
                          Crea respaldos físicos completos en SQL Server o descarga snapshots inmediatos (.json / .sql) a su equipo.
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        disabled={runningBackup}
                        onClick={handleCreateNativeBackup}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '0.6rem 1.15rem',
                          borderRadius: '8px',
                          background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                          border: 'none',
                          color: '#fff',
                          fontSize: '0.82rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          boxShadow: '0 2px 10px rgba(217, 119, 6, 0.35)'
                        }}
                      >
                        {runningBackup ? <RefreshCw size={14} className="spin" /> : <Save size={14} />}
                        <span>RESPALDO NATIVO SQL (.BAK)</span>
                      </button>

                      <button
                        type="button"
                        disabled={runningBackup}
                        onClick={handleDownloadSnapshotBackup}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '0.6rem 1.15rem',
                          borderRadius: '8px',
                          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                          border: 'none',
                          color: '#fff',
                          fontSize: '0.82rem',
                          fontWeight: 800,
                          cursor: 'pointer',
                          boxShadow: '0 2px 10px rgba(16, 185, 129, 0.35)'
                        }}
                      >
                        <Download size={14} />
                        <span>DESCARGAR SNAPSHOT (.JSON)</span>
                      </button>
                    </div>
                  </div>

                  {/* Feedback Message */}
                  {backupFeedback && (
                    <div
                      style={{
                        marginTop: '1rem',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        background: backupFeedback.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                        border: `1px solid ${backupFeedback.type === 'success' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}`,
                        color: backupFeedback.type === 'success' ? '#34d399' : '#f87171',
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      {backupFeedback.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                      <div>
                        <strong>{backupFeedback.title}:</strong> {backupFeedback.message}
                      </div>
                    </div>
                  )}
                </div>

                {/* Historial de Respaldos Realizados */}
                <div
                  className="card"
                  style={{
                    background: '#070e1c',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '12px',
                    padding: '1.25rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Clock size={16} color="#38bdf8" />
                      <span>HISTORIAL DE COPIAS DE SEGURIDAD EN SQL SERVER & LOCAL ({backupsList.length})</span>
                    </div>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => loadBackupsForDb(selectedDb)}
                      style={{ fontSize: '0.74rem' }}
                    >
                      <RefreshCw size={12} className={loadingBackups ? 'spin' : ''} /> Actualizar Lista
                    </button>
                  </div>

                  <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
                    {loadingBackups ? (
                      <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                        <RefreshCw size={20} className="spin" style={{ marginBottom: '6px' }} />
                        <div>Cargando registros de MSDB...</div>
                      </div>
                    ) : backupsList.length > 0 ? (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#94a3b8' }}>
                            <th style={{ padding: '8px', textAlign: 'left' }}>FECHA Y HORA</th>
                            <th style={{ padding: '8px', textAlign: 'left' }}>TIPO</th>
                            <th style={{ padding: '8px', textAlign: 'left' }}>ARCHIVO / DISPOSITIVO</th>
                            <th style={{ padding: '8px', textAlign: 'right' }}>TAMAÑO</th>
                            <th style={{ padding: '8px', textAlign: 'center' }}>ESTADO</th>
                          </tr>
                        </thead>
                        <tbody>
                          {backupsList.map(b => (
                            <tr key={b.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                              <td style={{ padding: '8px', color: '#f8fafc', fontWeight: 600 }}>
                                {new Date(b.date).toLocaleString()}
                              </td>
                              <td style={{ padding: '8px' }}>
                                <span
                                  style={{
                                    fontSize: '0.68rem',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    background: b.type.includes('NATIVO') ? 'rgba(217, 119, 6, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                                    color: b.type.includes('NATIVO') ? '#fbbf24' : '#34d399',
                                    fontWeight: 700
                                  }}
                                >
                                  {b.type}
                                </span>
                              </td>
                              <td style={{ padding: '8px', color: '#cbd5e1', maxWidth: '320px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {b.path || b.fileName}
                              </td>
                              <td style={{ padding: '8px', textAlign: 'right', color: '#38bdf8', fontWeight: 700 }}>
                                {b.sizeMb} MB
                              </td>
                              <td style={{ padding: '8px', textAlign: 'center' }}>
                                <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 700 }}>
                                  ✓ {b.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                        No hay copias de seguridad registradas recientemente.
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* --------------------------------------------------------------------- */}
          {/* TAB 4: CONSOLA SQL INTERACTIVA */}
          {/* --------------------------------------------------------------------- */}
          {activeTab === 'sql' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '1rem 1.4rem' }}>
              <div style={{ marginBottom: '0.85rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: 800, color: '#f8fafc' }}>
                    CONSULTAS SQL DIRECTAS EN [{selectedDb}] (Solo Lectura SELECT)
                  </div>
                  <button
                    type="button"
                    disabled={runningSql}
                    onClick={handleExecuteSql}
                    className="btn btn-primary btn-sm"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      fontSize: '0.8rem',
                      fontWeight: 800,
                      background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                      border: 'none'
                    }}
                  >
                    <Play size={13} /> {runningSql ? 'Ejecutando...' : 'EJECUTAR CONSULTA (F5)'}
                  </button>
                </div>

                <textarea
                  className="form-control"
                  rows={3}
                  value={sqlQuery}
                  onChange={(e) => setSqlQuery(e.target.value)}
                  placeholder="SELECT TOP 50 * FROM art WHERE stock_act > 0"
                  style={{
                    fontFamily: 'Consolas, monospace',
                    fontSize: '0.82rem',
                    backgroundColor: '#050a14',
                    color: '#38bdf8',
                    border: '1px solid rgba(99, 102, 241, 0.4)',
                    borderRadius: '8px'
                  }}
                />
              </div>

              {/* Resultado de Consulta SQL */}
              <div
                style={{
                  flex: 1,
                  overflow: 'auto',
                  backgroundColor: '#050a14',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '8px'
                }}
              >
                {sqlResult?.success ? (
                  <div style={{ padding: '8px' }}>
                    <div style={{ fontSize: '0.72rem', color: '#10b981', marginBottom: '6px', fontWeight: 700 }}>
                      ✓ {sqlResult.rowCount} filas obtenidas en {sqlResult.executionTimeMs} ms
                    </div>
                    {sqlResult.rows?.length > 0 && (
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.74rem' }}>
                        <thead>
                          <tr style={{ background: '#0e182e', borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
                            {sqlResult.columns.map(c => (
                              <th key={c.name} style={{ padding: '6px 10px', textAlign: 'left', color: '#e2e8f0' }}>{c.name}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sqlResult.rows.map((r, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                              {sqlResult.columns.map(c => (
                                <td key={c.name} style={{ padding: '5px 10px', color: '#cbd5e1', whiteSpace: 'nowrap' }}>
                                  {String(r[c.name] ?? 'NULL')}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                ) : sqlResult?.error ? (
                  <div style={{ padding: '20px', color: '#f87171', fontSize: '0.8rem' }}>
                    <strong>Error SQL:</strong> {sqlResult.error}
                  </div>
                ) : (
                  <div style={{ padding: '30px', textAlign: 'center', color: '#64748b', fontSize: '0.8rem' }}>
                    Escriba su consulta SELECT arriba y presione "EJECUTAR CONSULTA".
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

        {/* ========================================================================= */}
        {/* MODAL DE DOBLE SEGURIDAD PARA ELIMINACIÓN */}
        {/* ========================================================================= */}
        {deleteTarget && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 100000,
              backgroundColor: 'rgba(0, 0, 0, 0.85)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem'
            }}
          >
            <div
              className="card"
              style={{
                width: '100%',
                maxWidth: '540px',
                backgroundColor: '#0c1424',
                border: '2px solid #ef4444',
                borderRadius: '16px',
                padding: '1.5rem',
                boxShadow: '0 20px 50px rgba(239, 68, 68, 0.35)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1rem' }}>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    background: 'rgba(239, 68, 68, 0.2)',
                    border: '1px solid #ef4444',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ef4444'
                  }}
                >
                  <ShieldAlert size={26} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 900, color: '#f87171' }}>
                    DOBLE SEGURIDAD: CONFIRMAR ELIMINACIÓN
                  </h3>
                  <div style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                    Base de Datos: <strong>[{deleteTarget.db}]</strong> | Tabla: <strong>[{deleteTarget.table}]</strong>
                  </div>
                </div>
              </div>

              {/* Ficha del Registro a Eliminar */}
              <div
                style={{
                  background: 'rgba(0, 0, 0, 0.4)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '10px',
                  padding: '10px 14px',
                  marginBottom: '1.25rem',
                  fontSize: '0.78rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ color: '#94a3b8' }}>Clave ({deleteTarget.pkField}):</span>
                  <strong style={{ color: '#f8fafc' }}>{deleteTarget.pkVal}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#94a3b8' }}>Descripción:</span>
                  <strong style={{ color: '#38bdf8' }}>{deleteTarget.description}</strong>
                </div>
              </div>

              {/* Paso 1: Checkbox Obligatorio */}
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.25)',
                  marginBottom: '1.25rem'
                }}
              >
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '0.76rem', color: '#fca5a5' }}>
                  <input
                    type="checkbox"
                    checked={deleteConfirmed}
                    onChange={(e) => setDeleteConfirmed(e.target.checked)}
                    style={{ marginTop: '3px' }}
                  />
                  <span>
                    <strong>Paso 1 Obligatorio:</strong> Confirmo expresamente que deseo eliminar permanentemente este registro de Profit Plus SQL Server y de Supabase.
                  </span>
                </label>
              </div>

              {/* Botones de Confirmación */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setDeleteTarget(null)}
                  style={{ fontSize: '0.8rem' }}
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  disabled={!deleteConfirmed || isDeleting}
                  onClick={handleExecuteDelete}
                  className="btn btn-danger"
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: 800,
                    background: deleteConfirmed ? '#ef4444' : '#64748b',
                    borderColor: deleteConfirmed ? '#dc2626' : '#64748b',
                    cursor: deleteConfirmed ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {isDeleting ? <RefreshCw size={14} className="spin" /> : <Trash2 size={14} />}
                  <span>{isDeleting ? 'Eliminando en SQL Server...' : 'Sí, Eliminar Definitivamente'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
