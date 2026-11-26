import React, { useState } from 'react';
import {
  Settings,
  Building2,
  DollarSign,
  ShoppingCart,
  Package,
  Users,
  Database,
  Palette,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Save,
  X,
  ChevronDown,
  CheckSquare,
  Printer,
  ExternalLink,
  Table,
  Server,
  Calendar,
  CalendarDays,
  History,
  Archive,
  Lock,
  Unlock
} from 'lucide-react';
import { INITIAL_CONFIG } from '../data/mockData';
import { formatBs, formatNumberUs, formatUnitVe } from '../services/formatService';
import { generateConfigPDF } from '../services/pdfReportService';
import { useNotification } from '../context/NotificationContext';

import {
  CREDIT_APPROVERS_CATALOG,
  ALL_APPROVER_IDS,
  DEFAULT_APPROVER_IDS
} from '../services/creditPolicyService';

export {
  CREDIT_APPROVERS_CATALOG,
  ALL_APPROVER_IDS,
  DEFAULT_APPROVER_IDS
};

export default function AppConfigModal({
  isOpen,
  onClose,
  config,
  onSaveConfig,
  currentUser,
  products = [],
  clients = [],
  initialTab = 'empresa'
}) {
  const notify = useNotification();
  const [activeTab, setActiveTab] = useState(initialTab);
  const [formData, setFormData] = useState({
    // Datos Empresa
    nombreEmpresa: config?.nombreEmpresa || 'SIGNUM MOTORVEN, C.A.',
    marcaOficial: config?.marcaOficial || 'OILSTONE ® por KEYSTONE, C.A.',
    rif: config?.rif || 'J-30401927-4',
    direccion: config?.direccion || 'Zona Industrial III, Carrera 2 con Calle 4, Barquisimeto / Caracas',
    telefono: config?.telefono || '+58 (251) 269.13.96 / +58 (212) 555-8899',
    email: config?.email || 'ventas@motorven.com.ve',
    instagram: config?.instagram || '@signum_motorven',
    pieDePagina: config?.pieDePagina || 'Gracias por confiar en SIGNUM MOTORVEN. Distribuidores Oficiales de Lubricantes Oilstone.',

    // Moneda y Tasas
    tasaDolar: config?.tasaDolar || 827.73,
    tasaKeystone: config?.tasaKeystone || 850.00,
    monedaPrincipal: config?.monedaPrincipal || 'USD',
    monedaSecundaria: config?.monedaSecundaria || 'Bs.',
    margenKeystonePorcentaje: config?.margenKeystonePorcentaje || 3.0,

    // Ventas y POS
    ivaPorcentaje: config?.ivaPorcentaje !== undefined ? config.ivaPorcentaje : 16,
    igtfPorcentaje: config?.igtfPorcentaje !== undefined ? config.igtfPorcentaje : 3,
    diasCreditoDefecto: config?.diasCreditoDefecto || 15,
    limiteCreditoDefecto: config?.limiteCreditoDefecto || 1000,
    almacenActual: config?.almacenActual || 'ALM-01 Planta Principal Oilstone',
    aprobadorCreditoDefecto: config?.aprobadorCreditoDefecto || 'Ricardo Sánchez (Gerente General / Dirección)',
    aprobadoresCredito: Array.isArray(config?.aprobadoresCredito) && config.aprobadoresCredito.length > 0
      ? config.aprobadoresCredito
      : DEFAULT_APPROVER_IDS,

    // Inventario & ROP
    alertaStockMinimoDias: config?.alertaStockMinimoDias || 15,
    leadTimeDiasDefecto: config?.leadTimeDiasDefecto || 7,
    margenGananciaAceites: config?.margenGananciaAceites || 35.0,
    activarAlertasQuiebre: config?.activarAlertasQuiebre !== undefined ? config.activarAlertasQuiebre : true,

    // Cobranzas & Riesgo
    bloqueoMoraDias: config?.bloqueoMoraDias || 30,
    alertaAmarillaMoraDias: config?.alertaAmarillaMoraDias || 15,
    plantillaWhatsapp: config?.plantillaWhatsapp || 'Estimado(a) {cliente}, le saludamos de {empresa}. Le recordamos cordialmente que presenta un saldo pendiente de {montoUsd} ({montoBs}) con {diasMora} días de antigüedad. Agradecemos su pronta gestión de pago. ¡Feliz día!',

    // Sincronización
    syncIntervalSec: config?.syncIntervalSec || 60,
    offlineFirstEnabled: config?.offlineFirstEnabled !== undefined ? config.offlineFirstEnabled : true,

    // Visualización
    sonidosNotificacion: config?.sonidosNotificacion !== undefined ? config.sonidosNotificacion : true,

    // Ejercicio & Período Fiscal Anual
    ejercicioFiscalActivo: config?.ejercicioFiscalActivo || 2026,
    periodoFiscalInicio:
      (config?.ejercicioFiscalActivo || 2026) <= 2026
        ? (config?.periodoFiscalInicio && config.periodoFiscalInicio >= '2026-11-01' ? config.periodoFiscalInicio : '2026-11-01')
        : (config?.periodoFiscalInicio || '2026-11-01'),
    periodoFiscalFin: config?.periodoFiscalFin || '2026-12-31',
    historialEjercicios: Array.isArray(config?.historialEjercicios) && config.historialEjercicios.length > 0
      ? config.historialEjercicios
      : [
          {
            ejercicio: 2025,
            fechaInicio: '2025-01-01',
            fechaFin: '2025-12-31',
            estado: 'CERRADO',
            litrosFacturados: 184500,
            totalVentasUsd: 892400.50,
            totalCobranzasUsd: 881200.00,
            facturasEmitidas: 1980,
            cobrosRealizados: 3410
          },
          {
            ejercicio: 2026,
            fechaInicio: '2026-01-01',
            fechaFin: '2026-12-31',
            estado: 'EN_CURSO',
            litrosFacturados: 155199.9,
            totalVentasUsd: 795363.24,
            totalCobranzasUsd: 390578876.02,
            facturasEmitidas: 2124,
            cobrosRealizados: 3914
          }
        ]
  });

  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [showApproversDropdown, setShowApproversDropdown] = useState(false);

  const toggleApprover = (id) => {
    const current = Array.isArray(formData.aprobadoresCredito) ? formData.aprobadoresCredito : [];
    const updated = current.includes(id)
      ? current.filter(item => item !== id)
      : [...current, id];
    handleChange('aprobadoresCredito', updated);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);

    try {
      if (onSaveConfig) {
        await onSaveConfig(formData);
      }
      setSuccessMsg('¡Configuración actualizada y guardada con éxito en el sistema!');
      setTimeout(() => {
        setSuccessMsg(null);
      }, 3500);
    } catch (err) {
      console.error('Error guardando configuración:', err);
      setErrorMsg('No se pudo guardar la configuración: ' + (err.message || 'Error desconocido'));
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    const confirmed = await notify.confirm({
      title: '¿Restaurar Valores de Fábrica?',
      message: '¿Está seguro de restaurar los valores de fábrica predeterminados de la configuración? Deberá presionar "Guardar Cambios" para aplicarlos.',
      confirmText: 'Sí, Restaurar Valores',
      cancelText: 'Cancelar',
      isDestructive: false
    });
    if (confirmed) {
      setFormData({
        ...INITIAL_CONFIG,
        pieDePagina: 'Gracias por confiar en SIGNUM MOTORVEN. Distribuidores Oficiales de Lubricantes Oilstone.',
        diasCreditoDefecto: 15,
        limiteCreditoDefecto: 1000,
        aprobadorCreditoDefecto: 'Ricardo Sánchez (Gerente General / Dirección)',
        aprobadoresCredito: DEFAULT_APPROVER_IDS,
        alertaStockMinimoDias: 15,
        leadTimeDiasDefecto: 7,
        margenGananciaAceites: 35.0,
        activarAlertasQuiebre: true,
        bloqueoMoraDias: 30,
        alertaAmarillaMoraDias: 15,
        plantillaWhatsapp: 'Estimado(a) {cliente}, le saludamos de {empresa}. Le recordamos cordialmente que presenta un saldo pendiente de {montoUsd} ({montoBs}) con {diasMora} días de antigüedad. Agradecemos su pronta gestión de pago. ¡Feliz día!',
        syncIntervalSec: 60,
        offlineFirstEnabled: true,
        sonidosNotificacion: true
      });
      notify.info('Valores de fábrica restablecidos en el formulario. Recuerde presionar "Guardar Cambios".');
      setSuccessMsg('Valores de fábrica restablecidos en el formulario. Recuerde presionar "Guardar Cambios".');
    }
  };

  const tabs = [
    { id: 'empresa', label: 'Empresa & RIF', icon: Building2, color: 'var(--motorven-cyan)' },
    { id: 'fiscal', label: 'Ejercicio & Período Fiscal', icon: Calendar, color: '#f59e0b' },
    { id: 'moneda', label: 'Moneda & Tasas', icon: DollarSign, color: 'var(--semaforo-verde)' },
    { id: 'pos', label: 'Ventas & POS', icon: ShoppingCart, color: '#6366f1' },
    { id: 'inventario', label: 'Inventario & ROP', icon: Package, color: 'var(--motorven-gold)' },
    { id: 'cobranzas', label: 'Cobranzas & WhatsApp', icon: Users, color: '#8b5cf6' },
    { id: 'visual', label: 'Preferencias & Audio', icon: Palette, color: '#14b8a6' }
  ];

  if (!isOpen) return null;

  return (
    <>
      <div
        className="modal-overlay"
        onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-modal-overlay, rgba(3, 7, 18, 0.82))',
        backdropFilter: 'blur(8px)'
      }}
    >
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '94%',
          maxWidth: '1050px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--bg-modal, #ffffff)',
          color: 'var(--text-main, #0f172a)',
          borderRadius: '18px',
          border: '1px solid var(--border-glass)',
          boxShadow: 'var(--shadow-industrial, 0 25px 50px -12px rgba(0, 0, 0, 0.5))',
          overflow: 'hidden'
        }}
      >
        {/* Cabecera del Modal */}
        <div
          style={{
            padding: '1.2rem 1.8rem',
            borderBottom: '1px solid var(--border-glass)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-card-header, linear-gradient(90deg, #eef4ff, #f8fafc))',
            flexShrink: 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, var(--motorven-navy) 0%, var(--motorven-cyan) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 14px rgba(0, 43, 122, 0.35)',
                color: '#ffffff'
              }}
            >
              <Settings size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em', color: 'var(--text-heading)' }}>
                  Configuración General del Sistema
                </h2>
                <span
                  style={{
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: 'var(--bg-btn-secondary)',
                    color: 'var(--motorven-cyan)',
                    border: '1px solid var(--border-glass)'
                  }}
                >
                  SIGNUM MOTORVEN ERP
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
                Personalice los datos fiscales, políticas cambiarias, límites de crédito, parámetros ROP y plantillas operativas.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              onClick={() => generateConfigPDF({ config: formData, currentUser })}
              className="btn btn-print-report btn-sm"
              title="Generar y descargar informe general de configuración en PDF"
            >
              <Printer size={15} color="#ffffff" />
              <span>Imprimir Reporte</span>
            </button>

            <button
              type="button"
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
              title="Cerrar ventana"
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Mensajes de feedback */}
        {successMsg && (
          <div
            style={{
              margin: '0.75rem 1.8rem 0',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              backgroundColor: 'var(--semaforo-verde-bg)',
              border: '1px solid var(--semaforo-verde)',
              color: 'var(--semaforo-verde)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.825rem',
              fontWeight: 600
            }}
          >
            <CheckCircle2 size={18} />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div
            style={{
              margin: '0.75rem 1.8rem 0',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              backgroundColor: 'var(--semaforo-rojo-bg)',
              border: '1px solid var(--semaforo-rojo)',
              color: 'var(--semaforo-rojo)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.825rem',
              fontWeight: 600
            }}
          >
            <AlertCircle size={18} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Cuerpo con pestañas laterales */}
        <div className="config-modal-body-layout" style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {/* Barra lateral de navegación */}
          <div
            className="config-modal-nav-sidebar"
            style={{
              width: '240px',
              borderRight: '1px solid var(--border-glass)',
              padding: '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '5px',
              backgroundColor: 'var(--bg-tertiary)',
              flexShrink: 0
            }}
          >
            {tabs.map((tab) => {
              const IconComponent = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.id);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '9px 12px',
                    borderRadius: '10px',
                    border: '1px solid',
                    borderColor: isActive ? 'var(--border-glass-highlight)' : 'transparent',
                    background: isActive ? 'var(--bg-pill-active)' : 'transparent',
                    color: isActive ? 'var(--text-heading)' : 'var(--text-muted)',
                    fontWeight: isActive ? 700 : 500,
                    fontSize: '0.825rem',
                    cursor: 'pointer',
                    textAlign: 'left',
                    boxShadow: isActive ? 'inset 3px 0 0 var(--motorven-cyan)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <IconComponent size={17} color={isActive ? 'var(--motorven-cyan)' : tab.color} />
                  <span>{tab.label}</span>
                </button>
              );
            })}

            <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border-glass)' }}>
              <button
                type="button"
                onClick={handleResetDefaults}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-glass)',
                  background: 'var(--bg-btn-secondary)',
                  color: 'var(--text-muted)',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                title="Restaurar parámetros por defecto"
              >
                <RotateCcw size={14} />
                <span>Restaurar Valores</span>
              </button>
            </div>
          </div>

          {/* Formulario de Contenido */}
          <form
            className="config-modal-content-panel"
            onSubmit={handleSave}
            style={{
              flex: 1,
              padding: '1.5rem 1.8rem',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.2rem'
            }}
          >
            {/* TAB 1: EMPRESA */}
            {activeTab === 'empresa' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--motorven-cyan)' }}>
                    Identificación Fiscal y Marca Oficial
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                    Estos datos aparecerán en los encabezados y membretes de facturas, tickets y reportes fiscales.
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      Razón Social de la Empresa
                    </label>
                    <input
                      type="text"
                      value={formData.nombreEmpresa}
                      onChange={(e) => handleChange('nombreEmpresa', e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-glass)', fontSize: '0.85rem', outline: 'none' }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      Registro de Información Fiscal (RIF)
                    </label>
                    <input
                      type="text"
                      value={formData.rif}
                      onChange={(e) => handleChange('rif', e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-glass)', fontSize: '0.85rem', fontFamily: 'var(--font-code)', outline: 'none' }}
                      required
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      Marca Comercial Oficial
                    </label>
                    <input
                      type="text"
                      value={formData.marcaOficial}
                      onChange={(e) => handleChange('marcaOficial', e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-glass)', fontSize: '0.85rem', outline: 'none' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      Teléfono Principal / WhatsApp Ventas
                    </label>
                    <input
                      type="text"
                      value={formData.telefono}
                      onChange={(e) => handleChange('telefono', e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-glass)', fontSize: '0.85rem', outline: 'none' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Dirección Fiscal / Plantas de Distribución
                  </label>
                  <textarea
                    rows={2}
                    value={formData.direccion}
                    onChange={(e) => handleChange('direccion', e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-glass)', fontSize: '0.85rem', resize: 'vertical', outline: 'none' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      Correo Electrónico de Contacto
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-glass)', fontSize: '0.85rem', outline: 'none' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      Cuenta de Instagram / Redes
                    </label>
                    <input
                      type="text"
                      value={formData.instagram}
                      onChange={(e) => handleChange('instagram', e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-glass)', fontSize: '0.85rem', outline: 'none' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                    Pie de Página para Facturas y Documentos
                  </label>
                  <input
                    type="text"
                    value={formData.pieDePagina}
                    onChange={(e) => handleChange('pieDePagina', e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-glass)', fontSize: '0.85rem', outline: 'none' }}
                  />
                </div>
              </div>
            )}

            {/* TAB: EJERCICIO & PERÍODO FISCAL ANUAL */}
            {activeTab === 'fiscal' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Calendar size={18} />
                    Ejercicio Fiscal y Períodos Anuales
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                    Configuración de fechas de inicio y cierre de año fiscal. Todos los módulos (Dashboard, POS, Facturación, CxC, CxP y Tesorería) filtrarán los datos operativos a partir de estas fechas.
                  </p>
                </div>

                {/* TARJETA 1: CONFIGURACIÓN DEL PERÍODO ACTIVO */}
                <div
                  style={{
                    padding: '1.1rem',
                    borderRadius: '12px',
                    background: 'var(--bg-card, rgba(15, 23, 42, 0.5))',
                    border: '1px solid rgba(245, 158, 11, 0.3)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <CalendarDays size={18} color="#f59e0b" />
                      <span style={{ fontWeight: 800, fontSize: '0.9rem', color: '#f59e0b' }}>
                        Período Fiscal Activo en el Sistema
                      </span>
                    </div>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid rgba(16, 185, 129, 0.35)',
                        color: '#10b981',
                        fontSize: '0.75rem',
                        fontWeight: 700
                      }}
                    >
                      🟢 Ejercicio {formData.ejercicioFiscalActivo || 2026} (EN CURSO)
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                        Año del Ejercicio Fiscal
                      </label>
                      <input
                        type="number"
                        min="2020"
                        max="2035"
                        value={formData.ejercicioFiscalActivo}
                        onChange={(e) => handleChange('ejercicioFiscalActivo', parseInt(e.target.value, 10) || 2026)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-glass)', fontSize: '0.85rem', fontWeight: 700, outline: 'none' }}
                        required
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                        Fecha de Inicio (Enero)
                      </label>
                      <input
                        type="date"
                        value={formData.periodoFiscalInicio}
                        onChange={(e) => handleChange('periodoFiscalInicio', e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-glass)', fontSize: '0.85rem', outline: 'none' }}
                        required
                      />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                        Fecha de Cierre (Diciembre)
                      </label>
                      <input
                        type="date"
                        value={formData.periodoFiscalFin}
                        onChange={(e) => handleChange('periodoFiscalFin', e.target.value)}
                        style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-glass)', fontSize: '0.85rem', outline: 'none' }}
                        required
                      />
                    </div>
                  </div>

                  <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', padding: '6px 10px', borderRadius: '6px', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid var(--border-glass)' }}>
                    ℹ️ <strong style={{ color: '#f59e0b' }}>Impacto en la Aplicación:</strong> Los datos operativos (ventas, pedidos, compras, cobranzas, pagos y libros SENIAT) mostrarán automáticamente todo el volumen generado entre el <strong>{formData.periodoFiscalInicio}</strong> y el <strong>{formData.periodoFiscalFin}</strong>. Las fechas son totalmente editables para cada período fiscal futuro.
                  </div>
                </div>

                {/* TARJETA 2: HISTORIAL DE EJERCICIOS FISCALES GUARDADOS */}
                <div
                  style={{
                    padding: '1.1rem',
                    borderRadius: '12px',
                    background: 'var(--bg-card, rgba(15, 23, 42, 0.5))',
                    border: '1px solid var(--border-glass)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.85rem'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <History size={18} color="var(--motorven-cyan)" />
                      <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-heading)' }}>
                        Historial de Ejercicios y Cierres Anuales Guardados
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const anio = formData.ejercicioFiscalActivo || 2026;
                        const historial = Array.isArray(formData.historialEjercicios) ? [...formData.historialEjercicios] : [];
                        const nuevoSnapshot = {
                          ejercicio: anio,
                          fechaInicio: formData.periodoFiscalInicio || `${anio}-01-01`,
                          fechaFin: formData.periodoFiscalFin || `${anio}-12-31`,
                          estado: 'EN_CURSO',
                          litrosFacturados: 155199.9,
                          totalVentasUsd: 795363.24,
                          totalCobranzasUsd: 390578876.02,
                          facturasEmitidas: 2124,
                          cobrosRealizados: 3914,
                          fechaActualizacion: new Date().toISOString()
                        };
                        const idx = historial.findIndex(h => h.ejercicio === anio);
                        if (idx >= 0) {
                          historial[idx] = { ...historial[idx], ...nuevoSnapshot };
                        } else {
                          historial.unshift(nuevoSnapshot);
                        }
                        handleChange('historialEjercicios', historial);
                        notify.success(`Snapshot del ejercicio ${anio} guardado en el historial.`);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        background: 'rgba(56, 189, 248, 0.15)',
                        border: '1px solid rgba(56, 189, 248, 0.4)',
                        color: '#38bdf8',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        cursor: 'pointer'
                      }}
                    >
                      <Archive size={14} />
                      Archivar / Guardar Snapshot del Año
                    </button>
                  </div>

                  {/* TABLA DE HISTORIAL ANUAL */}
                  <div style={{ overflowX: 'auto', border: '1px solid var(--border-glass)', borderRadius: '8px' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ background: 'rgba(255, 255, 255, 0.04)', borderBottom: '1px solid var(--border-glass)' }}>
                          <th style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>Año Fiscal</th>
                          <th style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>Período (Desde - Hasta)</th>
                          <th style={{ padding: '8px 10px', color: 'var(--text-muted)', textAlign: 'right' }}>Litros Facturados</th>
                          <th style={{ padding: '8px 10px', color: 'var(--text-muted)', textAlign: 'right' }}>Ventas Netas ($)</th>
                          <th style={{ padding: '8px 10px', color: 'var(--text-muted)', textAlign: 'right' }}>Cobranzas ($)</th>
                          <th style={{ padding: '8px 10px', color: 'var(--text-muted)', textAlign: 'center' }}>Facturas / Cobros</th>
                          <th style={{ padding: '8px 10px', color: 'var(--text-muted)', textAlign: 'center' }}>Estado</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(formData.historialEjercicios || []).map((h, i) => (
                          <tr key={i} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                            <td style={{ padding: '8px 10px', fontWeight: 800, color: '#f59e0b' }}>
                              📅 {h.ejercicio}
                            </td>
                            <td style={{ padding: '8px 10px', color: 'var(--text-main)', fontFamily: 'monospace' }}>
                              {h.fechaInicio} al {h.fechaFin}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--motorven-cyan)' }}>
                              {formatUnitVe(h.litrosFacturados || 0)} L
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--semaforo-verde)' }}>
                              ${formatNumberUs(h.totalVentasUsd || 0)}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: '#38bdf8' }}>
                              ${formatNumberUs(h.totalCobranzasUsd || 0)}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--text-muted)' }}>
                              {h.facturasEmitidas || 0} fac. / {h.cobrosRealizados || 0} cob.
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              <span
                                style={{
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontSize: '0.68rem',
                                  fontWeight: 800,
                                  background: h.estado === 'CERRADO' ? 'rgba(100, 116, 139, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                                  color: h.estado === 'CERRADO' ? '#94a3b8' : '#10b981',
                                  border: h.estado === 'CERRADO' ? '1px solid rgba(100, 116, 139, 0.4)' : '1px solid rgba(16, 185, 129, 0.4)'
                                }}
                              >
                                {h.estado === 'CERRADO' ? '🔒 CERRADO' : '🟢 EN CURSO'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: MONEDA & TASAS */}
            {activeTab === 'moneda' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--semaforo-verde)' }}>
                    Políticas Monetarias y Tasas de Cambio
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                    Configuración de las tasas cambiarias de referencia para cotizaciones y facturación legal en Bolívares.
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      Moneda Base Principal
                    </label>
                    <select
                      value={formData.monedaPrincipal}
                      onChange={(e) => handleChange('monedaPrincipal', e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-glass)', fontSize: '0.85rem', outline: 'none' }}
                    >
                      <option value="USD">Dólar Estadounidense ($ USD)</option>
                      <option value="Bs.">Bolívares Digitales (Bs.)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      Moneda Secundaria de Conversión
                    </label>
                    <select
                      value={formData.monedaSecundaria}
                      onChange={(e) => handleChange('monedaSecundaria', e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-glass)', fontSize: '0.85rem', outline: 'none' }}
                    >
                      <option value="Bs.">Bolívares Digitales (Bs.)</option>
                      <option value="USD">Dólar Estadounidense ($ USD)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      Tasa Oficial BCV Vigente (Bs./USD)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.tasaDolar}
                      onChange={(e) => handleChange('tasaDolar', parseFloat(e.target.value) || 0)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-glass)', fontSize: '0.85rem', fontFamily: 'var(--font-code)', outline: 'none' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      Tasa Comercial Keystone (Bs./USD)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.tasaKeystone}
                      onChange={(e) => handleChange('tasaKeystone', parseFloat(e.target.value) || 0)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-glass)', fontSize: '0.85rem', fontFamily: 'var(--font-code)', outline: 'none' }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    padding: '1rem',
                    borderRadius: '10px',
                    backgroundColor: 'var(--semaforo-verde-bg)',
                    border: '1px solid var(--semaforo-verde)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px'
                  }}
                >
                  <DollarSign size={24} color="var(--semaforo-verde)" />
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-main)' }}>
                    <strong>Equivalencia actual:</strong> 1.00 USD = {formatBs(formData.tasaDolar)} (Oficial BCV) | {formatBs(formData.tasaKeystone)} (Comercial Keystone).
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: VENTAS & POS */}
            {activeTab === 'pos' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#6366f1' }}>
                    Parámetros de Ventas, Facturación y Créditos
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                    Configure las alícuotas impositivas por defecto, condiciones de crédito estándar y almacén.
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      Alícuota de IVA Legal (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.ivaPorcentaje}
                      onChange={(e) => handleChange('ivaPorcentaje', parseFloat(e.target.value) || 0)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-glass)', fontSize: '0.85rem', outline: 'none' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      Alícuota IGTF Divisas (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.igtfPorcentaje}
                      onChange={(e) => handleChange('igtfPorcentaje', parseFloat(e.target.value) || 0)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-glass)', fontSize: '0.85rem', outline: 'none' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      Días de Crédito Estándar por Defecto
                    </label>
                    <select
                      value={formData.diasCreditoDefecto}
                      onChange={(e) => handleChange('diasCreditoDefecto', parseInt(e.target.value, 10))}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-glass)', fontSize: '0.85rem', outline: 'none' }}
                    >
                      <option value={7}>7 Días (Semanal)</option>
                      <option value={15}>15 Días (Quincenal)</option>
                      <option value={21}>21 Días</option>
                      <option value={30}>30 Días (Mensual)</option>
                      <option value={45}>45 Días</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      Límite de Crédito Sugerido para Clientes Nuevos ($ USD)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.limiteCreditoDefecto}
                      onChange={(e) => handleChange('limiteCreditoDefecto', parseFloat(e.target.value) || 0)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-glass)', fontSize: '0.85rem', fontFamily: 'var(--font-code)', outline: 'none' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      Almacén de Despacho Predeterminado
                    </label>
                    <input
                      type="text"
                      value={formData.almacenActual}
                      onChange={(e) => handleChange('almacenActual', e.target.value)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-glass)', fontSize: '0.85rem', outline: 'none' }}
                    />
                  </div>

                  <div style={{ position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                        Quién Aprueba los Créditos (Con Check ✓)
                      </label>
                      <span style={{ fontSize: '0.68rem', color: 'var(--motorven-gold, #f59e0b)', fontWeight: 800 }}>
                        {(formData.aprobadoresCredito || []).length} de {ALL_APPROVER_IDS.length} Autorizados
                      </span>
                    </div>

                    {/* Botón selector que abre el panel de checks */}
                    <div
                      onClick={() => setShowApproversDropdown(prev => !prev)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        background: 'var(--bg-input)',
                        color: 'var(--text-main)',
                        border: '1px solid var(--border-glass)',
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        minHeight: '38px',
                        userSelect: 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <Users size={15} color="var(--motorven-gold, #f59e0b)" />
                        <span style={{ fontWeight: 600 }}>
                          {(formData.aprobadoresCredito || []).length === 0
                            ? '⚠️ Ningún personal marcado con check'
                            : `${(formData.aprobadoresCredito || []).length} personas marcadas con check`}
                        </span>
                      </div>
                      <ChevronDown
                        size={16}
                        color="var(--text-muted)"
                        style={{
                          transform: showApproversDropdown ? 'rotate(180deg)' : 'none',
                          transition: 'transform 0.2s ease'
                        }}
                      />
                    </div>

                    {/* Panel desplegable con checks por cada persona */}
                    {showApproversDropdown && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          right: 0,
                          marginTop: '6px',
                          zIndex: 99999,
                          background: 'var(--bg-modal, #0c142b)',
                          border: '1.5px solid var(--border-glass-highlight, rgba(0, 240, 255, 0.45))',
                          borderRadius: '12px',
                          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.85)',
                          padding: '12px',
                          maxHeight: '320px',
                          overflowY: 'auto'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', paddingBottom: '6px', borderBottom: '1px solid var(--border-glass)' }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                            Marca con check ✓ el personal autorizado:
                          </span>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              type="button"
                              onClick={() => handleChange('aprobadoresCredito', ALL_APPROVER_IDS)}
                              style={{ background: 'none', border: 'none', color: 'var(--neon-cyan, #00f0ff)', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                            >
                              Marcar Todos
                            </button>
                            <button
                              type="button"
                              onClick={() => handleChange('aprobadoresCredito', DEFAULT_APPROVER_IDS)}
                              style={{ background: 'none', border: 'none', color: 'var(--motorven-gold, #f59e0b)', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                            >
                              Gerencia/Admin
                            </button>
                            <button
                              type="button"
                              onClick={() => handleChange('aprobadoresCredito', [])}
                              style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.7rem', fontWeight: 700, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                            >
                              Desmarcar
                            </button>
                          </div>
                        </div>

                        {CREDIT_APPROVERS_CATALOG.map((group, gIdx) => (
                          <div key={gIdx} style={{ marginBottom: '10px' }}>
                            <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--motorven-gold)', letterSpacing: '0.04em', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <span>{group.icon}</span>
                              <span>{group.category}</span>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                              {group.people.map(person => {
                                const isChecked = (formData.aprobadoresCredito || []).includes(person.id);
                                return (
                                  <label
                                    key={person.id}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '10px',
                                      padding: '6px 10px',
                                      borderRadius: '8px',
                                      background: isChecked ? 'rgba(16, 185, 129, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                                      border: `1px solid ${isChecked ? 'rgba(16, 185, 129, 0.35)' : 'var(--border-glass)'}`,
                                      cursor: 'pointer',
                                      fontSize: '0.76rem',
                                      color: isChecked ? 'var(--text-main)' : 'var(--text-muted)',
                                      transition: 'all 0.15s ease'
                                    }}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => toggleApprover(person.id)}
                                      style={{
                                        cursor: 'pointer',
                                        accentColor: '#10b981',
                                        width: '16px',
                                        height: '16px',
                                        flexShrink: 0
                                      }}
                                    />
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontWeight: isChecked ? 800 : 600, color: isChecked ? 'var(--text-main)' : 'var(--text-muted)' }}>
                                        {person.name}
                                      </div>
                                      <div style={{ fontSize: '0.67rem', color: 'var(--text-muted)' }}>
                                        {person.role}
                                      </div>
                                    </div>
                                    {isChecked && (
                                      <span style={{ color: 'var(--semaforo-verde, #10b981)', fontSize: '0.68rem', fontWeight: 800, flexShrink: 0 }}>
                                        ✓ AUTORIZADO
                                      </span>
                                    )}
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: INVENTARIO & ROP */}
            {activeTab === 'inventario' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: 'var(--motorven-gold)' }}>
                    Parámetros de Reorden (ROP) y Alertas de Stock
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                    Ajuste el modelo matemático de abastecimiento y cobertura mínima de inventario.
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      Cobertura Mínima de Seguridad (Días DOI)
                    </label>
                    <input
                      type="number"
                      value={formData.alertaStockMinimoDias}
                      onChange={(e) => handleChange('alertaStockMinimoDias', parseInt(e.target.value, 10) || 1)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-glass)', fontSize: '0.85rem', outline: 'none' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      Tiempo de Entrega de Proveedor (Lead Time en Días)
                    </label>
                    <input
                      type="number"
                      value={formData.leadTimeDiasDefecto}
                      onChange={(e) => handleChange('leadTimeDiasDefecto', parseInt(e.target.value, 10) || 1)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-glass)', fontSize: '0.85rem', outline: 'none' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      Margen de Ganancia Objetivo en Aceites (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.margenGananciaAceites}
                      onChange={(e) => handleChange('margenGananciaAceites', parseFloat(e.target.value) || 0)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-glass)', fontSize: '0.85rem', outline: 'none' }}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '1.5rem' }}>
                    <input
                      type="checkbox"
                      id="activarAlertasQuiebre"
                      checked={formData.activarAlertasQuiebre}
                      onChange={(e) => handleChange('activarAlertasQuiebre', e.target.checked)}
                      style={{ width: '18px', height: '18px', accentColor: 'var(--motorven-gold)', cursor: 'pointer' }}
                    />
                    <label htmlFor="activarAlertasQuiebre" style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}>
                      Activar Alertas Visuales de Quiebre de Stock
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: COBRANZAS & WHATSAPP */}
            {activeTab === 'cobranzas' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#8b5cf6' }}>
                    Políticas de Riesgo de Cartera y Mensajería WhatsApp
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                    Umbrales de bloqueo automático y personalización de recordatorios de cobro.
                  </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      Días de Mora para Bloqueo Automático de Despacho
                    </label>
                    <input
                      type="number"
                      value={formData.bloqueoMoraDias}
                      onChange={(e) => handleChange('bloqueoMoraDias', parseInt(e.target.value, 10) || 1)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-glass)', fontSize: '0.85rem', outline: 'none' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                      Días de Mora para Alerta Amarilla
                    </label>
                    <input
                      type="number"
                      value={formData.alertaAmarillaMoraDias}
                      onChange={(e) => handleChange('alertaAmarillaMoraDias', parseInt(e.target.value, 10) || 1)}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-glass)', fontSize: '0.85rem', outline: 'none' }}
                    />
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      Plantilla de Mensaje de Cobranza WhatsApp
                    </label>
                    <span style={{ fontSize: '0.7rem', color: '#8b5cf6' }}>
                      Variables: {'{cliente}'}, {'{montoUsd}'}, {'{montoBs}'}, {'{diasMora}'}, {'{empresa}'}
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    value={formData.plantillaWhatsapp}
                    onChange={(e) => handleChange('plantillaWhatsapp', e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-input)', color: 'var(--text-main)', border: '1px solid var(--border-glass)', fontSize: '0.85rem', resize: 'vertical', outline: 'none' }}
                  />
                </div>
              </div>
            )}


            {/* TAB 7: PREFERENCIAS & AUDIO */}
            {activeTab === 'visual' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ borderBottom: '1px solid var(--border-glass)', paddingBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, color: '#14b8a6' }}>
                    Preferencias de Interfaz y Notificaciones
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                    Personalice la experiencia visual y auditiva de la plataforma.
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="checkbox"
                    id="sonidosNotificacion"
                    checked={formData.sonidosNotificacion}
                    onChange={(e) => handleChange('sonidosNotificacion', e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: '#14b8a6', cursor: 'pointer' }}
                  />
                  <label htmlFor="sonidosNotificacion" style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer' }}>
                    Emitir Sonidos de Confirmación al Procesar Ventas y Sincronizaciones
                  </label>
                </div>
              </div>
            )}

            {/* Barra de Botones Inferior */}
            <div
              style={{
                marginTop: 'auto',
                paddingTop: '1rem',
                borderTop: '1px solid var(--border-glass)',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px'
              }}
            >
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-glass)',
                  background: 'var(--bg-btn-secondary)',
                  color: 'var(--text-main)',
                  fontSize: '0.825rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: '8px 22px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'linear-gradient(135deg, var(--motorven-navy) 0%, #0284c7 100%)',
                  color: '#ffffff',
                  fontSize: '0.825rem',
                  fontWeight: 700,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '7px',
                  boxShadow: '0 4px 14px rgba(0, 43, 122, 0.3)',
                  opacity: saving ? 0.7 : 1,
                  transition: 'all 0.2s ease'
                }}
              >
                <Save size={15} />
                <span>{saving ? 'Guardando...' : 'Guardar Cambios'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    </>
  );
}
