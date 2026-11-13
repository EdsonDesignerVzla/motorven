import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Plus,
  Edit2,
  Save,
  RotateCcw,
  ShieldAlert,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Upload,
  Image as ImageIcon,
  Eye,
  Trash2
} from 'lucide-react';
import { canApproveClients } from '../services/authService';
import {
  SENIAT_CONTRIBUTOR_TYPES,
  resolveClientContributorType,
  applyContributorPrefixToRif,
  validateDocumentNumber
} from '../services/fiscalService';
import { compressClientImageToBase64 } from '../services/imageCompression';
import { useNotification } from '../context/NotificationContext';
import ImagePreviewLightbox from './ImagePreviewLightbox';

const DEFAULT_SELLER_ZONE_MAP = {
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

const DEFAULT_SELLERS = [
  { coVen: 'FS', venDes: 'Freddy Sepulveda', coZon: '01' },
  { coVen: 'YC', venDes: 'Yheyson Calderon', coZon: '02' },
  { coVen: 'JR', venDes: 'Juan Rodriguez', coZon: '02' },
  { coVen: 'VV', venDes: 'Victor Veloz', coZon: '03' },
  { coVen: 'CB', venDes: 'Carlos Becerra', coZon: '03' },
  { coVen: 'CM', venDes: 'Carlos Machado', coZon: '04' },
  { coVen: 'KB', venDes: 'Katherine Becerra', coZon: '05' },
  { coVen: 'VP', venDes: 'Vanessa Prieto', coZon: '06' },
  { coVen: 'MS', venDes: 'Michael Santana', coZon: '07' },
  { coVen: 'OF', venDes: 'Oficina Principal', coZon: '07' }
];

const DEFAULT_ZONES = [
  { coZon: '01', zonDes: 'Pto cabello - Juan jose Mora (FS)' },
  { coZon: '02', zonDes: 'Isabelica - Pque Valencia - Flor Amarillo (YC / JR)' },
  { coZon: '03', zonDes: 'San diego - Naguanagua (VV / CB)' },
  { coZon: '04', zonDes: 'Zona Sur de Valencia (CM)' },
  { coZon: '05', zonDes: 'Florida-Tocuyito-Bejuma-Montalban-Miranda (KB)' },
  { coZon: '06', zonDes: 'Los Guayos-Guacara-San Joaquin-Mariara (VP)' },
  { coZon: '07', zonDes: 'Carabobo (MS / OF)' }
];

const inputStyle = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: '8px',
  border: '1px solid var(--border-glass, #334155)',
  background: 'var(--bg-secondary)',
  color: 'var(--text-primary)',
  fontSize: '0.85rem'
};

const labelStyle = {
  display: 'block',
  fontSize: '0.74rem',
  fontWeight: 700,
  marginBottom: '5px',
  color: 'var(--text-muted)'
};

/**
 * Modal unificado para solicitar (vendedores) o registrar/editar (aprobadores) un cliente.
 * - Vendedores: crean la solicitud en estado PENDIENTE esperando aprobación de Caja Principal (Vanessa) u otros aprobadores.
 * - Aprobadores (Vanessa, Rosibel Cobranzas, Yheyson, Manuel, Edson, Gerencia, Administración): registran directo como APROBADO.
 */
export default function ClientRegistrationModal({
  isOpen,
  onClose,
  clients = [],
  profitSellers = [],
  profitZones = [],
  currentUser,
  editingClient = null,
  onSaveClient,
  onSuccess
}) {
  const notify = useNotification();
  const userCanApprove = canApproveClients(currentUser);
  const isEditing = Boolean(editingClient);

  const sellersOptions = useMemo(() => {
    if (Array.isArray(profitSellers) && profitSellers.length > 0) {
      const seen = new Set();
      const mapped = [];
      profitSellers.forEach(s => {
        const coVen = String(s?.coVen || s?.co_ven || s?.id || '').trim().toUpperCase();
        if (!coVen || seen.has(coVen)) return;
        seen.add(coVen);
        mapped.push({
          coVen,
          venDes: s?.venDes || s?.ven_des || s?.nombre || coVen,
          coZon: String(s?.coZon || s?.co_zon || DEFAULT_SELLER_ZONE_MAP[coVen] || '07').trim()
        });
      });
      if (mapped.length > 0) return mapped;
    }
    return DEFAULT_SELLERS;
  }, [profitSellers]);

  const zonesOptions = useMemo(() => {
    if (Array.isArray(profitZones) && profitZones.length > 0) {
      const seen = new Set();
      const mapped = [];
      profitZones.forEach(z => {
        const coZon = String(z?.coZon || z?.co_zon || '').trim();
        if (!coZon || seen.has(coZon)) return;
        seen.add(coZon);
        mapped.push({
          coZon,
          zonDes: z?.zonDes || z?.zon_des || `Zona ${coZon}`
        });
      });
      if (mapped.length > 0) return mapped;
    }
    return DEFAULT_ZONES;
  }, [profitZones]);

  const resolveDefaultSellerCode = () => {
    const userCoVen = String(currentUser?.co_ven || currentUser?.coVen || '').trim().toUpperCase();
    if (userCoVen && sellersOptions.some(s => s.coVen === userCoVen)) {
      return userCoVen;
    }
    return userCanApprove ? 'OF' : (sellersOptions[0]?.coVen || 'OF');
  };

  const [isSaving, setIsSaving] = useState(false);
  const [compressingField, setCompressingField] = useState(null);
  const [previewPhoto, setPreviewPhoto] = useState(null);
  const [form, setForm] = useState({
    codigo: '',
    nombre: '',
    tipoPersona: 'J',
    rif: 'J-',
    tipoCliente: 'Mayorista',
    direccion: '',
    ciudad: 'Valencia',
    telefono: '',
    email: '',
    responsable: '',
    limiteCreditoUsd: 0,
    diasCredito: 0,
    vendedorAsignado: 'OF',
    zonaVenta: '07',
    comentarios: '',
    imagenDocumento: '',
    imagenLocal: '',
    inactivo: false
  });

  useEffect(() => {
    if (!isOpen) return;
    setPreviewPhoto(null);
    if (editingClient) {
      const resolvedTipo = resolveClientContributorType(editingClient);
      setForm({
        id: editingClient.id || editingClient.codigo,
        codigo: editingClient.codigo || editingClient.id || '',
        nombre: editingClient.nombre || '',
        tipoPersona: resolvedTipo,
        rif: editingClient.rif || `${resolvedTipo}-`,
        tipoCliente: editingClient.tipoCliente || 'Mayorista',
        direccion: editingClient.direccion || '',
        ciudad: editingClient.ciudad || 'Valencia',
        telefono: editingClient.telefono || '',
        email: editingClient.email || '',
        responsable: editingClient.responsable || '',
        limiteCreditoUsd: Number(editingClient.limiteCreditoUsd || 0),
        diasCredito: Number(editingClient.diasCredito || 0),
        vendedorAsignado: editingClient.vendedorAsignado || 'OF',
        zonaVenta: editingClient.zonaVenta || '07',
        comentarios: editingClient.comentarios || '',
        imagenDocumento: editingClient.imagenDocumento || editingClient.imagen_documento || '',
        imagenLocal: editingClient.imagenLocal || editingClient.imagen_local || '',
        inactivo: Boolean(editingClient.inactivo)
      });
    } else {
      const defSeller = resolveDefaultSellerCode();
      const matchedSeller = sellersOptions.find(s => s.coVen === defSeller);
      const defZone = matchedSeller?.coZon || DEFAULT_SELLER_ZONE_MAP[defSeller] || '07';
      setForm({
        codigo: `CLI-${Date.now().toString().slice(-6)}`,
        nombre: '',
        tipoPersona: 'J',
        rif: 'J-',
        tipoCliente: 'Mayorista',
        direccion: '',
        ciudad: 'Valencia',
        telefono: '',
        email: '',
        responsable: '',
        limiteCreditoUsd: 0,
        diasCredito: 0,
        vendedorAsignado: defSeller,
        zonaVenta: defZone,
        comentarios: '',
        imagenDocumento: '',
        imagenLocal: '',
        inactivo: !userCanApprove
      });
    }
  }, [isOpen, editingClient]);

  if (!isOpen) return null;

  const isNaturalDocType = form.tipoPersona === 'V' || form.tipoPersona === 'E';
  const documentPhotoLabel = isNaturalDocType
    ? `FOTO DE CÉDULA O RIF (${form.tipoPersona})`
    : `FOTO DEL RIF (${form.tipoPersona})`;

  const handleImageUpload = async (fieldKey, label, file) => {
    if (!file) return;
    if (!file.type || !file.type.startsWith('image/')) {
      notify?.error?.('Seleccione un archivo de imagen válido (JPG, PNG o WEBP).');
      return;
    }
    setCompressingField(fieldKey);
    try {
      const compressed = await compressClientImageToBase64(file);
      setForm(prev => ({ ...prev, [fieldKey]: compressed.dataUrl }));
      notify?.success?.(`${label} optimizada en Base64 (${compressed.sizeKb} KB).`);
    } catch (err) {
      console.error(err);
      notify?.error?.('No se pudo procesar la imagen seleccionada.');
    } finally {
      setCompressingField(null);
    }
  };

  const estimateBase64Kb = (dataUrl) => {
    if (!dataUrl || typeof dataUrl !== 'string') return 0;
    const body = dataUrl.split(',')[1] || '';
    return Math.round(((body.length * 3) / 4) / 1024);
  };

  const rifNormalized = applyContributorPrefixToRif(form.rif, form.tipoPersona);
  const hasDocumentDigits = /[0-9]{5,}/.test(rifNormalized);
  const docCheck = validateDocumentNumber(rifNormalized, form.tipoPersona);
  const selectedContribMeta = SENIAT_CONTRIBUTOR_TYPES.find(t => t.code === form.tipoPersona) || SENIAT_CONTRIBUTOR_TYPES[0];
  const duplicateClient = !isEditing && hasDocumentDigits
    ? clients.find(c => String(c.rif || '').trim().toUpperCase() === rifNormalized)
    : null;

  const handleContributorTypeChange = (newType) => {
    const cleanType = ['J', 'V', 'E', 'G', 'P'].includes(newType) ? newType : 'J';
    setForm(prev => ({
      ...prev,
      tipoPersona: cleanType,
      rif: applyContributorPrefixToRif(prev.rif, cleanType)
    }));
  };

  const handleRifInputChange = (rawVal) => {
    const upper = String(rawVal || '').toUpperCase();
    const prefixMatch = upper.trim().match(/^([JVEGP])/);
    setForm(prev => ({
      ...prev,
      tipoPersona: prefixMatch ? prefixMatch[1] : prev.tipoPersona,
      rif: upper
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.codigo.trim()) {
      notify?.error?.('El código de cliente es obligatorio');
      return;
    }
    if (!form.nombre.trim()) {
      notify?.error?.('La razón social o nombre es obligatoria');
      return;
    }
    if (!hasDocumentDigits) {
      notify?.error?.('Debe ingresar el número de RIF o Cédula completo');
      return;
    }
    if (duplicateClient) {
      notify?.error?.(`Ya existe un cliente registrado con el RIF/Cédula ${rifNormalized} (${duplicateClient.nombre}).`);
      return;
    }
    if (!isEditing && !form.telefono.trim()) {
      notify?.error?.('El teléfono de contacto es obligatorio');
      return;
    }
    if (!isEditing && !form.direccion.trim()) {
      notify?.error?.('La dirección fiscal / de despacho es obligatoria');
      return;
    }

    setIsSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const todayDate = nowIso.slice(0, 10);
      const isDirectApproval = userCanApprove;

      const payload = {
        ...(editingClient || {}),
        ...form,
        id: form.id || form.codigo.trim().toUpperCase(),
        codigo: form.codigo.trim().toUpperCase(),
        nombre: form.nombre.trim(),
        tipoPersona: form.tipoPersona || 'J',
        tipoContribuyente: form.tipoPersona || 'J',
        rif: rifNormalized,
        telefono: form.telefono.trim(),
        email: form.email.trim(),
        direccion: form.direccion.trim(),
        ciudad: form.ciudad.trim() || 'Valencia',
        responsable: form.responsable.trim() || form.nombre.trim(),
        comentarios: form.comentarios.trim(),
        limiteCreditoUsd: isDirectApproval ? Number(form.limiteCreditoUsd || 0) : 0,
        diasCredito: isDirectApproval ? Number(form.diasCredito || 0) : 0,
        fechaRegistro: editingClient?.fechaRegistro || todayDate,
        inactivo: isDirectApproval ? Boolean(form.inactivo) : true,
        estadoAprobacion: isEditing
          ? (editingClient.estadoAprobacion || 'APROBADO')
          : (isDirectApproval ? 'APROBADO' : 'PENDIENTE'),
        solicitadoPor: editingClient?.solicitadoPor || currentUser?.nombre || currentUser?.username || 'Operador',
        solicitadoPorUsername: editingClient?.solicitadoPorUsername || currentUser?.username || '',
        fechaSolicitud: editingClient?.fechaSolicitud || nowIso,
        aprobadoPor: isDirectApproval ? (editingClient?.aprobadoPor || currentUser?.nombre || currentUser?.username || '') : '',
        aprobadoPorUsername: isDirectApproval ? (editingClient?.aprobadoPorUsername || currentUser?.username || '') : '',
        fechaAprobacion: isDirectApproval ? (editingClient?.fechaAprobacion || nowIso) : null,
        motivoRechazo: ''
      };

      const saved = onSaveClient ? await onSaveClient(payload) : payload;
      if (onSuccess) onSuccess(saved || payload);
      onClose();
    } catch (err) {
      console.error(err);
      notify?.error?.('Error al guardar el cliente en Supabase');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="clients-modal-backdrop" style={{ zIndex: 11200 }} onClick={() => !isSaving && onClose()}>
      <div
        className="clients-modal-container"
        style={{ maxWidth: '660px', width: '95%', maxHeight: '92vh', overflowY: 'auto', padding: 0 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-glass, rgba(255,255,255,0.08))',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
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
                  : userCanApprove
                    ? 'linear-gradient(135deg, #059669, #10b981)'
                    : 'linear-gradient(135deg, #d97706, #ea580c)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff'
              }}
            >
              {isEditing ? <Edit2 size={20} /> : <Plus size={22} />}
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, fontFamily: 'var(--font-heading)', color: 'var(--text-primary)' }}>
                {isEditing
                  ? 'Modificar Ficha de Cliente'
                  : userCanApprove
                    ? 'Registrar Nuevo Cliente (Aprobación Directa)'
                    : 'Solicitar Registro de Nuevo Cliente'}
              </h3>
              <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                {userCanApprove
                  ? 'Se registrará activo y habilitado inmediatamente para facturar.'
                  : 'La solicitud será enviada a Caja Principal (Vanessa) para su revisión y aprobación.'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '6px' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Banner informativo según rol */}
        {!isEditing && (
          <div
            style={{
              margin: '14px 24px 0',
              padding: '10px 14px',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '0.78rem',
              background: userCanApprove ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)',
              border: `1px solid ${userCanApprove ? 'rgba(16, 185, 129, 0.35)' : 'rgba(245, 158, 11, 0.35)'}`,
              color: userCanApprove ? '#34d399' : '#fbbf24'
            }}
          >
            {userCanApprove ? <CheckCircle2 size={17} style={{ flexShrink: 0 }} /> : <Clock size={17} style={{ flexShrink: 0 }} />}
            <span>
              {userCanApprove
                ? 'Operador autorizado en oficina/caja: el cliente quedará APROBADO de inmediato.'
                : 'Importante: el cliente permanecerá pendiente hasta que Vanessa (Caja Principal) o un supervisor autorizado lo apruebe. Luego podrás montarle pedidos.'}
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ padding: '18px 24px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
            <div>
              <label style={labelStyle}>CÓDIGO (co_cli) *</label>
              <input
                type="text"
                required
                value={form.codigo}
                onChange={e => setForm({ ...form, codigo: e.target.value.toUpperCase() })}
                disabled={isEditing || isSaving || !userCanApprove}
                placeholder="Ej: CLI-00123"
                style={{
                  ...inputStyle,
                  fontFamily: 'var(--font-code)',
                  opacity: (isEditing || !userCanApprove) ? 0.75 : 1
                }}
              />
            </div>

            <div>
              <label style={labelStyle}>CLASIFICACIÓN SENIAT (TIPO CONTRIBUYENTE) *</label>
              <select
                value={form.tipoPersona}
                onChange={e => handleContributorTypeChange(e.target.value)}
                disabled={isSaving}
                style={inputStyle}
                title={selectedContribMeta.description}
              >
                {SENIAT_CONTRIBUTOR_TYPES.map(t => (
                  <option key={t.code} value={t.code}>
                    {t.label}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: '0.67rem', color: 'var(--neon-cyan, #38bdf8)', marginTop: '4px', lineHeight: 1.3 }}>
                {selectedContribMeta.description}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
            <div>
              <label style={labelStyle}>RIF / CÉDULA ({form.tipoPersona}) *</label>
              <input
                type="text"
                required
                value={form.rif}
                onChange={e => handleRifInputChange(e.target.value)}
                disabled={isSaving}
                placeholder={(form.tipoPersona === 'V' || form.tipoPersona === 'E')
                  ? `Ej: ${form.tipoPersona}-12345678 o ${form.tipoPersona}-12345678-9`
                  : `Ej: ${form.tipoPersona}-12345678-9`}
                style={{ ...inputStyle, fontFamily: 'var(--font-code)' }}
              />
              {duplicateClient && (
                <div style={{ fontSize: '0.7rem', color: '#f87171', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <ShieldAlert size={12} /> Ya registrado: {duplicateClient.nombre}
                </div>
              )}
              {!duplicateClient && hasDocumentDigits && docCheck.isValid && (
                <div style={{ fontSize: '0.68rem', color: '#34d399', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle2 size={12} /> {docCheck.message} ({selectedContribMeta.shortLabel})
                </div>
              )}
              {!duplicateClient && hasDocumentDigits && !docCheck.isValid && (
                <div style={{ fontSize: '0.68rem', color: '#fbbf24', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <AlertTriangle size={12} /> {docCheck.message}
                </div>
              )}
            </div>

            <div>
              <label style={labelStyle}>RAZÓN SOCIAL / NOMBRE COMPLETO *</label>
              <input
                type="text"
                required
                value={form.nombre}
                onChange={e => setForm({ ...form, nombre: e.target.value })}
                disabled={isSaving}
                placeholder="Ej: Repuestos y Servicios El Motor, C.A."
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>TIPO DE CLIENTE</label>
              <select
                value={form.tipoCliente}
                onChange={e => setForm({ ...form, tipoCliente: e.target.value })}
                disabled={isSaving}
                style={inputStyle}
              >
                <option value="Mayorista">Mayorista</option>
                <option value="Minorista">Minorista</option>
                <option value="Taller">Taller Mecánico</option>
                <option value="Distribuidor">Distribuidor</option>
                <option value="Corporativo">Corporativo / Flotas</option>
              </select>
            </div>

            <div>
              <label style={labelStyle}>VENDEDOR ASIGNADO (co_ven)</label>
              <select
                value={form.vendedorAsignado}
                onChange={e => {
                  const newVen = e.target.value;
                  const found = sellersOptions.find(s => s.coVen === newVen);
                  const mappedZone = found?.coZon || DEFAULT_SELLER_ZONE_MAP[newVen] || form.zonaVenta;
                  setForm({ ...form, vendedorAsignado: newVen, zonaVenta: mappedZone });
                }}
                disabled={isSaving}
                style={inputStyle}
              >
                {sellersOptions.map(s => (
                  <option key={s.coVen} value={s.coVen}>
                    {s.coVen} - {s.venDes} · Zona {s.coZon}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>ZONA DE VENTA (co_zon)</label>
              <select
                value={form.zonaVenta}
                onChange={e => setForm({ ...form, zonaVenta: e.target.value })}
                disabled={isSaving}
                style={inputStyle}
              >
                {zonesOptions.map(z => (
                  <option key={z.coZon} value={z.coZon}>
                    {z.coZon} - {z.zonDes}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={labelStyle}>TELÉFONO / WHATSAPP *</label>
              <input
                type="text"
                required
                value={form.telefono}
                onChange={e => setForm({ ...form, telefono: e.target.value })}
                disabled={isSaving}
                placeholder="Ej: 0414-1234567 / 0241-8712345"
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>PERSONA CONTACTO / RESPONSABLE</label>
              <input
                type="text"
                value={form.responsable}
                onChange={e => setForm({ ...form, responsable: e.target.value })}
                disabled={isSaving}
                placeholder="Nombre del encargado o dueño"
                style={inputStyle}
              />
            </div>

            <div>
              <label style={labelStyle}>CORREO ELECTRÓNICO</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                disabled={isSaving}
                placeholder="contacto@cliente.com"
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
            <div>
              <label style={labelStyle}>DIRECCIÓN FISCAL / DESPACHO *</label>
              <input
                type="text"
                required
                value={form.direccion}
                onChange={e => setForm({ ...form, direccion: e.target.value })}
                disabled={isSaving}
                placeholder="Ej: Av. Bolívar Norte, Local 12, Valencia"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>CIUDAD</label>
              <input
                type="text"
                value={form.ciudad}
                onChange={e => setForm({ ...form, ciudad: e.target.value })}
                disabled={isSaving}
                placeholder="Valencia"
                style={inputStyle}
              />
            </div>
          </div>

          {userCanApprove && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>LÍMITE DE CRÉDITO (USD)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.limiteCreditoUsd}
                  onChange={e => setForm({ ...form, limiteCreditoUsd: e.target.value })}
                  disabled={isSaving}
                  style={{ ...inputStyle, fontFamily: 'var(--font-tech)', fontSize: '0.9rem' }}
                />
              </div>

              <div>
                <label style={labelStyle}>DÍAS DE CRÉDITO</label>
                <input
                  type="number"
                  min="0"
                  max="360"
                  value={form.diasCredito}
                  onChange={e => setForm({ ...form, diasCredito: e.target.value })}
                  disabled={isSaving}
                  style={{ ...inputStyle, fontFamily: 'var(--font-tech)', fontSize: '0.9rem' }}
                />
              </div>
            </div>
          )}

          <div>
            <label style={labelStyle}>OBSERVACIONES / NOTAS PARA CAJA</label>
            <input
              type="text"
              value={form.comentarios}
              onChange={e => setForm({ ...form, comentarios: e.target.value })}
              disabled={isSaving}
              placeholder={userCanApprove ? 'Notas internas de la ficha del cliente' : 'Referencia comercial, horario de entrega, etc.'}
              style={inputStyle}
            />
          </div>

          {/* EVIDENCIA FOTOGRÁFICA EN BASE64 LIGERO */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '12px' }}>
            {[
              {
                key: 'imagenDocumento',
                label: documentPhotoLabel,
                hint: isNaturalDocType
                  ? 'Foto legible de la Cédula de Identidad o RIF'
                  : 'Foto legible del RIF jurídico o ente',
                inputId: 'client-doc-photo-input'
              },
              {
                key: 'imagenLocal',
                label: 'FOTO DEL LOCAL COMERCIAL',
                hint: 'Fachada o interior del comercio / taller',
                inputId: 'client-store-photo-input'
              }
            ].map(slot => {
              const imgValue = form[slot.key];
              const isBusySlot = compressingField === slot.key;
              const kbSize = estimateBase64Kb(imgValue);
              return (
                <div
                  key={slot.key}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: '1px dashed var(--border-glass, rgba(148,163,184,0.35))',
                    background: 'rgba(255,255,255,0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                    <span style={{ ...labelStyle, marginBottom: 0 }}>{slot.label}</span>
                    {imgValue && (
                      <span style={{ fontSize: '0.64rem', color: '#34d399', fontFamily: 'var(--font-code)', fontWeight: 700 }}>
                        Base64 · {kbSize} KB
                      </span>
                    )}
                  </div>

                  {imgValue ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <img
                        src={imgValue}
                        alt={slot.label}
                        onClick={() => setPreviewPhoto({ title: slot.label, src: imgValue })}
                        style={{
                          width: '68px',
                          height: '52px',
                          objectFit: 'cover',
                          borderRadius: '8px',
                          border: '1px solid var(--border-glass)',
                          cursor: 'pointer'
                        }}
                      />
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', flex: 1 }}>
                        <button
                          type="button"
                          onClick={() => setPreviewPhoto({ title: slot.label, src: imgValue })}
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '0.7rem', padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Eye size={12} /> Ver
                        </button>
                        <label
                          htmlFor={slot.inputId}
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '0.7rem', padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer', margin: 0 }}
                        >
                          <Upload size={12} /> Cambiar
                        </label>
                        <button
                          type="button"
                          onClick={() => setForm(prev => ({ ...prev, [slot.key]: '' }))}
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '0.7rem', padding: '4px 8px', color: '#f87171', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          title="Quitar imagen"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label
                      htmlFor={slot.inputId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '12px 10px',
                        borderRadius: '8px',
                        background: 'var(--bg-secondary)',
                        cursor: isSaving || isBusySlot ? 'wait' : 'pointer',
                        color: 'var(--text-muted)',
                        fontSize: '0.76rem',
                        textAlign: 'center'
                      }}
                    >
                      {isBusySlot ? (
                        <span>Optimizando Base64...</span>
                      ) : (
                        <>
                          <ImageIcon size={16} color="var(--neon-cyan, #38bdf8)" style={{ flexShrink: 0 }} />
                          <span>
                            <strong style={{ color: 'var(--text-primary)' }}>Subir imagen</strong>
                            <div style={{ fontSize: '0.67rem', opacity: 0.8 }}>{slot.hint}</div>
                          </span>
                        </>
                      )}
                    </label>
                  )}

                  <input
                    id={slot.inputId}
                    type="file"
                    accept="image/*"
                    disabled={isSaving || isBusySlot}
                    style={{ display: 'none' }}
                    onChange={e => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      handleImageUpload(slot.key, slot.label, file);
                    }}
                  />
                </div>
              );
            })}
          </div>

          {userCanApprove && isEditing && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
              <input
                type="checkbox"
                id="clientInactivoCheckModal"
                checked={form.inactivo}
                onChange={e => setForm({ ...form, inactivo: e.target.checked })}
                disabled={isSaving}
                style={{ width: '16px', height: '16px', accentColor: 'var(--motorven-red)' }}
              />
              <label htmlFor="clientInactivoCheckModal" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                Marcar cliente como inactivo en Supabase
              </label>
            </div>
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              marginTop: '8px',
              paddingTop: '14px',
              borderTop: '1px solid var(--border-glass, rgba(255,255,255,0.08))'
            }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="btn btn-secondary"
              style={{ padding: '8px 16px', fontSize: '0.85rem' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving || Boolean(duplicateClient)}
              className="btn btn-primary"
              style={{
                padding: '8px 20px',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: userCanApprove
                  ? 'linear-gradient(135deg, #059669, #10b981)'
                  : 'linear-gradient(135deg, var(--motorven-navy), var(--motorven-red))'
              }}
            >
              {isSaving ? (
                <>
                  <RotateCcw size={15} className="spin" /> Guardando...
                </>
              ) : (
                <>
                  <Save size={15} />{' '}
                  {isEditing
                    ? 'Guardar Cambios'
                    : userCanApprove
                      ? 'Registrar Cliente Activo'
                      : 'Enviar a Aprobación'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
      <ImagePreviewLightbox photo={previewPhoto} onClose={() => setPreviewPhoto(null)} />
    </div>
  );
}
