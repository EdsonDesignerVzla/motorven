import React, { useState, useEffect, useMemo } from 'react';
import {
  Database,
  Server,
  Layers,
  Search,
  RefreshCw,
  Download,
  Copy,
  Check,
  Table,
  Filter,
  Play,
  FileText,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Clock,
  Key,
  Shield,
  Building2,
  HardDrive,
  ExternalLink,
  ChevronRight,
  Eye,
  Code2,
  X,
  FileCode,
  Sparkles,
  ArrowUpDown,
  Printer
} from 'lucide-react';
import {
  getAllProfitDatabases,
  getProfitDatabaseTables,
  getProfitDatabaseTableData,
  executeProfitDatabaseQuery
} from '../services/profitService';
import { PROFIT_SERVER_INFO, COMMON_PROFIT_TABLES } from '../data/profitDatabasesCatalog';
import { generateProfitDatabaseTablePDF } from '../services/pdfReportService';
import { useNotification } from '../context/NotificationContext';

export default function MultiDatabaseExplorerView({ currentUser, theme = 'dark' }) {
  const notify = useNotification();
  const isDark = theme === 'dark';

  // Estados de Servidor y Bases de Datos
  const [databases, setDatabases] = useState([]);
  const [loadingDbs, setLoadingDbs] = useState(true);
  const [dbSource, setDbSource] = useState('loading');
  const [selectedDb, setSelectedDb] = useState('GRUMOTOR');
  const [dbCategoryFilter, setDbCategoryFilter] = useState('all');
  const [dbSearch, setDbSearch] = useState('');

  // Estados del Explorador de Tablas
  const [tables, setTables] = useState([]);
  const [loadingTables, setLoadingTables] = useState(false);
  const [selectedTable, setSelectedTable] = useState('art');
  const [tableSearch, setTableSearch] = useState('');
  const [onlyNonEmptyTables, setOnlyNonEmptyTables] = useState(false);

  // Estados de Registros / Grid
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
  const [selectedRowDetail, setSelectedRowDetail] = useState(null);

  // Estados de la Consola SQL
  const [sqlTabActive, setSqlTabActive] = useState(false);
  const [sqlQuery, setSqlQuery] = useState('SELECT TOP 50 * FROM art ORDER BY co_art ASC');
  const [runningSql, setRunningSql] = useState(false);
  const [sqlResult, setSqlResult] = useState(null);

  // Estados de UI y Credenciales
  const [showCredentials, setShowCredentials] = useState(false);
  const [copiedKey, setCopiedKey] = useState(null);

  // 1. Cargar bases de datos al inicio
  useEffect(() => {
    loadDatabases();
  }, []);

  const loadDatabases = async (forceRefresh = false) => {
    setLoadingDbs(true);
    try {
      const res = await getAllProfitDatabases(forceRefresh);
      if (res && Array.isArray(res.databases)) {
        setDatabases(res.databases);
        setDbSource(res.source);
        if (!selectedDb && res.databases.length > 0) {
          setSelectedDb('GRUMOTOR');
        }
      }
    } catch (err) {
      notify?.error?.('Error cargando bases de datos', err.message);
    } finally {
      setLoadingDbs(false);
    }
  };

  // 2. Cargar tablas al cambiar de base de datos
  useEffect(() => {
    if (selectedDb) {
      loadTablesForDb(selectedDb);
    }
  }, [selectedDb]);

  const loadTablesForDb = async (dbName) => {
    setLoadingTables(true);
    try {
      const res = await getProfitDatabaseTables(dbName);
      if (res.success && Array.isArray(res.tables)) {
        setTables(res.tables);
        // Seleccionar automáticamente la primera tabla significativa
        const defaultTable = res.tables.find(t => t.table_name === 'art') ||
                             res.tables.find(t => t.table_name === 'clientes') ||
                             res.tables.find(t => t.table_name === 'cuentas') ||
                             res.tables.find(t => t.row_count > 0) ||
                             res.tables[0];
        if (defaultTable) {
          setSelectedTable(defaultTable.table_name);
        }
      } else {
        // En caso de que no haya conexión viva, usar tablas estándar de Profit
        setTables(COMMON_PROFIT_TABLES.map(t => ({ table_name: t.name, row_count: 0, column_count: 15 })));
        setSelectedTable('art');
      }
    } catch (_) {
      setTables(COMMON_PROFIT_TABLES.map(t => ({ table_name: t.name, row_count: 0, column_count: 15 })));
      setSelectedTable('art');
    } finally {
      setLoadingTables(false);
    }
  };

  // 3. Cargar datos al cambiar de tabla o página
  useEffect(() => {
    if (selectedDb && selectedTable && !sqlTabActive) {
      loadData(selectedDb, selectedTable, 1, tableData.limit, dataSearch);
    }
  }, [selectedDb, selectedTable, sqlTabActive]);

  const loadData = async (db, tbl, page = 1, limit = 25, search = '') => {
    setLoadingData(true);
    try {
      const res = await getProfitDatabaseTableData(db, tbl, page, limit, search);
      if (res.success) {
        setTableData({
          columns: res.columns || [],
          rows: res.rows || [],
          totalRows: res.totalRows || 0,
          page: res.page || 1,
          limit: res.limit || limit,
          totalPages: res.totalPages || 1
        });
      } else {
        setTableData({
          columns: [],
          rows: [],
          totalRows: 0,
          page: 1,
          limit,
          totalPages: 1,
          error: res.error
        });
      }
    } catch (err) {
      setTableData(prev => ({ ...prev, error: err.message, rows: [] }));
    } finally {
      setLoadingData(false);
    }
  };

  // Ejecutor SQL
  const handleExecuteSql = async () => {
    if (!sqlQuery.trim()) return;
    setRunningSql(true);
    try {
      const res = await executeProfitDatabaseQuery(selectedDb, sqlQuery);
      setSqlResult(res);
      if (res.success) {
        notify?.success?.(`Consulta ejecutada en ${res.executionTimeMs}ms (${res.rowCount} filas)`);
      } else {
        notify?.error?.('Error SQL', res.error);
      }
    } catch (err) {
      setSqlResult({ success: false, error: err.message });
      notify?.error?.('Fallo de ejecución', err.message);
    } finally {
      setRunningSql(false);
    }
  };

  // Copiar al portapapeles
  const handleCopy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
    notify?.info?.('Copiado', 'Texto copiado al portapapeles');
  };

  // Exportar a CSV
  const handleExportCsv = () => {
    const rows = sqlTabActive ? sqlResult?.rows : tableData.rows;
    if (!rows || rows.length === 0) {
      notify?.warning?.('Sin datos', 'No hay registros para exportar.');
      return;
    }
    const headers = Object.keys(rows[0]);
    const csvContent = [
      headers.join(';'),
      ...rows.map(r => headers.map(h => `"${String(r[h] ?? '').replace(/"/g, '""')}"`).join(';'))
    ].join('\r\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${selectedDb}_${selectedTable}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify?.success?.('Exportación exitosa', 'Archivo CSV descargado.');
  };

  // Exportar a JSON
  const handleExportJson = () => {
    const rows = sqlTabActive ? sqlResult?.rows : tableData.rows;
    if (!rows || rows.length === 0) {
      notify?.warning?.('Sin datos', 'No hay registros para exportar.');
      return;
    }
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${selectedDb}_${selectedTable}_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify?.success?.('Exportación exitosa', 'Archivo JSON generado.');
  };

  // Imprimir Tabla o Consulta en Formato PDF Oficial
  const handlePrintPdf = () => {
    const isSql = sqlTabActive;
    const rows = isSql ? sqlResult?.rows : tableData.rows;
    const columns = isSql ? sqlResult?.columns : tableData.columns;
    const tableName = isSql ? 'Consulta_SQL' : (selectedTable || 'Tabla_Profit');
    const totalRows = isSql ? (sqlResult?.rowCount || rows?.length) : (tableData.totalRows || rows?.length);

    if (!rows || rows.length === 0) {
      notify?.warning?.('Sin datos para imprimir', 'No hay registros disponibles en la tabla o consulta seleccionada.');
      return;
    }

    try {
      generateProfitDatabaseTablePDF({
        database: selectedDb,
        tableName,
        columns,
        rows,
        totalRows,
        filterQuery: isSql ? (sqlQuery.length > 50 ? sqlQuery.slice(0, 50) + '...' : sqlQuery) : dataSearch,
        currentUser
      });
      notify?.success?.('Reporte PDF Generado', `Se generó el documento oficial de [${tableName}] listo para imprimir.`);
    } catch (err) {
      notify?.error?.('Error al generar PDF', err.message);
    }
  };

  // Filtrado de Bases de Datos
  const filteredDatabases = useMemo(() => {
    return databases.filter(db => {
      const matchCat =
        dbCategoryFilter === 'all' ? true :
        dbCategoryFilter === 'admi' ? (db.module === 'ADMI' || db.type?.includes('Administrativo')) :
        dbCategoryFilter === 'cont' ? (db.module === 'CONT' || db.type?.includes('Contabilidad')) :
        dbCategoryFilter === 'nomi' ? (db.module === 'NOMI' || db.type?.includes('Nómina')) :
        dbCategoryFilter === 'maestra' ? (db.module === 'SISTEMA_PROFIT' || db.type?.includes('Maestra')) :
        dbCategoryFilter === 'sistema' ? (db.module === 'SISTEMA_SQL' || db.type?.includes('SQL Server')) : true;

      const q = dbSearch.toLowerCase().trim();
      const matchSearch = !q ? true : (
        db.name?.toLowerCase().includes(q) ||
        db.empresa?.toLowerCase().includes(q) ||
        db.rif?.toLowerCase().includes(q)
      );

      return matchCat && matchSearch;
    });
  }, [databases, dbCategoryFilter, dbSearch]);

  // Filtrado de Tablas
  const filteredTables = useMemo(() => {
    return tables.filter(t => {
      const q = tableSearch.toLowerCase().trim();
      const matchName = !q ? true : t.table_name?.toLowerCase().includes(q);
      const matchEmpty = onlyNonEmptyTables ? (t.row_count > 0) : true;
      return matchName && matchEmpty;
    });
  }, [tables, tableSearch, onlyNonEmptyTables]);

  const currentDbObj = useMemo(() => {
    return databases.find(d => d.name === selectedDb) || {
      name: selectedDb,
      type: 'Profit Administrativo',
      empresa: 'Grupo Motorven C.A.',
      size_mb: 671.6,
      tables: 217
    };
  }, [databases, selectedDb]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      padding: '20px',
      maxWidth: '1600px',
      margin: '0 auto',
      width: '100%'
    }}>

      {/* CABECERA HERO DEL MÓDULO */}
      <div style={{
        background: isDark
          ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 58, 138, 0.4) 100%)'
          : 'linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%)',
        border: '1px solid var(--border-glass)',
        borderRadius: '16px',
        padding: '20px 24px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 14px rgba(2, 132, 199, 0.4)'
            }}>
              <Database size={26} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.5px' }}>
                  Explorador Multi-Base de Datos Profit SQL Server
                </h1>
                <span style={{
                  padding: '3px 8px',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  background: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
                  26 BDs DETECTADAS
                </span>
              </div>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Acceso universal en tiempo real a todas las instancias administrativas, contables, nómina y maestras del servidor <strong style={{ color: '#38bdf8' }}>{PROFIT_SERVER_INFO.instance}</strong>
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowCredentials(!showCredentials)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 600,
                background: showCredentials ? 'rgba(56, 189, 248, 0.2)' : 'var(--bg-glass)',
                border: '1px solid var(--border-glass)',
                color: showCredentials ? '#38bdf8' : 'var(--text-main)',
                cursor: 'pointer'
              }}
            >
              <Key size={15} />
              <span>{showCredentials ? 'Ocultar Credenciales' : 'Ver Credenciales'}</span>
            </button>

            <button
              onClick={() => setSqlTabActive(!sqlTabActive)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 600,
                background: sqlTabActive ? 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)' : 'var(--bg-glass)',
                border: '1px solid var(--border-glass)',
                color: sqlTabActive ? '#ffffff' : 'var(--text-main)',
                cursor: 'pointer'
              }}
            >
              <Code2 size={15} />
              <span>Consola SQL</span>
            </button>

            <button
              onClick={() => loadDatabases(true)}
              disabled={loadingDbs}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '0.82rem',
                fontWeight: 600,
                background: 'var(--bg-glass)',
                border: '1px solid var(--border-glass)',
                color: 'var(--text-main)',
                cursor: 'pointer'
              }}
              title="Refrescar catálogo desde el servidor nativo"
            >
              <RefreshCw size={15} className={loadingDbs ? 'spin' : ''} />
              <span>Refrescar</span>
            </button>
          </div>
        </div>

        {/* PANEL DE CREDENCIALES DESPLEGABLE */}
        {showCredentials && (
          <div style={{
            marginTop: '16px',
            padding: '16px',
            borderRadius: '10px',
            background: isDark ? 'rgba(15, 23, 42, 0.85)' : '#f8fafc',
            border: '1px solid rgba(56, 189, 248, 0.35)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px',
            animation: 'fadeIn 0.2s ease-in-out'
          }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Host / IP (Radmin)</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#38bdf8' }}>{PROFIT_SERVER_INFO.host}</span>
                <button
                  onClick={() => handleCopy(PROFIT_SERVER_INFO.host, 'host')}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
                >
                  {copiedKey === 'host' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                </button>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Puerto SQL</div>
              <div style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
                {PROFIT_SERVER_INFO.port}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Usuario (Login)</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#38bdf8' }}>{PROFIT_SERVER_INFO.user}</span>
                <button
                  onClick={() => handleCopy(PROFIT_SERVER_INFO.user, 'user')}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
                >
                  {copiedKey === 'user' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                </button>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Contraseña</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#f59e0b' }}>{PROFIT_SERVER_INFO.password}</span>
                <button
                  onClick={() => handleCopy(PROFIT_SERVER_INFO.password, 'pass')}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
                >
                  {copiedKey === 'pass' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                </button>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Instancia SQL</div>
              <div style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--text-main)', marginTop: '2px' }}>
                {PROFIT_SERVER_INFO.instance}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* SECCIÓN 1: SELECTOR DE BASE DE DATOS Y FILTROS POR CATEGORÍA */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-glass)',
        borderRadius: '12px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          {/* Pills de Categorías */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[
              { id: 'all', label: 'Todas las Bases', count: databases.length || 26 },
              { id: 'admi', label: 'Profit Administrativo', count: 14, color: '#0284c7' },
              { id: 'cont', label: 'Contabilidad', count: 4, color: '#b45309' },
              { id: 'nomi', label: 'Nómina', count: 1, color: '#be185d' },
              { id: 'maestra', label: 'Maestras Profit', count: 2, color: '#7c3aed' },
              { id: 'sistema', label: 'Sistema SQL', count: 4, color: '#64748b' }
            ].map(cat => (
              <button
                key={cat.id}
                onClick={() => setDbCategoryFilter(cat.id)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '20px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: dbCategoryFilter === cat.id ? '1px solid #0284c7' : '1px solid var(--border-glass)',
                  background: dbCategoryFilter === cat.id ? 'rgba(2, 132, 199, 0.18)' : 'transparent',
                  color: dbCategoryFilter === cat.id ? '#38bdf8' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>{cat.label}</span>
                <span style={{
                  padding: '1px 6px',
                  borderRadius: '10px',
                  fontSize: '0.7rem',
                  background: dbCategoryFilter === cat.id ? '#0284c7' : 'rgba(255, 255, 255, 0.08)',
                  color: '#ffffff'
                }}>
                  {cat.count}
                </span>
              </button>
            ))}
          </div>

          {/* Buscador de Base de Datos */}
          <div style={{ position: 'relative', width: '240px' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Buscar base de datos..."
              value={dbSearch}
              onChange={e => setDbSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px 6px 30px',
                borderRadius: '8px',
                border: '1px solid var(--border-glass)',
                background: 'var(--bg-glass)',
                color: 'var(--text-main)',
                fontSize: '0.8rem'
              }}
            />
          </div>
        </div>

        {/* Carrusel / Grid Horizontal de Tarjetas de Base de Datos */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: '10px',
          maxHeight: '190px',
          overflowY: 'auto',
          paddingRight: '4px'
        }}>
          {filteredDatabases.map(db => {
            const isSelected = selectedDb === db.name;
            const isGrumotor = db.name === 'GRUMOTOR';
            return (
              <div
                key={db.name}
                onClick={() => setSelectedDb(db.name)}
                style={{
                  padding: '10px 12px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  border: isSelected ? '2px solid #0284c7' : '1px solid var(--border-glass)',
                  background: isSelected
                    ? (isDark ? 'rgba(2, 132, 199, 0.18)' : '#e0f2fe')
                    : (isDark ? 'rgba(255, 255, 255, 0.03)' : '#f8fafc'),
                  transition: 'all 0.15s ease-in-out',
                  position: 'relative'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Database size={15} color={isSelected ? '#38bdf8' : (isGrumotor ? '#10b981' : 'var(--text-muted)')} />
                    <span style={{ fontWeight: 800, fontSize: '0.88rem', fontFamily: 'monospace', color: isSelected ? '#38bdf8' : 'var(--text-main)' }}>
                      {db.name}
                    </span>
                  </div>
                  {isGrumotor && (
                    <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '4px', background: '#10b981', color: '#fff', fontWeight: 800 }}>
                      ACTIVA
                    </span>
                  )}
                </div>

                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {db.empresa || db.type}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  <span>{db.size_mb ? `${db.size_mb.toFixed(0)} MB` : '-'}</span>
                  <span>{db.tables ? `${db.tables} tablas` : ''}</span>
                  <span style={{ color: '#10b981', fontWeight: 700 }}>● {db.status || 'ONLINE'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECCIÓN 2: CONSOLA SQL (SI ESTÁ ACTIVA) O EXPLORADOR DE TABLAS Y REGISTROS */}
      {sqlTabActive ? (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-glass)',
          borderRadius: '12px',
          padding: '18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Code2 size={18} color="#0284c7" />
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Editor SQL Interactivo en Base de Datos: <span style={{ color: '#38bdf8', fontFamily: 'monospace' }}>[{selectedDb}]</span>
              </h3>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Solo consultas de lectura (<code style={{ color: '#10b981' }}>SELECT</code>). Límite de seguridad: 250 filas.
            </div>
          </div>

          {/* Plantillas Rápidas */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {[
              { label: 'Artículos (Top 50)', q: 'SELECT TOP 50 co_art, art_des, prec_vta1, stock_act FROM art ORDER BY co_art' },
              { label: 'Clientes (Top 50)', q: 'SELECT TOP 50 co_cli, cli_des, rif, telefonos, saldo FROM clientes ORDER BY co_cli' },
              { label: 'Facturas Recientes', q: 'SELECT TOP 50 fact_num, fec_emis, co_cli, cli_des, tot_neto FROM factura ORDER BY fec_emis DESC' },
              { label: 'Cobros Recientes', q: 'SELECT TOP 50 cob_num, fec_emis, co_cli, cli_des, mont_doc FROM cobros ORDER BY fec_emis DESC' },
              { label: 'Tablas con más filas', q: 'SELECT t.name, p.rows FROM sys.tables t JOIN sys.partitions p ON t.object_id = p.object_id WHERE p.index_id IN (0,1) ORDER BY p.rows DESC' }
            ].map((p, idx) => (
              <button
                key={idx}
                onClick={() => setSqlQuery(p.q)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  background: 'rgba(2, 132, 199, 0.1)',
                  border: '1px solid rgba(2, 132, 199, 0.3)',
                  color: '#38bdf8',
                  cursor: 'pointer'
                }}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div style={{ position: 'relative' }}>
            <textarea
              value={sqlQuery}
              onChange={e => setSqlQuery(e.target.value)}
              rows={4}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                border: '1px solid var(--border-glass)',
                background: isDark ? '#0b1120' : '#f8fafc',
                color: isDark ? '#38bdf8' : '#0f172a',
                fontFamily: 'Consolas, monospace',
                fontSize: '0.85rem',
                lineHeight: 1.4,
                resize: 'vertical'
              }}
            />
            <button
              onClick={handleExecuteSql}
              disabled={runningSql}
              style={{
                position: 'absolute',
                right: '12px',
                bottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '0.82rem',
                fontWeight: 700,
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
              }}
            >
              <Play size={14} className={runningSql ? 'spin' : ''} />
              <span>{runningSql ? 'Ejecutando...' : 'Ejecutar Consulta (F5)'}</span>
            </button>
          </div>

          {/* Resultados SQL */}
          {sqlResult && (
            <div style={{ marginTop: '10px' }}>
              {sqlResult.success ? (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.8rem', color: '#10b981', fontWeight: 600 }}>
                      ✓ {sqlResult.rowCount} filas obtenidas en {sqlResult.executionTimeMs} ms
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={handlePrintPdf}
                        className="btn-secondary"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '4px 10px',
                          fontSize: '0.75rem',
                          color: '#ef4444',
                          borderColor: 'rgba(239, 68, 68, 0.4)'
                        }}
                        title="Imprimir resultados en PDF oficial"
                      >
                        <Printer size={12} />
                        <span>Imprimir PDF</span>
                      </button>
                      <button onClick={handleExportCsv} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                        Exportar CSV
                      </button>
                      <button onClick={handleExportJson} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                        Exportar JSON
                      </button>
                    </div>
                  </div>

                  <div style={{ maxHeight: '350px', overflow: 'auto', border: '1px solid var(--border-glass)', borderRadius: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                      <thead>
                        <tr style={{ background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9' }}>
                          {sqlResult.columns.map(c => (
                            <th key={c.name} style={{ padding: '8px 10px', textAlign: 'left', borderBottom: '1px solid var(--border-glass)' }}>
                              {c.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sqlResult.rows.map((row, rIdx) => (
                          <tr key={rIdx} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                            {sqlResult.columns.map(c => (
                              <td key={c.name} style={{ padding: '6px 10px', fontFamily: 'monospace' }}>
                                {String(row[c.name] ?? '')}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', fontSize: '0.82rem' }}>
                  <strong>Error de Ejecución:</strong> {sqlResult.error}
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* VISTA SPLIT: LISTA DE TABLAS (IZQUIERDA) Y DATAGRID (DERECHA) */
        <div style={{
          display: 'grid',
          gridTemplateColumns: '280px 1fr',
          gap: '16px',
          minHeight: '520px'
        }}>

          {/* PANEL IZQUIERDO: TABLAS DE LA BASE DE DATOS */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-glass)',
            borderRadius: '12px',
            padding: '14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            height: '620px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Table size={16} color="#0284c7" />
                <span style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-main)' }}>
                  Tablas ({tables.length})
                </span>
              </div>
              <span style={{ fontSize: '0.72rem', color: '#38bdf8', fontFamily: 'monospace' }}>
                [{selectedDb}]
              </span>
            </div>

            {/* Buscador de Tabla */}
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Filtrar tablas..."
                value={tableSearch}
                onChange={e => setTableSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '5px 8px 5px 26px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-glass)',
                  background: 'var(--bg-glass)',
                  color: 'var(--text-main)',
                  fontSize: '0.78rem'
                }}
              />
            </div>

            {/* Checkbox solo tablas con datos */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={onlyNonEmptyTables}
                onChange={e => setOnlyNonEmptyTables(e.target.checked)}
              />
              Solo tablas con registros (&gt; 0)
            </label>

            {/* Lista de Tablas con Scroll */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              paddingRight: '4px'
            }}>
              {loadingTables ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  Cargando tablas...
                </div>
              ) : filteredTables.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                  No se encontraron tablas.
                </div>
              ) : (
                filteredTables.map(t => {
                  const isTblSelected = selectedTable === t.table_name;
                  return (
                    <div
                      key={t.table_name}
                      onClick={() => setSelectedTable(t.table_name)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.78rem',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: isTblSelected ? 'rgba(2, 132, 199, 0.2)' : 'transparent',
                        border: isTblSelected ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid transparent',
                        color: isTblSelected ? '#38bdf8' : 'var(--text-main)',
                        fontWeight: isTblSelected ? 700 : 500,
                        transition: 'background 0.1s'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                        <span style={{ fontFamily: 'monospace', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {t.table_name}
                        </span>
                      </div>
                      <span style={{
                        fontSize: '0.68rem',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        background: t.row_count > 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                        color: t.row_count > 0 ? '#10b981' : 'var(--text-muted)'
                      }}>
                        {t.row_count ?? 0}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* PANEL DERECHO: DATAGRID CON REGISTROS EN VIVO */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-glass)',
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            height: '620px'
          }}>

            {/* Barra Superior del Grid */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{
                  fontSize: '1rem',
                  fontWeight: 800,
                  color: 'var(--text-main)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <Table size={18} color="#0284c7" />
                  <span style={{ fontFamily: 'monospace', color: '#38bdf8' }}>{selectedTable}</span>
                </span>
                <span style={{
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  background: 'rgba(2, 132, 199, 0.15)',
                  color: '#38bdf8'
                }}>
                  {tableData.totalRows.toLocaleString()} registros totales
                </span>
              </div>

              {/* Controles de Búsqueda y Exportación */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ position: 'relative', width: '200px' }}>
                  <Search size={13} style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Filtrar en tabla..."
                    value={dataSearch}
                    onChange={e => setDataSearch(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        loadData(selectedDb, selectedTable, 1, tableData.limit, dataSearch);
                      }
                    }}
                    style={{
                      width: '100%',
                      padding: '5px 8px 5px 26px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-glass)',
                      background: 'var(--bg-glass)',
                      color: 'var(--text-main)',
                      fontSize: '0.78rem'
                    }}
                  />
                </div>

                <button
                  onClick={() => loadData(selectedDb, selectedTable, tableData.page, tableData.limit, dataSearch)}
                  disabled={loadingData}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    background: 'var(--bg-glass)',
                    border: '1px solid var(--border-glass)',
                    color: 'var(--text-main)',
                    cursor: 'pointer'
                  }}
                  title="Recargar datos"
                >
                  <RefreshCw size={13} className={loadingData ? 'spin' : ''} />
                </button>

                <button
                  onClick={handlePrintPdf}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '5px 10px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    background: 'rgba(230, 0, 18, 0.15)',
                    border: '1px solid rgba(230, 0, 18, 0.35)',
                    color: '#ef4444',
                    cursor: 'pointer'
                  }}
                  title="Imprimir registros de esta tabla en PDF oficial"
                >
                  <Printer size={13} />
                  <span>Imprimir PDF</span>
                </button>

                <button
                  onClick={handleExportCsv}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '5px 10px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    background: 'rgba(16, 185, 129, 0.15)',
                    border: '1px solid rgba(16, 185, 129, 0.35)',
                    color: '#10b981',
                    cursor: 'pointer'
                  }}
                >
                  <Download size={13} />
                  <span>CSV</span>
                </button>

                <button
                  onClick={handleExportJson}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '5px 10px',
                    borderRadius: '6px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    background: 'rgba(56, 189, 248, 0.15)',
                    border: '1px solid rgba(56, 189, 248, 0.35)',
                    color: '#38bdf8',
                    cursor: 'pointer'
                  }}
                >
                  <Download size={13} />
                  <span>JSON</span>
                </button>
              </div>
            </div>

            {/* Contenedor del DataGrid con Scroll Doble */}
            <div style={{
              flex: 1,
              overflow: 'auto',
              border: '1px solid var(--border-glass)',
              borderRadius: '8px',
              position: 'relative'
            }}>
              {loadingData ? (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isDark ? 'rgba(15, 23, 42, 0.7)' : 'rgba(255, 255, 255, 0.7)',
                  zIndex: 10,
                  color: '#38bdf8',
                  fontWeight: 600
                }}>
                  <RefreshCw size={20} className="spin" style={{ marginRight: '8px' }} />
                  Cargando registros desde {selectedDb}...
                </div>
              ) : null}

              {tableData.rows.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  {tableData.error ? (
                    <div style={{ color: '#ef4444' }}>
                      <AlertCircle size={24} style={{ margin: '0 auto 8px auto' }} />
                      <div>{tableData.error}</div>
                    </div>
                  ) : (
                    <div>
                      <Table size={28} style={{ margin: '0 auto 8px auto', opacity: 0.4 }} />
                      <div>La tabla <code style={{ color: '#38bdf8' }}>{selectedTable}</code> no tiene registros en la base de datos seleccionada.</div>
                    </div>
                  )}
                </div>
              ) : (
                <table style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '0.78rem',
                  minWidth: '700px'
                }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 5, background: isDark ? '#0f172a' : '#f1f5f9' }}>
                    <tr>
                      <th style={{ width: '40px', padding: '8px', textAlign: 'center', borderBottom: '1px solid var(--border-glass)', color: 'var(--text-muted)' }}>
                        #
                      </th>
                      {tableData.columns.map(col => (
                        <th
                          key={col.name}
                          style={{
                            padding: '8px 12px',
                            textAlign: 'left',
                            borderBottom: '1px solid var(--border-glass)',
                            color: 'var(--text-main)',
                            fontWeight: 700,
                            whiteSpace: 'nowrap'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>{col.name}</span>
                            {col.type && (
                              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                                ({col.type})
                              </span>
                            )}
                          </div>
                        </th>
                      ))}
                      <th style={{ width: '60px', padding: '8px', textAlign: 'center', borderBottom: '1px solid var(--border-glass)' }}>
                        Detalle
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.rows.map((row, rIdx) => {
                      const rowNum = (tableData.page - 1) * tableData.limit + rIdx + 1;
                      return (
                        <tr
                          key={rIdx}
                          style={{
                            borderBottom: '1px solid var(--border-glass)',
                            transition: 'background 0.1s'
                          }}
                          className="hover-row"
                        >
                          <td style={{ textAlign: 'center', padding: '6px', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                            {rowNum}
                          </td>
                          {tableData.columns.map(col => {
                            const val = row[col.name];
                            return (
                              <td
                                key={col.name}
                                style={{
                                  padding: '6px 12px',
                                  whiteSpace: 'nowrap',
                                  maxWidth: '260px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  fontFamily: typeof val === 'number' ? 'monospace' : 'inherit',
                                  color: val === null || val === undefined ? 'var(--text-muted)' : 'var(--text-main)'
                                }}
                                title={String(val ?? '')}
                              >
                                {val === null || val === undefined ? <em style={{ opacity: 0.5 }}>NULL</em> : String(val)}
                              </td>
                            );
                          })}
                          <td style={{ textAlign: 'center', padding: '6px' }}>
                            <button
                              onClick={() => setSelectedRowDetail(row)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#38bdf8',
                                cursor: 'pointer',
                                padding: '4px'
                              }}
                              title="Ver detalle del registro"
                            >
                              <Eye size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Paginador Inferior */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              <div>
                Página <strong style={{ color: 'var(--text-main)' }}>{tableData.page}</strong> de <strong style={{ color: 'var(--text-main)' }}>{tableData.totalPages}</strong>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>Filas por página:</span>
                <select
                  value={tableData.limit}
                  onChange={e => loadData(selectedDb, selectedTable, 1, parseInt(e.target.value, 10), dataSearch)}
                  style={{
                    padding: '3px 6px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-glass)',
                    background: 'var(--bg-glass)',
                    color: 'var(--text-main)',
                    fontSize: '0.75rem'
                  }}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>

                <button
                  onClick={() => loadData(selectedDb, selectedTable, tableData.page - 1, tableData.limit, dataSearch)}
                  disabled={tableData.page <= 1 || loadingData}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-glass)',
                    background: 'var(--bg-glass)',
                    color: 'var(--text-main)',
                    cursor: tableData.page <= 1 ? 'not-allowed' : 'pointer',
                    opacity: tableData.page <= 1 ? 0.5 : 1
                  }}
                >
                  Anterior
                </button>

                <button
                  onClick={() => loadData(selectedDb, selectedTable, tableData.page + 1, tableData.limit, dataSearch)}
                  disabled={tableData.page >= tableData.totalPages || loadingData}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '4px',
                    border: '1px solid var(--border-glass)',
                    background: 'var(--bg-glass)',
                    color: 'var(--text-main)',
                    cursor: tableData.page >= tableData.totalPages ? 'not-allowed' : 'pointer',
                    opacity: tableData.page >= tableData.totalPages ? 0.5 : 1
                  }}
                >
                  Siguiente
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE DETALLE DE REGISTRO */}
      {selectedRowDetail && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: isDark ? '#0f172a' : '#ffffff',
            border: '1px solid var(--border-glass)',
            borderRadius: '16px',
            maxWidth: '750px',
            width: '100%',
            maxHeight: '85vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4)'
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border-glass)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  Detalle del Registro &bull; <span style={{ color: '#38bdf8' }}>{selectedTable}</span>
                </h3>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Base de Datos: <strong>{selectedDb}</strong>
                </span>
              </div>
              <button
                onClick={() => setSelectedRowDetail(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                {Object.entries(selectedRowDetail).map(([k, v]) => (
                  <div key={k} style={{
                    padding: '8px 10px',
                    borderRadius: '8px',
                    background: isDark ? 'rgba(255, 255, 255, 0.04)' : '#f8fafc',
                    border: '1px solid var(--border-glass)'
                  }}>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, fontFamily: 'monospace' }}>
                      {k}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-main)', marginTop: '2px', wordBreak: 'break-all' }}>
                      {v === null || v === undefined ? <em style={{ opacity: 0.5 }}>NULL</em> : String(v)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--border-glass)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px'
            }}>
              <button
                onClick={() => handleCopy(JSON.stringify(selectedRowDetail, null, 2), 'rowJson')}
                className="btn-secondary"
                style={{ padding: '6px 14px', fontSize: '0.78rem' }}
              >
                {copiedKey === 'rowJson' ? '✓ JSON Copiado' : 'Copiar JSON'}
              </button>
              <button
                onClick={() => setSelectedRowDetail(null)}
                className="btn-primary"
                style={{ padding: '6px 18px', fontSize: '0.78rem' }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
