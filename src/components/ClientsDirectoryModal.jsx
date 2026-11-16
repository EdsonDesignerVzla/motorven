import React, { useState, useMemo } from 'react';
import {
  X,
  Users,
  Search,
  MapPin,
  CreditCard,
  Calendar,
  DollarSign,
  ShieldCheck,
  ShieldAlert,
  Download,
  CheckCircle2,
  AlertTriangle,
  ShoppingCart,
  Printer,
  Plus,
  Edit2,
  Trash2,
  Clock,
  Image as ImageIcon,
  Eye,
  Power,
  FileText
} from 'lucide-react';
import { generateAccountsReceivablePDF, generateCreditApplicationAndPromissoryNotePDF } from '../services/pdfReportService';
import { canApproveClients, getClientApprovalStatus, isClientApproved } from '../services/authService';
import {
  SENIAT_CONTRIBUTOR_TYPES,
  resolveClientContributorType,
  computeContributorTypeCounts
} from '../services/fiscalService';
import { reconcileClientsWithRealCxc } from '../utils/cxcUtils';
import { useNotification } from '../context/NotificationContext';
import ImagePreviewLightbox from './ImagePreviewLightbox';
import ClientRegistrationModal from './ClientRegistrationModal';
import ClientDeleteConfirmModal from './ClientDeleteConfirmModal';

export default function ClientsDirectoryModal({
  isOpen,
  onClose,
  clients = [],
  profitInvoices = [],
  sales = [],
  tasaBcv = 42.50,
  currentUser,
  profitSellers = [],
  profitZones = [],
  onSaveClient,
  onDeleteClient,
  onApproveClient,
  onRejectClient,
  onSelectClientForPayment,
  onSelectClientForPOS,
  onSelectClientForOrder
}) {
  const notify = useNotification();
  const userCanApproveClients = canApproveClients(currentUser);
  const [isProcessingApproval, setIsProcessingApproval] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL, ACTIVE, INACTIVE
  const [contributorFilter, setContributorFilter] = useState('ALL'); // ALL, J, V, E, G, P
  const [creditFilter, setCreditFilter] = useState('ALL'); // ALL, WITH_CREDIT, NO_CREDIT
  const [debtFilter, setDebtFilter] = useState('ALL'); // ALL, WITH_DEBT, ZERO_DEBT
  const [zoneFilter, setZoneFilter] = useState('ALL');
  const [sellerFilter, setSellerFilter] = useState('ALL');
  const [activeTab, setActiveTab] = useState('FICHA'); // FICHA, UBICACION, CREDITO, HISTORIAL

  // Estado del Formulario CRUD (Crear / Modificar usando ClientRegistrationModal)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClientTarget, setEditingClientTarget] = useState(null);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  // Estado del Modal de Eliminación con Doble Seguridad (Paso 1 + Paso 2)
  const [clientToDelete, setClientToDelete] = useState(null);
  const [isDeletingClient, setIsDeletingClient] = useState(false);

  // Reconciliar saldos CxC reales por cliente desde profitInvoices + sales (cuando estén cargados)
  const { clients: reconciledClients } = useMemo(
    () => reconcileClientsWithRealCxc({ clients, profitInvoices, sales, tasaBcv }),
    [clients, profitInvoices, sales, tasaBcv]
  );

  // Extraer Zonas y Vendedores únicos
  const availableZones = useMemo(() => {
    const zones = new Set();
    reconciledClients.forEach(c => {
      if (c.zonaVenta && c.zonaVenta.trim()) zones.add(c.zonaVenta.trim());
    });
    return Array.from(zones).sort();
  }, [reconciledClients]);

  const availableSellers = useMemo(() => {
    const sellers = new Set();
    reconciledClients.forEach(c => {
      if (c.vendedorAsignado && c.vendedorAsignado.trim()) sellers.add(c.vendedorAsignado.trim());
    });
    return Array.from(sellers).sort();
  }, [reconciledClients]);

  const clientContributorCounts = useMemo(
    () => computeContributorTypeCounts(reconciledClients),
    [reconciledClients]
  );

  // Clientes filtrados
  const filteredClients = useMemo(() => {
    return reconciledClients.filter(c => {
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

      // Filtro Clasificación SENIAT (J / V / E / G / P)
      if (contributorFilter !== 'ALL' && resolveClientContributorType(c) !== contributorFilter) return false;

      // Filtro Estatus / Aprobación
      const approvalStatus = getClientApprovalStatus(c);
      if (statusFilter === 'ACTIVE' && (c.inactivo || approvalStatus !== 'APROBADO')) return false;
      if (statusFilter === 'INACTIVE' && !c.inactivo) return false;
      if (statusFilter === 'PENDING' && approvalStatus !== 'PENDIENTE') return false;
      if (statusFilter === 'REJECTED' && approvalStatus !== 'RECHAZADO') return false;

      // Filtro Crédito
      if (creditFilter === 'WITH_CREDIT' && c.sinCredito) return false;
      if (creditFilter === 'NO_CREDIT' && !c.sinCredito) return false;

      // Filtro Deuda
      const saldo = Number(c.saldoDeudorUsd || 0);
      if (debtFilter === 'WITH_DEBT' && saldo <= 0.01) return false;
      if (debtFilter === 'ZERO_DEBT' && saldo > 0.01) return false;

      // Filtro Zona
      if (zoneFilter !== 'ALL' && c.zonaVenta !== zoneFilter) return false;

      // Filtro Vendedor
      if (sellerFilter !== 'ALL' && c.vendedorAsignado !== sellerFilter) return false;

      return true;
    });
  }, [reconciledClients, searchTerm, contributorFilter, statusFilter, creditFilter, debtFilter, zoneFilter, sellerFilter]);

  // Cliente seleccionado (por defecto el primero de la lista o el seleccionado)
  const selectedClient = useMemo(() => {
    if (!reconciledClients || reconciledClients.length === 0) return null;
    if (selectedClientId) {
      const found = reconciledClients.find(c => (c.id === selectedClientId || c.codigo === selectedClientId));
      if (found) return found;
    }
    return filteredClients.length > 0 ? filteredClients[0] : reconciledClients[0];
  }, [reconciledClients, selectedClientId, filteredClients]);

  // Métricas rápidas
  const totalClientes = reconciledClients.length;
  const activosCount = reconciledClients.filter(c => !c.inactivo).length;
  const conDeudaCount = reconciledClients.filter(c => (Number(c.saldoDeudorUsd) || 0) > 0.01).length;
  const totalDeudaUsd = reconciledClients.reduce((acc, c) => acc + (Number(c.saldoDeudorUsd) || 0), 0);
  const totalLimiteCredito = reconciledClients.reduce((acc, c) => acc + (Number(c.limiteCreditoUsd) || 0), 0);

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
    setEditingClientTarget(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (client) => {
    if (!client) return;
    setEditingClientTarget(client);
    setIsFormOpen(true);
  };

  const handleToggleClientStatus = async (client) => {
    if (!client || !onSaveClient || !userCanApproveClients) return;
    setIsTogglingStatus(true);
    try {
      const nextInactive = !client.inactivo;
      const saved = await onSaveClient({
        ...client,
        inactivo: nextInactive,
        estadoAprobacion: client.estadoAprobacion || 'APROBADO'
      });
      if (saved) {
        setSelectedClientId(saved.id || saved.codigo);
      }
    } catch (err) {
      console.error(err);
      notify?.error?.('No se pudo actualizar el estatus del cliente.');
    } finally {
      setIsTogglingStatus(false);
    }
  };

  const handleRequestDeleteClient = (client) => {
    if (!client || !onDeleteClient || !userCanApproveClients) return;
    setClientToDelete(client);
  };

  const handlePrintCreditApplication = (client) => {
    if (!client) return;
    try {
      generateCreditApplicationAndPromissoryNotePDF({
        client,
        config: { tasaDolar: tasaBcv },
        currentUser
      });
      notify?.success?.('Solicitud de Crédito y Pagaré Mercantil generado con éxito en PDF');
    } catch (err) {
      console.error('Error generando Solicitud y Pagaré Mercantil:', err);
      notify?.error?.('Error al generar la Solicitud y Pagaré Mercantil');
    }
  };

  const handleConfirmDeleteClient = async () => {
    if (!clientToDelete || !onDeleteClient) return;
    const clientId = clientToDelete.id || clientToDelete.codigo;
    setIsDeletingClient(true);
    try {
      const deleted = await onDeleteClient(clientId, { skipConfirm: true });
      if (deleted !== false) {
        if (selectedClientId === clientId || selectedClientId === clientToDelete.codigo) {
          setSelectedClientId(null);
        }
        setClientToDelete(null);
      }
    } catch (err) {
      console.error(err);
      notify?.error?.('Error al eliminar el cliente.');
    } finally {
      setIsDeletingClient(false);
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {onSaveClient && (
              <button
                type="button"
                onClick={handleOpenCreate}
                className="btn btn-primary btn-sm"
                style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                title={userCanApproveClients ? 'Registrar un nuevo cliente activo en el sistema' : 'Solicitar registro de nuevo cliente para aprobación en Caja Principal'}
              >
                <Plus size={14} /> {userCanApproveClients ? 'Nuevo Cliente' : 'Solicitar Cliente'}
              </button>
            )}
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
                    fechaVencimiento: c.openDocs?.[0]?.fechaVencimiento || c.fechaUltimaVenta || '2026-10-24',
                    saldoUsd: Number(c.saldoDeudorUsd || 0),
                    isVencida: Number(c.saldoVencidoUsd ?? c.saldoDeudorUsd ?? 0) > 0.01
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

          {/* Filtro Clasificación SENIAT */}
          <select
            value={contributorFilter}
            onChange={e => setContributorFilter(e.target.value)}
            className="input"
            style={{ width: '215px', height: '36px', fontSize: '0.78rem', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
            title="Filtrar por clasificación SENIAT (J, V, E, G, P)"
          >
            <option value="ALL">Todos los tipos ({clients.length})</option>
            {SENIAT_CONTRIBUTOR_TYPES.map(t => (
              <option key={t.code} value={t.code} title={t.description}>
                {t.label} ({clientContributorCounts[t.code] || 0})
              </option>
            ))}
          </select>

          {/* Filtro Estatus */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="input"
            style={{ width: '165px', height: '36px', fontSize: '0.78rem', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
          >
            <option value="ALL">Estatus: Todos</option>
            <option value="ACTIVE">Solo Activos</option>
            <option value="PENDING">⏳ Pendientes ({clients.filter(cl => getClientApprovalStatus(cl) === 'PENDIENTE').length})</option>
            <option value="REJECTED">✕ Rechazados</option>
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
                const hasDebt = (Number(c.saldoDeudorUsd) || 0) > 0.01;
                const hasOverdue = (Number(c.saldoVencidoUsd) || 0) > 0.01;
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
                          {getClientApprovalStatus(c) === 'PENDIENTE' && (
                            <span className="badge badge-warning" style={{ fontSize: '0.6rem', padding: '1px 5px' }}>
                              ⏳ Pendiente
                            </span>
                          )}
                          {getClientApprovalStatus(c) === 'RECHAZADO' && (
                            <span className="badge badge-danger" style={{ fontSize: '0.6rem', padding: '1px 5px' }}>
                              Rechazado
                            </span>
                          )}
                          {isInactive && getClientApprovalStatus(c) === 'APROBADO' && (
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
                            color: hasOverdue ? 'var(--semaforo-rojo, #ef4444)' : hasDebt ? 'var(--motorven-gold)' : 'var(--semaforo-verde)'
                          }}
                        >
                          {formatUsd(c.saldoDeudorUsd)}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: hasOverdue ? 'var(--semaforo-rojo, #ef4444)' : 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                          {hasDebt
                            ? (c.openDocsCount > 0
                                ? `${c.openDocsCount} doc${c.openDocsCount > 1 ? 's' : ''} • ${hasOverdue ? `Venc. ${c.maxDiasMora || 0}d` : 'Al Día'}`
                                : 'Saldo Pendiente')
                            : 'Solvente'}
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
                      {getClientApprovalStatus(selectedClient) === 'PENDIENTE' && (
                        <span className="badge badge-warning" style={{ fontSize: '0.72rem' }}>
                          <Clock size={12} style={{ marginRight: '3px' }} /> Pendiente Aprobación (Caja)
                        </span>
                      )}
                      {getClientApprovalStatus(selectedClient) === 'RECHAZADO' && (
                        <span className="badge badge-danger" style={{ fontSize: '0.72rem' }}>
                          <AlertTriangle size={12} style={{ marginRight: '3px' }} /> Solicitud Rechazada
                        </span>
                      )}
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
                        background: (Number(selectedClient.saldoDeudorUsd) || 0) > 0.01 ? 'var(--semaforo-amarillo-bg)' : 'var(--semaforo-verde-bg)',
                        border: `1px solid ${(Number(selectedClient.saldoDeudorUsd) || 0) > 0.01 ? 'rgba(217, 119, 6, 0.4)' : 'rgba(16, 185, 129, 0.4)'}`,
                        padding: '0.85rem 1.25rem',
                        borderRadius: 'var(--radius-md)',
                        textAlign: 'right',
                        minWidth: '195px',
                        width: '100%'
                      }}
                    >
                      <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontFamily: 'var(--font-code)', color: 'var(--text-muted)', fontWeight: 600 }}>
                        Saldo Deudor Actual
                      </div>
                      <div style={{ fontSize: '1.35rem', fontWeight: 900, fontFamily: 'var(--font-tech)', color: (Number(selectedClient.saldoDeudorUsd) || 0) > 0.01 ? 'var(--motorven-gold)' : 'var(--semaforo-verde)' }}>
                        {formatUsd(selectedClient.saldoDeudorUsd)}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                        {formatBs((Number(selectedClient.saldoDeudorUsd) || 0) * tasaBcv)}
                      </div>
                      {(Number(selectedClient.openDocsCount) || 0) > 0 && (
                        <div style={{ fontSize: '0.68rem', marginTop: '4px', fontFamily: 'var(--font-code)', display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                          <span style={{ color: 'var(--semaforo-verde)' }}>Al Día: {formatUsd(selectedClient.saldoAlDiaUsd)}</span>
                          <span style={{ color: Number(selectedClient.saldoVencidoUsd) > 0.01 ? 'var(--semaforo-rojo, #ef4444)' : 'var(--text-muted)' }}>
                            Venc.: {formatUsd(selectedClient.saldoVencidoUsd)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Botonera de Enlace Funcional */}
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end', width: '100%' }}>
                      {userCanApproveClients && onApproveClient && getClientApprovalStatus(selectedClient) !== 'APROBADO' && (
                        <button
                          type="button"
                          disabled={isProcessingApproval}
                          className="btn-primary"
                          onClick={async () => {
                            setIsProcessingApproval(true);
                            try {
                              await onApproveClient(selectedClient);
                            } finally {
                              setIsProcessingApproval(false);
                            }
                          }}
                          style={{
                            fontSize: '0.75rem',
                            padding: '6px 10px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            background: 'linear-gradient(135deg, #10b981, #059669)',
                            border: 'none'
                          }}
                          title="Aprobar registro de cliente para que quede activo en ventas y preventas"
                        >
                          <CheckCircle2 size={13} />
                          <span>Aprobar Cliente</span>
                        </button>
                      )}
                      {userCanApproveClients && onRejectClient && getClientApprovalStatus(selectedClient) === 'PENDIENTE' && (
                        <button
                          type="button"
                          disabled={isProcessingApproval}
                          className="btn-secondary"
                          onClick={async () => {
                            const motivo = window.prompt('Motivo del rechazo (opcional):', 'Documentación / RIF incompleto');
                            if (motivo === null) return;
                            setIsProcessingApproval(true);
                            try {
                              await onRejectClient(selectedClient, motivo);
                            } finally {
                              setIsProcessingApproval(false);
                            }
                          }}
                          style={{
                            fontSize: '0.75rem',
                            padding: '6px 10px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            color: 'var(--motorven-red)',
                            borderColor: 'rgba(220,38,38,0.45)'
                          }}
                          title="Rechazar solicitud de registro de cliente"
                        >
                          <X size={13} />
                          <span>Rechazar</span>
                        </button>
                      )}
                      {onSelectClientForOrder && isClientApproved(selectedClient) && (
                        <button
                          type="button"
                          className="btn-primary"
                          onClick={() => {
                            onSelectClientForOrder(selectedClient);
                            if (onClose) onClose();
                          }}
                          style={{
                            fontSize: '0.75rem',
                            padding: '6px 10px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px'
                          }}
                          title="Cargar este cliente en la Nota de Pedido del Flujo Comercial"
                        >
                          <FileText size={13} />
                          <span>Usar en Pedido</span>
                        </button>
                      )}
                      {onSelectClientForPOS && isClientApproved(selectedClient) && (
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
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => handlePrintCreditApplication(selectedClient)}
                        style={{
                          fontSize: '0.75rem',
                          padding: '6px 10px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                          color: 'var(--motorven-navy-light)'
                        }}
                        title="Descargar Solicitud de Línea de Crédito Comercial y Pagaré Mercantil Ejecutivo (Código de Comercio Art. 486)"
                      >
                        <FileText size={13} />
                        <span>Solicitud & Pagaré</span>
                      </button>
                      {userCanApproveClients && onSaveClient && (
                        <>
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
                            title="Modificar ficha completa, crédito e imágenes del cliente"
                          >
                            <Edit2 size={13} />
                            <span>Modificar</span>
                          </button>
                          <button
                            type="button"
                            disabled={isTogglingStatus}
                            className="btn-secondary"
                            onClick={() => handleToggleClientStatus(selectedClient)}
                            style={{
                              fontSize: '0.75rem',
                              padding: '6px 10px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              color: selectedClient.inactivo ? '#34d399' : '#fbbf24'
                            }}
                            title={selectedClient.inactivo ? 'Activar cliente en el sistema' : 'Desactivar cliente temporalmente'}
                          >
                            <Power size={13} />
                            <span>{selectedClient.inactivo ? 'Activar' : 'Inactivar'}</span>
                          </button>
                        </>
                      )}
                      {userCanApproveClients && onDeleteClient && (
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => handleRequestDeleteClient(selectedClient)}
                          style={{
                            fontSize: '0.75rem',
                            padding: '6px 10px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            color: 'var(--motorven-red)',
                            borderColor: 'rgba(220,38,38,0.45)'
                          }}
                          title="Eliminar cliente del sistema (requiere doble seguridad)"
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

                    {(selectedClient.imagenDocumento || selectedClient.imagen_documento || selectedClient.imagenLocal || selectedClient.imagen_local) && (
                      <div className="clients-info-card" style={{ gridColumn: '1 / -1' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <ImageIcon size={13} /> SOPORTES FOTOGRÁFICOS (RIF / CÉDULA Y LOCAL COMERCIAL)
                        </span>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '8px' }}>
                          {[
                            { label: 'RIF / Cédula', src: selectedClient.imagenDocumento || selectedClient.imagen_documento },
                            { label: 'Local Comercial', src: selectedClient.imagenLocal || selectedClient.imagen_local }
                          ]
                            .filter(it => Boolean(it.src))
                            .map(it => (
                              <button
                                key={it.label}
                                type="button"
                                onClick={() => setPreviewPhoto({ title: `${selectedClient.nombre} — ${it.label}`, src: it.src })}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '6px 10px',
                                  borderRadius: '8px',
                                  border: '1px solid var(--border-glass)',
                                  background: 'var(--bg-secondary)',
                                  color: 'var(--text-primary)',
                                  cursor: 'pointer'
                                }}
                              >
                                <img src={it.src} alt={it.label} style={{ width: '60px', height: '46px', objectFit: 'cover', borderRadius: '6px' }} />
                                <span style={{ fontSize: '0.74rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <Eye size={13} color="var(--neon-cyan)" /> {it.label}
                                </span>
                              </button>
                            ))}
                        </div>
                      </div>
                    )}
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

                    <div className="clients-info-card" style={{ gridColumn: '1 / -1', background: 'rgba(0, 43, 122, 0.08)', border: '1px solid rgba(0, 43, 122, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--motorven-navy-light)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <ShieldCheck size={16} /> Instrumento Mercantil de Garantía (Código de Comercio Art. 486)
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Genera la planilla formal de apertura de crédito comercial vinculada al Pagaré Mercantil Ejecutivo a la vista con aval solidario.
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => handlePrintCreditApplication(selectedClient)}
                        style={{ fontSize: '0.75rem', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                      >
                        <FileText size={14} /> Imprimir Solicitud & Pagaré
                      </button>
                    </div>

                    {Array.isArray(selectedClient.openDocs) && selectedClient.openDocs.length > 0 && (
                      <div className="clients-info-card" style={{ gridColumn: '1 / -1' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                          <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--motorven-gold)', fontFamily: 'var(--font-code)', textTransform: 'uppercase' }}>
                            Documentos CxC Pendientes ({selectedClient.openDocs.length})
                          </span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                            Al Día: {formatUsd(selectedClient.saldoAlDiaUsd)} · Vencida: {formatUsd(selectedClient.saldoVencidoUsd)}
                          </span>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', fontFamily: 'var(--font-code)' }}>
                            <thead>
                              <tr style={{ borderBottom: '1px solid var(--border-glass)', color: 'var(--text-muted)', textAlign: 'left' }}>
                                <th style={{ padding: '4px 6px' }}>Documento</th>
                                <th style={{ padding: '4px 6px' }}>Tipo</th>
                                <th style={{ padding: '4px 6px' }}>Emisión</th>
                                <th style={{ padding: '4px 6px' }}>Vence</th>
                                <th style={{ padding: '4px 6px' }}>Estatus</th>
                                <th style={{ padding: '4px 6px', textAlign: 'right' }}>Saldo USD</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedClient.openDocs.map((doc, idx) => (
                                <tr key={`${doc.id || doc.factNum}-${idx}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                  <td style={{ padding: '5px 6px', fontWeight: 700, color: 'var(--text-primary)' }}>{doc.factNum}</td>
                                  <td style={{ padding: '5px 6px', color: 'var(--text-muted)' }}>{doc.tipoDoc === 'NOTA_ENTREGA' ? 'N/E' : 'FAC'}</td>
                                  <td style={{ padding: '5px 6px', color: 'var(--text-muted)' }}>{doc.fechaEmision || '—'}</td>
                                  <td style={{ padding: '5px 6px', color: 'var(--text-muted)' }}>{doc.fechaVencimiento || '—'}</td>
                                  <td style={{ padding: '5px 6px', color: doc.isOverdue ? 'var(--semaforo-rojo, #ef4444)' : 'var(--semaforo-verde)', fontWeight: 700 }}>
                                    {doc.isOverdue ? `Vencida (${doc.diasMora}d)` : 'Al Día'}
                                  </td>
                                  <td style={{ padding: '5px 6px', textAlign: 'right', fontWeight: 800, color: 'var(--motorven-gold)' }}>
                                    {formatUsd(doc.saldoUsd)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
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
        {/* 5. CREACIÓN / EDICIÓN COMPLETA (REUTILIZA ClientRegistrationModal) */}
        {/* ========================================================================= */}
        <ClientRegistrationModal
          isOpen={isFormOpen}
          onClose={() => {
            setIsFormOpen(false);
            setEditingClientTarget(null);
          }}
          editingClient={editingClientTarget}
          clients={clients}
          profitSellers={profitSellers}
          profitZones={profitZones}
          currentUser={currentUser}
          onSaveClient={onSaveClient}
          onSuccess={(saved) => {
            if (saved) {
              setSelectedClientId(saved.id || saved.codigo);
            }
            setIsFormOpen(false);
            setEditingClientTarget(null);
          }}
        />

        {/* ========================================================================= */}
        {/* 6. MODAL DE ELIMINACIÓN CON DOBLE SEGURIDAD */}
        {/* ========================================================================= */}
        <ClientDeleteConfirmModal
          client={clientToDelete}
          isDeleting={isDeletingClient}
          onClose={() => setClientToDelete(null)}
          onConfirmDelete={handleConfirmDeleteClient}
        />
      </div>
      <ImagePreviewLightbox photo={previewPhoto} onClose={() => setPreviewPhoto(null)} />
    </div>
  );
}
