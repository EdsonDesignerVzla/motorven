import React, { useState, useMemo } from 'react';
import {
  Database,
  ExternalLink,
  Search,
  Table,
  Code2,
  Download,
  Copy,
  Check,
  RefreshCw,
  Layers,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  Server,
  ShieldCheck,
  Filter
} from 'lucide-react';
import {
  REAL_CONFIG,
  REAL_PRODUCTS,
  REAL_CLIENTS,
  REAL_PROFIT_SELLERS,
  REAL_PROFIT_INVOICES,
  REAL_PROFIT_COLLECTIONS,
  REAL_PROFIT_ACCOUNTS_PAYABLE,
  REAL_PROFIT_SUPPLIER_PAYMENTS,
  REAL_PROFIT_PURCHASES,
  REAL_PROFIT_SUPPLIERS,
  REAL_PROFIT_BANK_ACCOUNTS,
  REAL_PROFIT_CASH_DESKS,
  REAL_PROFIT_ZONES,
  REAL_PROFIT_TRANSPORTS,
  REAL_PROFIT_CUSTOMER_RETURNS,
  REAL_PROFIT_INVENTORY_ADJUSTMENTS,
  REAL_PROFIT_WAREHOUSE_TRANSFERS,
  REAL_PROFIT_ISLR_CONCEPTS,
  REAL_PROFIT_BENEFICIARIES,
  REAL_PROFIT_PAYMENT_ORDERS,
  REAL_PROFIT_WAREHOUSES,
  REAL_PROFIT_STOCK_BY_WAREHOUSE,
  REAL_PROFIT_PRODUCT_LINES,
  REAL_PROFIT_PRODUCT_CATEGORIES,
  REAL_PROFIT_CURRENCIES,
  REAL_USERS,
  REAL_ORDERS,
  REAL_SALES,
  REAL_PURCHASES,
  REAL_SUPPLIERS,
  REAL_CASH_MOVEMENTS,
  REAL_FISCAL_CLOSURES,
  REAL_NOTIFICATIONS,
  REAL_SIGNUM_MOTORVEN
} from '../data/supabaseRealData';

const SUPABASE_PROJECT_ID = 'LOCAL_STANDALONE';
const SUPABASE_PROJECT_URL = 'http://localhost:54321/';

const TABLES_REGISTRY = [
  { id: 'SIGNUM_MOTORVEN', label: 'SIGNUM_MOTORVEN (Base Principal Master)', category: 'Master', count: REAL_SIGNUM_MOTORVEN.length, data: REAL_SIGNUM_MOTORVEN },
  { id: 'clients', label: 'clients (Clientes)', category: 'Comercial', count: REAL_CLIENTS.length, data: REAL_CLIENTS },
  { id: 'products', label: 'products (Productos / Lubricantes)', category: 'Inventario', count: REAL_PRODUCTS.length, data: REAL_PRODUCTS },
  { id: 'profit_invoices', label: 'profit_invoices (Facturas de Venta)', category: 'Facturación', count: REAL_PROFIT_INVOICES.length, data: REAL_PROFIT_INVOICES },
  { id: 'profit_collections', label: 'profit_collections (Cobros & Recibos)', category: 'Tesorería', count: REAL_PROFIT_COLLECTIONS.length, data: REAL_PROFIT_COLLECTIONS },
  { id: 'profit_accounts_payable', label: 'profit_accounts_payable (Cuentas por Pagar CxP)', category: 'Finanzas', count: REAL_PROFIT_ACCOUNTS_PAYABLE.length, data: REAL_PROFIT_ACCOUNTS_PAYABLE },
  { id: 'profit_supplier_payments', label: 'profit_supplier_payments (Pagos a Proveedores)', category: 'Finanzas', count: REAL_PROFIT_SUPPLIER_PAYMENTS.length, data: REAL_PROFIT_SUPPLIER_PAYMENTS },
  { id: 'profit_sellers', label: 'profit_sellers (Fuerza de Ventas)', category: 'Comercial', count: REAL_PROFIT_SELLERS.length, data: REAL_PROFIT_SELLERS },
  { id: 'profit_purchases', label: 'profit_purchases (Compras Profit)', category: 'Compras', count: REAL_PROFIT_PURCHASES.length, data: REAL_PROFIT_PURCHASES },
  { id: 'orders', label: 'orders (Pedidos & Preventa)', category: 'Comercial', count: REAL_ORDERS.length, data: REAL_ORDERS },
  { id: 'users', label: 'users (Usuarios del Sistema)', category: 'Seguridad', count: REAL_USERS.length, data: REAL_USERS },
  { id: 'profit_payment_orders', label: 'profit_payment_orders (Órdenes de Pago)', category: 'Finanzas', count: REAL_PROFIT_PAYMENT_ORDERS.length, data: REAL_PROFIT_PAYMENT_ORDERS },
  { id: 'profit_beneficiaries', label: 'profit_beneficiaries (Beneficiarios)', category: 'Finanzas', count: REAL_PROFIT_BENEFICIARIES.length, data: REAL_PROFIT_BENEFICIARIES },
  { id: 'profit_islr_concepts', label: 'profit_islr_concepts (Conceptos ISLR)', category: 'Fiscal', count: REAL_PROFIT_ISLR_CONCEPTS.length, data: REAL_PROFIT_ISLR_CONCEPTS },
  { id: 'profit_bank_accounts', label: 'profit_bank_accounts (Cuentas Bancarias)', category: 'Tesorería', count: REAL_PROFIT_BANK_ACCOUNTS.length, data: REAL_PROFIT_BANK_ACCOUNTS },
  { id: 'profit_cash_desks', label: 'profit_cash_desks (Cajas Chicas)', category: 'Tesorería', count: REAL_PROFIT_CASH_DESKS.length, data: REAL_PROFIT_CASH_DESKS },
  { id: 'profit_suppliers', label: 'profit_suppliers (Proveedores Profit)', category: 'Compras', count: REAL_PROFIT_SUPPLIERS.length, data: REAL_PROFIT_SUPPLIERS },
  { id: 'profit_customer_returns', label: 'profit_customer_returns (Devoluciones)', category: 'Comercial', count: REAL_PROFIT_CUSTOMER_RETURNS.length, data: REAL_PROFIT_CUSTOMER_RETURNS },
  { id: 'profit_inventory_adjustments', label: 'profit_inventory_adjustments (Ajustes Stock)', category: 'Inventario', count: REAL_PROFIT_INVENTORY_ADJUSTMENTS.length, data: REAL_PROFIT_INVENTORY_ADJUSTMENTS },
  { id: 'profit_warehouse_transfers', label: 'profit_warehouse_transfers (Traslados)', category: 'Inventario', count: REAL_PROFIT_WAREHOUSE_TRANSFERS.length, data: REAL_PROFIT_WAREHOUSE_TRANSFERS },
  { id: 'profit_zones', label: 'profit_zones (Zonas Comerciales)', category: 'Comercial', count: REAL_PROFIT_ZONES.length, data: REAL_PROFIT_ZONES },
  { id: 'profit_transports', label: 'profit_transports (Transportes / Rutas)', category: 'Logística', count: REAL_PROFIT_TRANSPORTS.length, data: REAL_PROFIT_TRANSPORTS },
  { id: 'profit_warehouses', label: 'profit_warehouses (Almacenes)', category: 'Inventario', count: REAL_PROFIT_WAREHOUSES.length, data: REAL_PROFIT_WAREHOUSES },
  { id: 'profit_stock_by_warehouse', label: 'profit_stock_by_warehouse (Stock por Almacén)', category: 'Inventario', count: REAL_PROFIT_STOCK_BY_WAREHOUSE.length, data: REAL_PROFIT_STOCK_BY_WAREHOUSE },
  { id: 'profit_product_lines', label: 'profit_product_lines (Líneas de Producto)', category: 'Inventario', count: REAL_PROFIT_PRODUCT_LINES.length, data: REAL_PROFIT_PRODUCT_LINES },
  { id: 'profit_product_categories', label: 'profit_product_categories (Categorías)', category: 'Inventario', count: REAL_PROFIT_PRODUCT_CATEGORIES.length, data: REAL_PROFIT_PRODUCT_CATEGORIES },
  { id: 'profit_currencies', label: 'profit_currencies (Monedas)', category: 'Configuración', count: REAL_PROFIT_CURRENCIES.length, data: REAL_PROFIT_CURRENCIES },
  { id: 'notifications', label: 'notifications (Notificaciones & Alertas)', category: 'Sistema', count: REAL_NOTIFICATIONS.length, data: REAL_NOTIFICATIONS },
  { id: 'sales', label: 'sales (Ventas Nativas)', category: 'Facturación', count: REAL_SALES.length, data: REAL_SALES },
  { id: 'purchases', label: 'purchases (Compras Nativas)', category: 'Compras', count: REAL_PURCHASES.length, data: REAL_PURCHASES },
  { id: 'suppliers', label: 'suppliers (Proveedores Nativos)', category: 'Compras', count: REAL_SUPPLIERS.length, data: REAL_SUPPLIERS },
  { id: 'cash_movements', label: 'cash_movements (Movimientos Caja)', category: 'Tesorería', count: REAL_CASH_MOVEMENTS.length, data: REAL_CASH_MOVEMENTS },
  { id: 'fiscal_closures', label: 'fiscal_closures (Cierres Z Fiscales)', category: 'Fiscal', count: REAL_FISCAL_CLOSURES.length, data: REAL_FISCAL_CLOSURES },
  { id: 'config', label: 'config (Parámetros Generales)', category: 'Configuración', count: 1, data: [REAL_CONFIG] }
];

export default function SupabaseTablesView() {
  const [selectedTableId, setSelectedTableId] = useState(() => {
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search).get('table');
      if (p && TABLES_REGISTRY.some(t => t.id === p)) return p;
    }
    return 'SIGNUM_MOTORVEN';
  });
  const [searchTableQuery, setSearchTableQuery] = useState('');
  const [searchRowQuery, setSearchRowQuery] = useState('');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'json'
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortField, setSortField] = useState(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [copied, setCopied] = useState(false);
  const [selectedRowDetail, setSelectedRowDetail] = useState(null);

  // Tabla actual
  const currentTable = useMemo(() => {
    return TABLES_REGISTRY.find(t => t.id === selectedTableId) || TABLES_REGISTRY[0];
  }, [selectedTableId]);

  // Filtrar lista de tablas del panel lateral
  const filteredTables = useMemo(() => {
    if (!searchTableQuery.trim()) return TABLES_REGISTRY;
    const q = searchTableQuery.toLowerCase();
    return TABLES_REGISTRY.filter(t => t.label.toLowerCase().includes(q) || t.category.toLowerCase().includes(q));
  }, [searchTableQuery]);

  // Columnas dinámicas de la tabla seleccionada
  const columns = useMemo(() => {
    const data = currentTable.data || [];
    if (data.length === 0) return [];
    const keys = new Set();
    data.slice(0, 10).forEach(row => {
      if (row && typeof row === 'object') {
        Object.keys(row).forEach(k => keys.add(k));
      }
    });
    return Array.from(keys);
  }, [currentTable]);

  // Filas filtradas y ordenadas
  const processedRows = useMemo(() => {
    let rows = currentTable.data || [];
    if (!Array.isArray(rows)) return [];

    if (searchRowQuery.trim()) {
      const q = searchRowQuery.toLowerCase();
      rows = rows.filter(row => {
        return Object.values(row || {}).some(val => {
          if (val === null || val === undefined) return false;
          if (typeof val === 'object') return JSON.stringify(val).toLowerCase().includes(q);
          return String(val).toLowerCase().includes(q);
        });
      });
    }

    if (sortField) {
      rows = [...rows].sort((a, b) => {
        const valA = a[sortField];
        const valB = b[sortField];
        if (valA === valB) return 0;
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;
        const res = String(valA).localeCompare(String(valB), undefined, { numeric: true });
        return sortAsc ? res : -res;
      });
    }

    return rows;
  }, [currentTable, searchRowQuery, sortField, sortAsc]);

  // Paginación
  const totalPages = Math.ceil(processedRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return processedRows.slice(start, start + pageSize);
  }, [processedRows, page, pageSize]);

  const handleSelectTable = (id) => {
    setSelectedTableId(id);
    setPage(1);
    setSearchRowQuery('');
    setSortField(null);
    setSelectedRowDetail(null);
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const handleCopyJson = () => {
    const text = JSON.stringify(currentTable.data, null, 2);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadCsv = () => {
    if (!currentTable.data || currentTable.data.length === 0) return;
    const header = columns.join(',');
    const rows = processedRows.map(row => {
      return columns.map(col => {
        let val = row[col];
        if (val === null || val === undefined) return '""';
        if (typeof val === 'object') val = JSON.stringify(val);
        const str = String(val).replace(/"/g, '""');
        return `"${str}"`;
      }).join(',');
    });
    const csvContent = 'data:text/csv;charset=utf-8,' + [header, ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${currentTable.id}_supabase.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      width: '100vw',
      background: '#0b1120',
      color: '#f1f5f9',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
      overflow: 'hidden'
    }}>
      {/* Top Header */}
      <header style={{
        background: '#0f172a',
        borderBottom: '1px solid #1e293b',
        padding: '0.75rem 1.25rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '1rem',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
          }}>
            <Database size={22} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#ffffff', letterSpacing: '-0.02em' }}>
                SIGNUM MOTORVEN <span style={{ color: '#10b981', fontWeight: 600 }}>• Supabase Database Explorer</span>
              </h1>
              <span style={{
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#34d399',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                padding: '2px 8px',
                borderRadius: '999px',
                fontSize: '0.7rem',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></span>
                PostgreSQL Sincronizado
              </span>
            </div>
            <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
              Proyecto: <code style={{ color: '#38bdf8', background: '#1e293b', padding: '1px 5px', borderRadius: '4px' }}>{SUPABASE_PROJECT_ID}</code> (signum-motorven) • 32 Tablas Relacionales
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => window.open('http://localhost:54321/', '_blank')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              borderRadius: '8px',
              border: '1px solid #3ecf8e',
              background: 'rgba(62, 207, 142, 0.15)',
              color: '#3ecf8e',
              fontSize: '0.8rem',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            title="Abrir Studio del Servidor Local Supabase en el puerto 54321 (Gratis, sin token ni cuotas)"
          >
            <Server size={14} />
            Supabase Local (:54321)
          </button>

          <button
            onClick={() => window.open(SUPABASE_PROJECT_URL, '_blank')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              borderRadius: '8px',
              border: '1px solid #10b981',
              background: 'rgba(16, 185, 129, 0.1)',
              color: '#34d399',
              fontSize: '0.8rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            title="Abrir Dashboard oficial de Supabase en la nube"
          >
            <ExternalLink size={14} />
            Consola Supabase Cloud
          </button>

          <button
            onClick={() => window.location.reload()}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              borderRadius: '8px',
              border: '1px solid #334155',
              background: '#1e293b',
              color: '#cbd5e1',
              fontSize: '0.8rem',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={14} />
            Refrescar
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Sidebar: Tables List */}
        <aside style={{
          width: '320px',
          background: '#0f172a',
          borderRight: '1px solid #1e293b',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0
        }}>
          {/* Search Table */}
          <div style={{ padding: '0.75rem', borderBottom: '1px solid #1e293b' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
              <input
                type="text"
                placeholder="Buscar tabla o módulo..."
                value={searchTableQuery}
                onChange={(e) => setSearchTableQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '7px 10px 7px 32px',
                  borderRadius: '6px',
                  border: '1px solid #334155',
                  background: '#1e293b',
                  color: '#f8fafc',
                  fontSize: '0.8rem',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Table List Scroll */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', padding: '4px 8px 8px', letterSpacing: '0.05em' }}>
              Tablas Públicas ({filteredTables.length})
            </div>
            {filteredTables.map(t => {
              const isSelected = t.id === selectedTableId;
              return (
                <button
                  key={t.id}
                  onClick={() => handleSelectTable(t.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: isSelected ? '1px solid #10b981' : '1px solid transparent',
                    background: isSelected ? 'rgba(16, 185, 129, 0.12)' : 'transparent',
                    color: isSelected ? '#ffffff' : '#94a3b8',
                    cursor: 'pointer',
                    textAlign: 'left',
                    marginBottom: '2px',
                    transition: 'background 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                    <Table size={14} color={isSelected ? '#34d399' : '#64748b'} />
                    <span style={{ fontSize: '0.8rem', fontWeight: isSelected ? 600 : 500, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                      {t.id}
                    </span>
                  </div>
                  <span style={{
                    fontSize: '0.7rem',
                    background: isSelected ? '#059669' : '#1e293b',
                    color: isSelected ? '#ffffff' : '#94a3b8',
                    padding: '2px 6px',
                    borderRadius: '999px',
                    fontWeight: 600,
                    flexShrink: 0
                  }}>
                    {t.count}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Right Content Area */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0b1120' }}>
          {/* Table Header Controls */}
          <div style={{
            padding: '0.75rem 1.25rem',
            background: '#0f172a',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexShrink: 0
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#f8fafc' }}>
                  {currentTable.id}
                </h2>
                <span style={{ fontSize: '0.75rem', color: '#64748b' }}>•</span>
                <span style={{ fontSize: '0.8rem', color: '#38bdf8', fontWeight: 600 }}>
                  {processedRows.length} {processedRows.length === 1 ? 'registro' : 'registros'}
                </span>
                {searchRowQuery && (
                  <span style={{ fontSize: '0.75rem', color: '#f59e0b' }}>(filtrados)</span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {/* Row Search */}
              <div style={{ position: 'relative', width: '240px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                <input
                  type="text"
                  placeholder="Filtrar en esta tabla..."
                  value={searchRowQuery}
                  onChange={(e) => { setSearchRowQuery(e.target.value); setPage(1); }}
                  style={{
                    width: '100%',
                    padding: '6px 10px 6px 30px',
                    borderRadius: '6px',
                    border: '1px solid #334155',
                    background: '#1e293b',
                    color: '#f8fafc',
                    fontSize: '0.8rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* View Toggle */}
              <div style={{ display: 'flex', background: '#1e293b', borderRadius: '6px', padding: '2px', border: '1px solid #334155' }}>
                <button
                  onClick={() => setViewMode('table')}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '4px',
                    border: 'none',
                    background: viewMode === 'table' ? '#0284c7' : 'transparent',
                    color: viewMode === 'table' ? '#ffffff' : '#94a3b8',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Table size={12} />
                  Tabla
                </button>
                <button
                  onClick={() => setViewMode('json')}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '4px',
                    border: 'none',
                    background: viewMode === 'json' ? '#0284c7' : 'transparent',
                    color: viewMode === 'json' ? '#ffffff' : '#94a3b8',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <Code2 size={12} />
                  JSON
                </button>
              </div>

              {/* Action Buttons */}
              <button
                onClick={handleCopyJson}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid #334155',
                  background: '#1e293b',
                  color: copied ? '#34d399' : '#cbd5e1',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>

              <button
                onClick={handleDownloadCsv}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '1px solid #334155',
                  background: '#1e293b',
                  color: '#cbd5e1',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                <Download size={12} />
                CSV
              </button>
            </div>
          </div>

          {/* View Body */}
          <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
            {viewMode === 'table' ? (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem', textAlign: 'left' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#0f172a', zIndex: 10, boxShadow: '0 1px 0 #1e293b' }}>
                  <tr>
                    <th style={{ padding: '10px 12px', color: '#94a3b8', borderBottom: '1px solid #1e293b', width: '40px' }}>#</th>
                    {columns.map(col => {
                      const isSorted = sortField === col;
                      return (
                        <th
                          key={col}
                          onClick={() => handleSort(col)}
                          style={{
                            padding: '10px 12px',
                            color: isSorted ? '#38bdf8' : '#cbd5e1',
                            fontWeight: 600,
                            borderBottom: '1px solid #1e293b',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            userSelect: 'none'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span>{col}</span>
                            <ArrowUpDown size={11} style={{ opacity: isSorted ? 1 : 0.3 }} />
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length + 1} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                        No se encontraron registros en esta tabla.
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((row, idx) => {
                      const rowNum = (page - 1) * pageSize + idx + 1;
                      return (
                        <tr
                          key={row.id || idx}
                          onClick={() => setSelectedRowDetail(row)}
                          style={{
                            borderBottom: '1px solid #1e293b',
                            background: idx % 2 === 0 ? 'transparent' : 'rgba(30, 41, 59, 0.3)',
                            cursor: 'pointer',
                            transition: 'background 0.1s ease'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(56, 189, 248, 0.08)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'rgba(30, 41, 59, 0.3)'}
                        >
                          <td style={{ padding: '8px 12px', color: '#64748b', fontSize: '0.75rem' }}>{rowNum}</td>
                          {columns.map(col => {
                            let val = row[col];
                            let display = '';
                            if (val === null || val === undefined) {
                              display = <span style={{ color: '#64748b', fontStyle: 'italic' }}>null</span>;
                            } else if (typeof val === 'boolean') {
                              display = <span style={{ color: val ? '#34d399' : '#f87171' }}>{String(val)}</span>;
                            } else if (typeof val === 'object') {
                              display = <span style={{ color: '#a78bfa', fontFamily: 'monospace', fontSize: '0.75rem' }}>{JSON.stringify(val).slice(0, 40)}...</span>;
                            } else if (typeof val === 'string' && val.startsWith('data:image')) {
                              display = <span style={{ color: '#38bdf8', fontStyle: 'italic' }}>[Base64 Image]</span>;
                            } else {
                              display = String(val).slice(0, 80);
                            }

                            return (
                              <td
                                key={col}
                                style={{
                                  padding: '8px 12px',
                                  color: '#e2e8f0',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  maxWidth: '220px'
                                }}
                              >
                                {display}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            ) : (
              <div style={{ padding: '1rem', height: '100%', boxSizing: 'border-box' }}>
                <pre style={{
                  margin: 0,
                  padding: '1rem',
                  background: '#0f172a',
                  border: '1px solid #1e293b',
                  borderRadius: '8px',
                  color: '#38bdf8',
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                  overflow: 'auto',
                  maxHeight: '100%'
                }}>
                  {JSON.stringify(processedRows, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* Table Footer: Pagination */}
          <div style={{
            padding: '0.5rem 1.25rem',
            background: '#0f172a',
            borderTop: '1px solid #1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '0.8rem',
            color: '#94a3b8',
            flexShrink: 0
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Filas por página:</span>
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                style={{
                  background: '#1e293b',
                  color: '#f8fafc',
                  border: '1px solid #334155',
                  padding: '3px 8px',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  outline: 'none'
                }}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={500}>500</option>
              </select>
              <span>
                Mostrando {processedRows.length > 0 ? (page - 1) * pageSize + 1 : 0} - {Math.min(page * pageSize, processedRows.length)} de {processedRows.length}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: '1px solid #334155',
                  background: page <= 1 ? 'rgba(30, 41, 59, 0.4)' : '#1e293b',
                  color: page <= 1 ? '#475569' : '#cbd5e1',
                  cursor: page <= 1 ? 'not-allowed' : 'pointer'
                }}
              >
                <ChevronLeft size={14} />
              </button>
              <span>Página {page} de {totalPages}</span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  border: '1px solid #334155',
                  background: page >= totalPages ? 'rgba(30, 41, 59, 0.4)' : '#1e293b',
                  color: page >= totalPages ? '#475569' : '#cbd5e1',
                  cursor: page >= totalPages ? 'not-allowed' : 'pointer'
                }}
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        </main>
      </div>

      {/* Row Detail Modal */}
      {selectedRowDetail && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}>
          <div style={{
            width: '700px',
            maxWidth: '95vw',
            maxHeight: '85vh',
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '1rem',
              borderBottom: '1px solid #1e293b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Eye size={18} color="#38bdf8" />
                <h3 style={{ margin: 0, fontSize: '1rem', color: '#ffffff' }}>
                  Detalle del Registro ({currentTable.id})
                </h3>
              </div>
              <button
                onClick={() => setSelectedRowDetail(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
              <pre style={{
                margin: 0,
                padding: '1rem',
                background: '#0b1120',
                border: '1px solid #1e293b',
                borderRadius: '8px',
                color: '#38bdf8',
                fontSize: '0.8rem',
                fontFamily: 'monospace',
                overflow: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all'
              }}>
                {JSON.stringify(selectedRowDetail, null, 2)}
              </pre>
            </div>

            <div style={{
              padding: '0.75rem 1rem',
              borderTop: '1px solid #1e293b',
              display: 'flex',
              justifyContent: 'flex-end',
              background: '#0b1120'
            }}>
              <button
                onClick={() => setSelectedRowDetail(null)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: '1px solid #334155',
                  background: '#1e293b',
                  color: '#ffffff',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
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
