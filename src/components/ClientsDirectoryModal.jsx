import React, { useState, useMemo } from 'react';
import {
  X,
  Users,
  Search,
  Building2,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Calendar,
  FileText,
  DollarSign,
  ShieldCheck,
  ShieldAlert,
  Download,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  Globe,
  Tag,
  Percent,
  Briefcase,
  ExternalLink,
  ChevronRight,
  Filter,
  ShoppingCart,
  Printer,
  Plus,
  Edit2,
  Trash2,
  Save,
  RotateCcw
} from 'lucide-react';
import { generateAccountsReceivablePDF } from '../services/pdfReportService';
import { useNotification } from '../context/NotificationContext';

export default function ClientsDirectoryModal({
  isOpen,
  onClose,
  clients = [],
  tasaBcv = 42.50,
  currentUser,
  onSaveClient,
  onDeleteClient,
  onSelectClientForPayment,
  onSelectClientForPOS
}) {
  const notify = useNotification();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, ACTIVE, INACTIVE
  const [creditFilter, setCreditFilter] = useState('ALL'); // ALL, WITH_CREDIT, NO_CREDIT
  const [debtFilter, setDebtFilter] = useState('ALL'); // ALL, WITH_DEBT, ZERO_DEBT
  const [zoneFilter, setZoneFilter] = useState('ALL');
  const [sellerFilter, setSellerFilter] = useState('ALL');
  const [activeTab, setActiveTab] = useState('FICHA'); // FICHA, UBICACION, CREDITO, HISTORIAL

  // Estado del Formulario CRUD (Crear / Modificar Cliente)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSavingClient, setIsSavingClient] = useState(false);
  const [clientForm, setClientForm] = useState({
    codigo: '',
    nombre: '',
    rif: '',
    tipoCliente: 'Mayorista',
    direccion: '',
    telefono: '',
    email: '',
    limiteCreditoUsd: 0,
    diasCredito: 0,
    vendedorAsignado: 'OF',
    zonaVenta: '03',
    inactivo: false
  });

  // Extraer Zonas y Vendedores únicos
  const availableZones = useMemo(() => {
    const zones = new Set();
    clients.forEach(c => {
      if (c.zonaVenta && c.zonaVenta.trim()) zones.add(c.zonaVenta.trim());
    });
    return Array.from(zones).sort();
  }, [clients]);

  const availableSellers = useMemo(() => {
    const sellers = new Set();
    clients.forEach(c => {
      if (c.vendedorAsignado && c.vendedorAsignado.trim()) sellers.add(c.vendedorAsignado.trim());
    });
    return Array.from(sellers).sort();
  }, [clients]);

  // Clientes filtrados
  const filteredClients = useMemo(() => {
    return clients.filter(c => {
      // Búsqueda de texto
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        const matchCode = (c.codigo || c.id || '').toLowerCase().includes(s);
        const matchName = (c.nombre || '').toLowerCase().includes(s);
        const matchRif = (c.rif || '').toLowerCase().includes(s);
        const matchNit = (c.nit || '').toLowerCase().includes(s);
        const matchPhone = (c.telefono || '').toLowerCase().includes(s);
        const matchCity = (c.ciudad || '').toLowerCase().includes(s);
        const matchResp = (c.responsable || '').toLowerCase().includes(s);
        const matchSeller = (c.vendedorAsignado || '').toLowerCase().includes(s);
        if (!matchCode && !matchName && !matchRif && !matchNit && !matchPhone && !matchCity && !matchResp && !matchSeller) {
          return false;
        }
      }

      // Filtro Estatus
      if (statusFilter === 'ACTIVE' && c.inactivo) return false;
      if (statusFilter === 'INACTIVE' && !c.inactivo) return false;

      // Filtro Crédito
      if (creditFilter === 'WITH_CREDIT' && c.sinCredito) return false;
      if (creditFilter === 'NO_CREDIT' && !c.sinCredito) return false;

      // Filtro Deuda
      const saldo = Number(c.saldoDeudorUsd || 0);
      if (debtFilter === 'WITH_DEBT' && saldo <= 0) return false;
      if (debtFilter === 'ZERO_DEBT' && saldo > 0) return false;

      // Filtro Zona
      if (zoneFilter !== 'ALL' && c.zonaVenta !== zoneFilter) return false;

      // Filtro Vendedor
      if (sellerFilter !== 'ALL' && c.vendedorAsignado !== sellerFilter) return false;

      return true;
    });
  }, [clients, searchTerm, statusFilter, creditFilter, debtFilter, zoneFilter, sellerFilter]);

  // Cliente seleccionado (por defecto el primero de la lista o el seleccionado)
  const selectedClient = useMemo(() => {
    if (!clients || clients.length === 0) return null;
    if (selectedClientId) {
      const found = clients.find(c => (c.id === selectedClientId || c.codigo === selectedClientId));
      if (found) return found;
    }
    return filteredClients.length > 0 ? filteredClients[0] : clients[0];
  }, [clients, selectedClientId, filteredClients]);

  // Métricas rápidas
  const totalClientes = clients.length;
  const activosCount = clients.filter(c => !c.inactivo).length;
  const conDeudaCount = clients.filter(c => (Number(c.saldoDeudorUsd) || 0) > 0).length;
  const totalDeudaUsd = clients.reduce((acc, c) => acc + (Number(c.saldoDeudorUsd) || 0), 0);
  const totalLimiteCredito = clients.reduce((acc, c) => acc + (Number(c.limiteCreditoUsd) || 0), 0);

  const formatUsd = (val) => `$ ${Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const formatBs = (val) => `Bs. ${Number(val || 0).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const exportClientsCsv = () => {
    const headers = [
      'Codigo_Profit',
      'Razon_Social',
      'RIF',
      'NIT',
      'Tipo_Cliente',
      'Estatus',
      'Condicion_Credito',
      'Saldo_Deudor_USD',
      'Saldo_Inicial_USD',
      'Limite_Credito_USD',
      'Dias_Credito',
      'Descuento_Pronto_Pago_Pct',
      'Descuento_Global_Pct',
      'Zona_Venta',
      'Segmento',
      'Vendedor_Asignado',
      'Tipo_IVA',
      'Contribuyente_Ordinario',
      'Contribuyente_Especial',
      'Porc_Retencion_Especial',
      'Direccion_Fiscal',
      'Direccion_Entrega',
      'Ciudad',
      'Estado',
      'ZIP',
      'Telefonos',
      'Fax',
      'Email',
      'Website',
      'Responsable',
      'Fecha_Registro',
      'Ultima_Factura',
      'Fecha_Ultima_Venta',
      'Monto_Ultima_Venta_USD',
      'Comentarios'
    ];

    const rows = filteredClients.map(c => [
      `"${c.codigo || c.id || ''}"`,
      `"${(c.nombre || '').replace(/"/g, '""')}"`,
      `"${c.rif || ''}"`,
      `"${c.nit || ''}"`,
      `"${c.tipoCliente || ''}"`,
      c.inactivo ? 'INACTIVO' : 'ACTIVO',
      c.sinCredito ? 'SIN_CREDITO' : 'CON_CREDITO',
      c.saldoDeudorUsd || 0,
      c.saldoInicial || 0,
      c.limiteCreditoUsd || 0,
      c.diasCredito || 0,
      c.descuentoProntoPago || 0,
      c.descuentoGlobal || 0,
      `"${c.zonaVenta || ''}"`,
      `"${c.segmento || ''}"`,
      `"${c.vendedorAsignado || ''}"`,
      `"${c.tipoIva || '1'}"`,
      c.esContribuyente ? 'SI' : 'NO',
      c.esContribuyenteEspecial ? 'SI' : 'NO',
      c.porcentajeRetencionEspecial || 0,
      `"${(c.direccion || '').replace(/"/g, '""')}"`,
      `"${(c.direccion2 || '').replace(/"/g, '""')}"`,
      `"${c.ciudad || ''}"`,
      `"${c.estado || ''}"`,
      `"${c.zip || ''}"`,
      `"${c.telefono || ''}"`,
      `"${c.fax || ''}"`,
      `"${c.email || ''}"`,
      `"${c.website || ''}"`,
      `"${(c.responsable || '').replace(/"/g, '""')}"`,
      `"${c.fechaRegistro || ''}"`,
      `"${c.ultimaFactura || ''}"`,
      `"${c.fechaUltimaVenta || ''}"`,
      c.montoUltimaVenta || 0,
      `"${(c.comentarios || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Directorio_Clientes_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenCreate = () => {
    setIsEditing(false);
    setClientForm({
      codigo: `CLI-${Date.now().toString().slice(-6)}`,
      nombre: '',
      rif: '',
      tipoCliente: 'Mayorista',
      direccion: 'Valencia, Carabobo',
      telefono: '',
      email: '',
      limiteCreditoUsd: 1000,
      diasCredito: 15,
      vendedorAsignado: 'OF',
      zonaVenta: '03',
      inactivo: false
    });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (client) => {
    if (!client) return;
    setIsEditing(true);
    setClientForm({
      id: client.id || client.codigo,
      codigo: client.codigo || client.id || '',
      nombre: client.nombre || '',
      rif: client.rif || '',
      tipoCliente: client.tipoCliente || 'Mayorista',
      direccion: client.direccion || '',
      telefono: client.telefono || '',
      email: client.email || '',
      limiteCreditoUsd: Number(client.limiteCreditoUsd || 0),
      diasCredito: Number(client.diasCredito || 0),
      vendedorAsignado: client.vendedorAsignado || 'OF',
      zonaVenta: client.zonaVenta || '03',
      inactivo: Boolean(client.inactivo)
    });
    setIsFormOpen(true);
  };

  const handleDeleteClientAction = async (client) => {
    if (!client || !onDeleteClient) return;
    const clientId = client.id || client.codigo;
    await onDeleteClient(clientId);
    if (selectedClientId === clientId) {
      setSelectedClientId(null);
    }
  };

  const notifyError = (msg) => {
    if (notify?.error) {
      notify.error(msg);
    } else {
      alert(msg);
    }
  };

  const handleSaveForm = async (e) => {
    e.preventDefault();
    if (!clientForm.codigo.trim()) {
      notifyError('El código de cliente es obligatorio');
      return;
    }
    if (!clientForm.nombre.trim()) {
      notifyError('La razón social o nombre es obligatoria');
      return;
    }
    if (!clientForm.rif.trim()) {
      notifyError('El RIF es obligatorio');
      return;
    }

    setIsSavingClient(true);
    try {
      const payload = {
        ...clientForm,
        id: clientForm.id || clientForm.codigo.trim(),
        codigo: clientForm.codigo.trim().toUpperCase(),
        nombre: clientForm.nombre.trim(),
        rif: clientForm.rif.trim().toUpperCase(),
        limiteCreditoUsd: Number(clientForm.limiteCreditoUsd || 0),
        diasCredito: Number(clientForm.diasCredito || 0)
      };
      if (onSaveClient) {
        await onSaveClient(payload);
      }
      setIsFormOpen(false);
      setSelectedClientId(payload.codigo);
    } catch (err) {
      console.error(err);
      notifyError('Error al guardar el cliente en Supabase');
    } finally {
      setIsSavingClient(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="clients-modal-backdrop" onClick={onClose}>
      <div className="clients-modal-container" onClick={e => e.stopPropagation()}>
        
        {/* ========================================================================= */}
        {/* 1. HEADER DEL MODAL (ADAPTA A DARK / LIGHT MODE) */}
        {/* ========================================================================= */}
        <div className="clients-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, var(--motorven-navy), var(--motorven-red))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 4px 12px rgba(0, 43, 122, 0.35)'
              }}
            >
              <Users size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontFamily: 'var(--font-heading)', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Directorio Oficial de Clientes
                </h2>
                <span className="badge badge-primary" style={{ fontFamily: 'var(--font-code)', fontSize: '0.72rem', letterSpacing: '0.5px' }}>
                  SUPABASE
                </span>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Base de datos sincronizada en tiempo real con Supabase Cloud • {totalClientes} Clientes en Cartera
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleOpenCreate}
              className="btn btn-primary btn-sm"
              style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Registrar un nuevo cliente en Supabase y sincronizar con Supabase"
            >
              <Plus size={14} /> Nuevo Cliente
            </button>
            <button
              onClick={exportClientsCsv}
              className="btn btn-secondary btn-sm"
              style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Descargar directorio completo en formato CSV"
            >
              <Download size={14} /> Exportar CSV ({filteredClients.length})
            </button>
            <button
              onClick={() => {
                generateAccountsReceivablePDF({
                  receivables: filteredClients.map(c => ({
                    factNum: c.codigo || c.coCli || 'CLI-00',
                    clienteNombre: c.nombre || c.razonSocial || 'Cliente Comercial',
                    vendedorId: c.vendedorAsignado || 'Directo',
                    fechaEmision: c.fechaRegistro || '2026-10-01',
                    fechaVencimiento: c.fechaUltimaVenta || '2026-10-24',
                    saldoUsd: Number(c.saldoDeudorUsd || 0),
                    isVencida: Number(c.saldoDeudorUsd || 0) > 0
                  })),
                  clients: filteredClients,
                  config: { tasaDolar: tasaBcv },
                  currentUser: null
                });
              }}
              className="btn btn-print-report btn-sm"
              style={{ fontSize: '0.78rem' }}
              title="Descargar listado oficial de clientes y saldos en PDF"
            >
              <Printer size={14} color="#ffffff" /> Imprimir Reporte
            </button>
            <button
              onClick={onClose}
              className="btn btn-icon"
              style={{
                background: 'var(--bg-tertiary)',
                color: 'var(--text-muted)',
                borderRadius: '8px',
                padding: '6px'
              }}
              title="Cerrar ventana"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. STATS KPI BAR (ADAPTA A DARK / LIGHT MODE) */}
        {/* ========================================================================= */}
        <div className="clients-stats-bar">
          <div className="clients-kpi-pill">
            <Users size={18} color="var(--motorven-navy-light)" />
            <div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-code)' }}>Total Clientes</div>
              <div style={{ fontSize: '1rem', fontWeight: 800, fontFamily: 'var(--font-tech)', color: 'var(--text-primary)' }}>{totalClientes}</div>
            </div>
          </div>

          <div className="clients-kpi-pill">
            <CheckCircle2 size={18} color="var(--semaforo-verde)" />
            <div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-code)' }}>Clientes Activos</div>
              <div style={{ fontSize: '1rem', fontWeight: 800, fontFamily: 'var(--font-tech)', color: 'var(--semaforo-verde)' }}>
                {activosCount} <span style={{ fontSize: '0.72rem', fontWeight: 400, color: 'var(--text-muted)' }}>({((activosCount / (totalClientes || 1)) * 100).toFixed(0)}%)</span>
              </div>
            </div>
          </div>

          <div className="clients-kpi-pill">
            <DollarSign size={18} color="var(--motorven-gold)" />
            <div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-code)' }}>Cartera CxC con Deuda</div>
              <div style={{ fontSize: '1rem', fontWeight: 800, fontFamily: 'var(--font-tech)', color: 'var(--motorven-gold)' }}>
                {conDeudaCount} <span style={{ fontSize: '0.72rem', fontWeight: 400, color: 'var(--text-muted)' }}>({formatUsd(totalDeudaUsd)})</span>
              </div>
            </div>
          </div>

          <div className="clients-kpi-pill">
            <CreditCard size={18} color="var(--motorven-red)" />
            <div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-code)' }}>Línea Total de Crédito</div>
              <div style={{ fontSize: '1rem', fontWeight: 800, fontFamily: 'var(--font-tech)', color: 'var(--text-primary)' }}>
                {formatUsd(totalLimiteCredito)}
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. BARRA DE FILTROS & BÚSQUEDA */}
        {/* ========================================================================= */}
        <div className="clients-filters-bar">
          {/* Input de Búsqueda */}
          <div className="search-wrapper" style={{ flex: '1 1 240px', minWidth: '200px' }}>
            <Search size={16} />
            <input
              type="text"
              placeholder="Buscar por código, razón social, RIF/NIT, teléfono, ciudad..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="input"
              style={{
                width: '100%',
                fontSize: '0.82rem',
                height: '36px'
              }}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer'
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Filtro Estatus */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="input"
            style={{ width: '130px', height: '36px', fontSize: '0.78rem', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
          >
            <option value="ALL">Estatus: Todos</option>
            <option value="ACTIVE">Solo Activos</option>
            <option value="INACTIVE">Solo Inactivos</option>
          </select>

          {/* Filtro Crédito */}
          <select
            value={creditFilter}
            onChange={e => setCreditFilter(e.target.value)}
            className="input"
            style={{ width: '145px', height: '36px', fontSize: '0.78rem', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
          >
            <option value="ALL">Crédito: Todos</option>
            <option value="WITH_CREDIT">Con Crédito</option>
            <option value="NO_CREDIT">Sin Crédito (Bloq)</option>
          </select>

          {/* Filtro Deuda */}
          <select
            value={debtFilter}
            onChange={e => setDebtFilter(e.target.value)}
            className="input"
            style={{ width: '145px', height: '36px', fontSize: '0.78rem', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
          >
            <option value="ALL">Saldo: Todos</option>
            <option value="WITH_DEBT">Con Saldo Deudor ($)</option>
            <option value="ZERO_DEBT">Solventes ($0.00)</option>
          </select>

          {/* Filtro Zona */}
          {availableZones.length > 0 && (
            <select
              value={zoneFilter}
              onChange={e => setZoneFilter(e.target.value)}
              className="input"
              style={{ width: '140px', height: '36px', fontSize: '0.78rem', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
            >
              <option value="ALL">Zona: Todas</option>
              {availableZones.map(z => (
                <option key={z} value={z}>Zona: {z}</option>
              ))}
            </select>
          )}

          {/* Filtro Vendedor */}
          {availableSellers.length > 0 && (
            <select
              value={sellerFilter}
              onChange={e => setSellerFilter(e.target.value)}
              className="input"
              style={{ width: '145px', height: '36px', fontSize: '0.78rem', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
            >
              <option value="ALL">Vendedor: Todos</option>
              {availableSellers.map(v => (
                <option key={v} value={v}>Vend: {v}</option>
              ))}
            </select>
          )}

          <div style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
            Mostrando <strong>{filteredClients.length}</strong> de {totalClientes}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 4. CONTENIDO PRINCIPAL EN 2 COLUMNAS (LISTA + FICHA TÉCNICA PROFIT) */}
        {/* ========================================================================= */}
        <div className="clients-modal-body" style={{ display: 'grid', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          
          {/* PANEL IZQUIERDO: LISTA DE CLIENTES */}
          <div className="clients-list-panel">
            {filteredClients.length === 0 ? (
              <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Users size={36} style={{ margin: '0 auto 10px', opacity: 0.4 }} />
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>No se encontraron clientes</div>
                <div style={{ fontSize: '0.75rem', marginTop: '4px' }}>Prueba ajustando los filtros o el término de búsqueda.</div>
              </div>
            ) : (
              filteredClients.map(c => {
                const isSelected = selectedClient && (selectedClient.id === c.id || selectedClient.codigo === c.codigo);
                const hasDebt = (Number(c.saldoDeudorUsd) || 0) > 0;
                const isInactive = Boolean(c.inactivo);
                const isCreditBlocked = Boolean(c.sinCredito);

                return (
                  <div
                    key={c.id || c.codigo}
                    onClick={() => setSelectedClientId(c.id || c.codigo)}
                    className={`clients-list-item ${isSelected ? 'selected' : ''}`}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontFamily: 'var(--font-code)',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              color: 'var(--motorven-gold)',
                              background: 'var(--bg-tertiary)',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              border: '1px solid var(--border-glass)'
                            }}
                          >
                            {c.codigo || c.id}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                            {c.rif || 'S/R'}
                          </span>
                          {isInactive && (
                            <span className="badge badge-danger" style={{ fontSize: '0.6rem', padding: '1px 4px' }}>
                              Inactivo
                            </span>
                          )}
                          {isCreditBlocked && (
                            <span className="badge badge-warning" style={{ fontSize: '0.6rem', padding: '1px 4px' }}>
                              Sin Crédito
                            </span>
                          )}
                        </div>

                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: '0.86rem',
                            marginTop: '4px',
                            color: 'var(--text-primary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                          title={c.nombre}
                        >
                          {c.nombre}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px', flexWrap: 'wrap' }}>
                          {c.ciudad && <span>📍 {c.ciudad}</span>}
                          {c.zonaVenta && <span>🗺️ {c.zonaVenta}</span>}
                          {c.vendedorAsignado && <span>👤 {c.vendedorAsignado}</span>}
                        </div>
                      </div>

                      {/* Deuda / Saldo */}
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div
                          style={{
                            fontFamily: 'var(--font-tech)',
                            fontSize: '0.88rem',
                            fontWeight: 800,
                            color: hasDebt ? 'var(--motorven-gold)' : 'var(--semaforo-verde)'
                          }}
                        >
                          {formatUsd(c.saldoDeudorUsd)}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                          {hasDebt ? 'Saldo Pendiente' : 'Solvente'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* PANEL DERECHO: DETALLE COMPLETO Y PARÁMETROS DE SUPABASE */}
          <div className="clients-detail-panel">
            {selectedClient ? (
              <>
                {/* Cabecera del Cliente Seleccionado */}
                <div className="clients-client-banner">
                  <div style={{ flex: 1, minWidth: '240px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontSize: '0.8rem',
                          fontFamily: 'var(--font-code)',
                          fontWeight: 800,
                          color: '#ffffff',
                          background: 'var(--motorven-navy)',
                          padding: '2px 8px',
                          borderRadius: '4px'
                        }}
                      >
                        {selectedClient.codigo || selectedClient.id}
                      </span>
                      <span className="badge badge-primary" style={{ fontSize: '0.72rem' }}>
                        {selectedClient.tipoCliente || 'Mayorista'}
                      </span>
                      {selectedClient.inactivo ? (
                        <span className="badge badge-danger" style={{ fontSize: '0.72rem' }}>
                          <AlertTriangle size={12} style={{ marginRight: '3px' }} /> Inactivo en Supabase
                        </span>
                      ) : (
                        <span className="badge badge-success" style={{ fontSize: '0.72rem' }}>
                          <CheckCircle2 size={12} style={{ marginRight: '3px' }} /> Activo Operacional
                        </span>
                      )}
                      {selectedClient.sinCredito ? (
                        <span className="badge badge-warning" style={{ fontSize: '0.72rem' }}>
                          <ShieldAlert size={12} style={{ marginRight: '3px' }} /> Bloqueado para Crédito
                        </span>
                      ) : (
                        <span className="badge badge-info" style={{ fontSize: '0.72rem' }}>
                          <ShieldCheck size={12} style={{ marginRight: '3px' }} /> Crédito Autorizado
                        </span>
                      )}
                    </div>

                    <h3 style={{ margin: '8px 0 2px 0', fontSize: '1.25rem', fontFamily: 'var(--font-heading)', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {selectedClient.nombre}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)', flexWrap: 'wrap' }}>
                      <span>RIF: <strong style={{ color: 'var(--text-primary)' }}>{selectedClient.rif || 'NO ASIGNADO'}</strong></span>
                      {selectedClient.nit && <span>NIT: <strong style={{ color: 'var(--text-primary)' }}>{selectedClient.nit}</strong></span>}
                    </div>
                  </div>

                  {/* Balance / Saldo Card & Acciones Rápidas */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                    <div
                      style={{
                        background: (Number(selectedClient.saldoDeudorUsd) || 0) > 0 ? 'var(--semaforo-amarillo-bg)' : 'var(--semaforo-verde-bg)',
                        border: `1px solid ${(Number(selectedClient.saldoDeudorUsd) || 0) > 0 ? 'rgba(217, 119, 6, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
                        padding: '0.85rem 1.25rem',
                        borderRadius: 'var(--radius-md)',
                        textAlign: 'right',
                        minWidth: '180px',
                        width: '100%'
                      }}
                    >
                      <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontFamily: 'var(--font-code)', color: 'var(--text-muted)', fontWeight: 600 }}>
                        Saldo Deudor Actual
                      </div>
                      <div style={{ fontSize: '1.35rem', fontWeight: 900, fontFamily: 'var(--font-tech)', color: (Number(selectedClient.saldoDeudorUsd) || 0) > 0 ? 'var(--motorven-gold)' : 'var(--semaforo-verde)' }}>
                        {formatUsd(selectedClient.saldoDeudorUsd)}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                        {formatBs((Number(selectedClient.saldoDeudorUsd) || 0) * tasaBcv)}
                      </div>
                    </div>

                    {/* Botonera de Enlace Funcional */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end', width: '100%' }}>
                      {onSelectClientForPOS && (
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => {
                            onSelectClientForPOS(selectedClient);
                            if (onClose) onClose();
                          }}
                          style={{
                            fontSize: '0.75rem',
                            padding: '6px 10px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                          title="Cargar este cliente en Punto de Venta / Facturación"
                        >
                          <ShoppingCart size={13} />
                          <span>Facturar en POS</span>
                        </button>
                      )}
                      {onSelectClientForPayment && (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => {
                            onSelectClientForPayment(selectedClient);
                            if (onClose) onClose();
                          }}
                          style={{
                            fontSize: '0.75rem',
                            padding: '6px 10px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                          title="Registrar cobro o abono para este cliente"
                        >
                          <CreditCard size={13} />
                          <span>Cobro / Abono</span>
                        </button>
                      )}
                      {onSaveClient && (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => handleOpenEdit(selectedClient)}
                          style={{
                            fontSize: '0.75rem',
                            padding: '6px 10px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                          title="Modificar datos del cliente en Supabase"
                        >
                          <Edit2 size={13} />
                          <span>Modificar</span>
                        </button>
                      )}
                      {onDeleteClient && (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => handleDeleteClientAction(selectedClient)}
                          style={{
                            fontSize: '0.75rem',
                            padding: '6px 10px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            color: 'var(--motorven-red)'
                          }}
                          title="Eliminar cliente de Supabase"
                        >
                          <Trash2 size={13} />
                          <span>Eliminar</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* SUB-PESTAÑAS DE PARÁMETROS PROFIT */}
                <div className="clients-subtabs-nav">
                  <button
                    onClick={() => setActiveTab('FICHA')}
                    className={`clients-subtab-btn ${activeTab === 'FICHA' ? 'active' : ''}`}
                  >
                    <ShieldCheck size={14} /> 1. Datos Fiscales & SENIAT
                  </button>
                  <button
                    onClick={() => setActiveTab('UBICACION')}
                    className={`clients-subtab-btn ${activeTab === 'UBICACION' ? 'active' : ''}`}
                  >
                    <MapPin size={14} /> 2. Ubicación & Contacto
                  </button>
                  <button
                    onClick={() => setActiveTab('CREDITO')}
                    className={`clients-subtab-btn ${activeTab === 'CREDITO' ? 'active' : ''}`}
                  >
                    <CreditCard size={14} /> 3. Comercial & Crédito
                  </button>
                  <button
                    onClick={() => setActiveTab('HISTORIAL')}
                    className={`clients-subtab-btn ${activeTab === 'HISTORIAL' ? 'active' : ''}`}
                  >
                    <Calendar size={14} /> 4. Historial de Ventas
                  </button>
                </div>

                {/* CONTENIDO TAB 1: DATOS FISCALES & SENIAT */}
                {activeTab === 'FICHA' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem' }}>
                    <div className="clients-info-card">
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>CÓDIGO SUPABASE (co_cli)</span>
                      <div style={{ fontSize: '0.95rem', fontWeight: 800, fontFamily: 'var(--font-code)', color: 'var(--text-primary)', marginTop: '2px' }}>
                        {selectedClient.codigo || selectedClient.id}
                      </div>
                    </div>

                    <div className="clients-info-card">
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>DOCUMENTO FISCAL (rif)</span>
                      <div style={{ fontSize: '0.95rem', fontWeight: 800, fontFamily: 'var(--font-code)', color: 'var(--motorven-gold)', marginTop: '2px' }}>
                        {selectedClient.rif || 'NO ASIGNADO'}
                      </div>
                    </div>

                    <div className="clients-info-card">
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>N.I.T. (nit)</span>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'var(--font-code)', color: 'var(--text-primary)', marginTop: '2px' }}>
                        {selectedClient.nit || 'NO REGISTRADO'}
                      </div>
                    </div>

                    <div className="clients-info-card">
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>TIPO DE CLIENTE (tipo)</span>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                        {selectedClient.tipoCliente || 'Mayorista'}
                      </div>
                    </div>

                    <div className="clients-info-card">
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>TIPO DE IVA (tipo_iva)</span>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                        {selectedClient.tipoIva === '1' ? 'Tipo 1 (16% General)' : `Tipo ${selectedClient.tipoIva || '1'}`}
                      </div>
                    </div>

                    <div className="clients-info-card">
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>CONTRIBUYENTE SENIAT (contribu)</span>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: selectedClient.esContribuyente ? 'var(--semaforo-verde)' : 'var(--text-muted)', marginTop: '2px' }}>
                        {selectedClient.esContribuyente ? 'SÍ (Contribuyente Ordinario)' : 'NO (Persona Natural / Consumidor)'}
                      </div>
                    </div>

                    <div className="clients-info-card">
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>AGENTE RETENCIÓN ESPECIAL (contribu_e)</span>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: selectedClient.esContribuyenteEspecial ? 'var(--motorven-red)' : 'var(--text-muted)', marginTop: '2px' }}>
                        {selectedClient.esContribuyenteEspecial ? 'SÍ (Contribuyente Especial SENIAT)' : 'NO'}
                      </div>
                    </div>

                    <div className="clients-info-card">
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>% RETENCIÓN ESPECIAL (porc_esp)</span>
                      <div style={{ fontSize: '0.95rem', fontWeight: 800, fontFamily: 'var(--font-tech)', color: 'var(--text-primary)', marginTop: '2px' }}>
                        {selectedClient.porcentajeRetencionEspecial ? `${selectedClient.porcentajeRetencionEspecial}%` : '0.00%'}
                      </div>
                    </div>
                  </div>
                )}

                {/* CONTENIDO TAB 2: UBICACIÓN & CONTACTO */}
                {activeTab === 'UBICACION' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem' }}>
                    <div className="clients-info-card" style={{ gridColumn: '1 / -1' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>DIRECCIÓN FISCAL PRINCIPAL (direc1)</span>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px' }}>
                        {selectedClient.direccion || 'Sin dirección fiscal registrada'}
                      </div>
                    </div>

                    {selectedClient.direccion2 && (
                      <div className="clients-info-card" style={{ gridColumn: '1 / -1' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>DIRECCIÓN DE ENTREGA / DESPACHO (direc2)</span>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '4px' }}>
                          {selectedClient.direccion2}
                        </div>
                      </div>
                    )}

                    <div className="clients-info-card">
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>CIUDAD (ciudad)</span>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                        {selectedClient.ciudad || 'No especificada'}
                      </div>
                    </div>

                    <div className="clients-info-card">
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>ESTADO / REGIÓN (estado)</span>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                        {selectedClient.estado || 'No especificado'}
                      </div>
                    </div>

                    <div className="clients-info-card">
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>CÓDIGO POSTAL (zip)</span>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'var(--font-code)', color: 'var(--text-primary)', marginTop: '2px' }}>
                        {selectedClient.zip || 'N/A'}
                      </div>
                    </div>

                    <div className="clients-info-card">
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>TELÉFONOS (telefonos)</span>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'var(--font-code)', color: 'var(--text-primary)', marginTop: '2px' }}>
                        {selectedClient.telefono || 'Sin teléfono registrado'}
                      </div>
                    </div>

                    <div className="clients-info-card">
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>CORREO ELECTRÓNICO (email)</span>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--motorven-navy-light)', marginTop: '2px' }}>
                        {selectedClient.email ? (
                          <a href={`mailto:${selectedClient.email}`} style={{ color: 'inherit', textDecoration: 'none' }}>
                            {selectedClient.email}
                          </a>
                        ) : 'Sin correo registrado'}
                      </div>
                    </div>

                    <div className="clients-info-card">
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>PERSONA CONTACTO / RESPONSABLE (respons)</span>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                        {selectedClient.responsable || 'No especificado'}
                      </div>
                    </div>

                    {selectedClient.website && (
                      <div className="clients-info-card">
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>SITIO WEB (website)</span>
                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--motorven-navy-light)', marginTop: '2px' }}>
                          <a href={selectedClient.website.startsWith('http') ? selectedClient.website : `https://${selectedClient.website}`} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
                            {selectedClient.website}
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* CONTENIDO TAB 3: COMERCIAL & CRÉDITO */}
                {activeTab === 'CREDITO' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem' }}>
                    <div className="clients-info-card" style={{ borderLeft: '4px solid var(--motorven-gold)' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>SALDO DEUDOR (saldo)</span>
                      <div style={{ fontSize: '1.2rem', fontWeight: 900, fontFamily: 'var(--font-tech)', color: 'var(--motorven-gold)', marginTop: '2px' }}>
                        {formatUsd(selectedClient.saldoDeudorUsd)}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                        {formatBs((Number(selectedClient.saldoDeudorUsd) || 0) * tasaBcv)}
                      </div>
                    </div>

                    <div className="clients-info-card">
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>LÍMITE DE CRÉDITO (mont_cre)</span>
                      <div style={{ fontSize: '1.2rem', fontWeight: 900, fontFamily: 'var(--font-tech)', color: 'var(--text-primary)', marginTop: '2px' }}>
                        {formatUsd(selectedClient.limiteCreditoUsd)}
                      </div>
                    </div>

                    <div className="clients-info-card">
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>PLAZO DE PAGO (plaz_pag)</span>
                      <div style={{ fontSize: '1.2rem', fontWeight: 900, fontFamily: 'var(--font-tech)', color: 'var(--text-primary)', marginTop: '2px' }}>
                        {selectedClient.diasCredito || 0} Días
                      </div>
                    </div>

                    <div className="clients-info-card">
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>SALDO INICIAL (saldo_ini)</span>
                      <div style={{ fontSize: '1.1rem', fontWeight: 700, fontFamily: 'var(--font-tech)', color: 'var(--text-primary)', marginTop: '2px' }}>
                        {formatUsd(selectedClient.saldoInicial)}
                      </div>
                    </div>

                    <div className="clients-info-card">
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>DESCUENTO PRONTO PAGO (desc_ppago)</span>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'var(--font-tech)', color: 'var(--semaforo-verde)', marginTop: '2px' }}>
                        {selectedClient.descuentoProntoPago ? `${selectedClient.descuentoProntoPago}%` : '0.00%'}
                      </div>
                    </div>

                    <div className="clients-info-card">
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>DESCUENTO GLOBAL (desc_glob)</span>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800, fontFamily: 'var(--font-tech)', color: 'var(--semaforo-verde)', marginTop: '2px' }}>
                        {selectedClient.descuentoGlobal ? `${selectedClient.descuentoGlobal}%` : '0.00%'}
                      </div>
                    </div>

                    <div className="clients-info-card">
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>ZONA DE VENTA (co_zon)</span>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                        {selectedClient.zonaVenta || 'Sin Zona Asignada'}
                      </div>
                    </div>

                    <div className="clients-info-card">
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>SEGMENTO DE MERCADO (co_seg)</span>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                        {selectedClient.segmento || 'General'}
                      </div>
                    </div>

                    <div className="clients-info-card">
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>VENDEDOR ASIGNADO (co_ven)</span>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                        {selectedClient.vendedorAsignado || 'Sin Vendedor Asignado'}
                      </div>
                    </div>
                  </div>
                )}

                {/* CONTENIDO TAB 4: HISTORIAL DE VENTAS & AUDITORÍA */}
                {activeTab === 'HISTORIAL' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem' }}>
                    <div className="clients-info-card">
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>FECHA DE REGISTRO (fecha_reg)</span>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'var(--font-code)', color: 'var(--text-primary)', marginTop: '2px' }}>
                        {selectedClient.fechaRegistro || 'No registrada'}
                      </div>
                    </div>

                    <div className="clients-info-card">
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>ÚLTIMA FACTURA EMITIDA (fac_ult_ve)</span>
                      <div style={{ fontSize: '0.95rem', fontWeight: 800, fontFamily: 'var(--font-code)', color: 'var(--motorven-gold)', marginTop: '2px' }}>
                        {selectedClient.ultimaFactura || 'Sin facturas registradas'}
                      </div>
                    </div>

                    <div className="clients-info-card">
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>FECHA ÚLTIMA VENTA (fec_ult_ve)</span>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, fontFamily: 'var(--font-code)', color: 'var(--text-primary)', marginTop: '2px' }}>
                        {selectedClient.fechaUltimaVenta || 'N/A'}
                      </div>
                    </div>

                    <div className="clients-info-card">
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>MONTO ÚLTIMA VENTA (net_ult_ve)</span>
                      <div style={{ fontSize: '1.1rem', fontWeight: 900, fontFamily: 'var(--font-tech)', color: 'var(--text-primary)', marginTop: '2px' }}>
                        {formatUsd(selectedClient.montoUltimaVenta)}
                      </div>
                    </div>

                    <div className="clients-info-card" style={{ gridColumn: '1 / -1' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>COMENTARIOS & OBSERVACIONES INTERNAS (comentario)</span>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginTop: '6px', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                        {selectedClient.comentarios || 'Sin observaciones registradas para este cliente en Supabase.'}
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                Selecciona un cliente de la lista para ver todos sus parámetros técnicos de Supabase.
              </div>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 5. MODAL FLOTANTE DE CREACIÓN / EDICIÓN DE CLIENTE (SUPABASE) */}
        {/* ========================================================================= */}
        {isFormOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(5, 12, 28, 0.82)',
              backdropFilter: 'blur(6px)',
              zIndex: 11000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px'
            }}
            onClick={() => !isSavingClient && setIsFormOpen(false)}
          >
            <div
              style={{
                background: 'var(--bg-primary, #0c1427)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-glass, rgba(255, 255, 255, 0.12))',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '680px',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 24px 60px rgba(0, 0, 0, 0.65)',
                display: 'flex',
                flexDirection: 'column'
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div
                style={{
                  padding: '18px 24px',
                  borderBottom: '1px solid var(--border-glass, rgba(255, 255, 255, 0.1))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: 'var(--bg-secondary, #111c38)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: isEditing
                        ? 'linear-gradient(135deg, var(--motorven-navy), #0ea5e9)'
                        : 'linear-gradient(135deg, var(--motorven-navy), var(--motorven-red))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#ffffff'
                    }}
                  >
                    {isEditing ? <Edit2 size={20} /> : <Plus size={22} />}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, fontFamily: 'var(--font-heading)' }}>
                      {isEditing ? 'Modificar Cliente en Supabase' : 'Registrar Nuevo Cliente en Supabase'}
                    </h3>
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                      Sincronización bidireccional automática con Supabase
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  disabled={isSavingClient}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '6px'
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSaveForm} style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, marginBottom: '5px', color: 'var(--text-muted)' }}>
                      CÓDIGO (co_cli) *
                    </label>
                    <input
                      type="text"
                      required
                      value={clientForm.codigo}
                      onChange={e => setClientForm({ ...clientForm, codigo: e.target.value.toUpperCase() })}
                      disabled={isEditing || isSavingClient}
                      placeholder="Ej: CLI-00123"
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-glass, #334155)',
                        background: isEditing ? 'rgba(255,255,255,0.04)' : 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-code)',
                        fontSize: '0.85rem'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, marginBottom: '5px', color: 'var(--text-muted)' }}>
                      RIF (rif) *
                    </label>
                    <input
                      type="text"
                      required
                      value={clientForm.rif}
                      onChange={e => setClientForm({ ...clientForm, rif: e.target.value.toUpperCase() })}
                      disabled={isSavingClient}
                      placeholder="Ej: J-12345678-9"
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-glass, #334155)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-code)',
                        fontSize: '0.85rem'
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, marginBottom: '5px', color: 'var(--text-muted)' }}>
                    RAZÓN SOCIAL / NOMBRE (cli_des) *
                  </label>
                  <input
                    type="text"
                    required
                    value={clientForm.nombre}
                    onChange={e => setClientForm({ ...clientForm, nombre: e.target.value })}
                    disabled={isSavingClient}
                    placeholder="Ej: Repuestos y Servicios El Motor C.A."
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-glass, #334155)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: '0.88rem'
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, marginBottom: '5px', color: 'var(--text-muted)' }}>
                      TIPO DE CLIENTE
                    </label>
                    <select
                      value={clientForm.tipoCliente}
                      onChange={e => setClientForm({ ...clientForm, tipoCliente: e.target.value })}
                      disabled={isSavingClient}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-glass, #334155)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem'
                      }}
                    >
                      <option value="Mayorista">Mayorista</option>
                      <option value="Minorista">Minorista</option>
                      <option value="Taller">Taller Mecánico</option>
                      <option value="Distribuidor">Distribuidor</option>
                      <option value="Corporativo">Corporativo / Flotas</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, marginBottom: '5px', color: 'var(--text-muted)' }}>
                      VENDEDOR ASIGNADO (co_ven)
                    </label>
                    <select
                      value={clientForm.vendedorAsignado}
                      onChange={e => {
                        const newVen = e.target.value;
                        const sellerZoneMap = {
                          FS: '01',
                          YC: '02',
                          JR: '02',
                          VV: '03',
                          CB: '03',
                          CM: '04',
                          KB: '05',
                          VP: '06',
                          MS: '07',
                          OF: '07'
                        };
                        const mappedZone = sellerZoneMap[newVen] || clientForm.zonaVenta;
                        setClientForm({ ...clientForm, vendedorAsignado: newVen, zonaVenta: mappedZone });
                      }}
                      disabled={isSavingClient}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-glass, #334155)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem'
                      }}
                    >
                      <option value="FS">FS - Freddy Sepulveda · Zona 01</option>
                      <option value="YC">YC - Yheyson Calderon · Zona 02</option>
                      <option value="JR">JR - Juan Rodriguez · Zona 02</option>
                      <option value="VV">VV - Victor Veloz · Zona 03</option>
                      <option value="CB">CB - Carlos Becerra · Zona 03</option>
                      <option value="CM">CM - Carlos Machado · Zona 04</option>
                      <option value="KB">KB - Katherine Becerra · Zona 05</option>
                      <option value="VP">VP - Vanessa Prieto · Zona 06</option>
                      <option value="MS">MS - Michael Santana · Zona 07</option>
                      <option value="OF">OF - Oficina Principal · Zona 07</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, marginBottom: '5px', color: 'var(--text-muted)' }}>
                      ZONA DE VENTA (co_zon)
                    </label>
                    <select
                      value={clientForm.zonaVenta}
                      onChange={e => {
                        const newZon = e.target.value;
                        const sellerZoneMap = {
                          FS: '01',
                          YC: '02',
                          JR: '02',
                          VV: '03',
                          CB: '03',
                          CM: '04',
                          KB: '05',
                          VP: '06',
                          MS: '07',
                          OF: '07'
                        };
                        const zonePrimarySeller = {
                          '01': 'FS',
                          '02': 'YC',
                          '03': 'VV',
                          '04': 'CM',
                          '05': 'KB',
                          '06': 'VP',
                          '07': 'MS'
                        };
                        const currentSellerZone = sellerZoneMap[clientForm.vendedorAsignado];
                        if (currentSellerZone && currentSellerZone !== newZon) {
                          const ok = window.confirm(
                            'Se está seleccionando al vendedor fuera de su zona correspondiente, ¿desea continuar?'
                          );
                          if (!ok) {
                            setClientForm({
                              ...clientForm,
                              zonaVenta: newZon,
                              vendedorAsignado: zonePrimarySeller[newZon] || clientForm.vendedorAsignado
                            });
                            return;
                          }
                        }
                        setClientForm({ ...clientForm, zonaVenta: newZon });
                      }}
                      disabled={isSavingClient}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-glass, #334155)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem'
                      }}
                    >
                      <option value="01">01 - Pto cabello - Juan jose Mora (FS)</option>
                      <option value="02">02 - Isabelica - Pque Valencia - Flor Amarillo (YC / JR)</option>
                      <option value="03">03 - San diego - Naguanagua (VV / CB)</option>
                      <option value="04">04 - Zona Sur de Valencia (CM)</option>
                      <option value="05">05 - Florida-Tocuyito-Bejuma-Montalban-Miranda (KB)</option>
                      <option value="06">06 - Los Guayos-Guacara-San Joaquin-Mariara (VP)</option>
                      <option value="07">07 - Carabobo (MS / OF)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, marginBottom: '5px', color: 'var(--text-muted)' }}>
                      TELÉFONO DE CONTACTO
                    </label>
                    <input
                      type="text"
                      value={clientForm.telefono}
                      onChange={e => setClientForm({ ...clientForm, telefono: e.target.value })}
                      disabled={isSavingClient}
                      placeholder="Ej: 0241-8712345 / 0414-1234567"
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-glass, #334155)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem'
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, marginBottom: '5px', color: 'var(--text-muted)' }}>
                      CORREO ELECTRÓNICO (email)
                    </label>
                    <input
                      type="email"
                      value={clientForm.email}
                      onChange={e => setClientForm({ ...clientForm, email: e.target.value })}
                      disabled={isSavingClient}
                      placeholder="contacto@cliente.com"
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-glass, #334155)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, marginBottom: '5px', color: 'var(--text-muted)' }}>
                      DIRECCIÓN FISCAL / DESPACHO
                    </label>
                    <input
                      type="text"
                      value={clientForm.direccion}
                      onChange={e => setClientForm({ ...clientForm, direccion: e.target.value })}
                      disabled={isSavingClient}
                      placeholder="Ej: Av. Bolívar Norte, Valencia"
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-glass, #334155)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem'
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, marginBottom: '5px', color: 'var(--text-muted)' }}>
                      LÍMITE DE CRÉDITO (USD)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={clientForm.limiteCreditoUsd}
                      onChange={e => setClientForm({ ...clientForm, limiteCreditoUsd: e.target.value })}
                      disabled={isSavingClient}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-glass, #334155)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-tech)',
                        fontSize: '0.9rem'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, marginBottom: '5px', color: 'var(--text-muted)' }}>
                      DÍAS DE CRÉDITO
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="360"
                      value={clientForm.diasCredito}
                      onChange={e => setClientForm({ ...clientForm, diasCredito: e.target.value })}
                      disabled={isSavingClient}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-glass, #334155)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        fontFamily: 'var(--font-tech)',
                        fontSize: '0.9rem'
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <input
                    type="checkbox"
                    id="clientInactivoCheck"
                    checked={clientForm.inactivo}
                    onChange={e => setClientForm({ ...clientForm, inactivo: e.target.checked })}
                    disabled={isSavingClient}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--motorven-red)' }}
                  />
                  <label htmlFor="clientInactivoCheck" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                    Marcar cliente como inactivo en Supabase
                  </label>
                </div>

                {/* Footer Buttons */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border-glass, rgba(255,255,255,0.08))' }}>
                  <button
                    type="button"
                    onClick={() => setIsFormOpen(false)}
                    disabled={isSavingClient}
                    className="btn btn-secondary"
                    style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingClient}
                    className="btn btn-primary"
                    style={{
                      padding: '8px 20px',
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'linear-gradient(135deg, var(--motorven-navy), var(--motorven-red))'
                    }}
                  >
                    {isSavingClient ? (
                      <>
                        <RotateCcw size={15} className="spin" /> Guardando en Supabase...
                      </>
                    ) : (
                      <>
                        <Save size={15} /> {isEditing ? 'Guardar Cambios' : 'Registrar Cliente'}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
