import React, { useState, useMemo } from 'react';
import {
  FileText,
  Search,
  Printer,
  Download,
  Plus,
  CheckCircle,
  AlertCircle,
  Building,
  User,
  DollarSign,
  Calendar,
  X,
  ChevronRight,
  Receipt,
  BookOpen,
  Filter,
  CreditCard,
  Percent,
  Check
} from 'lucide-react';
import { formatBs, formatUsd } from '../services/formatService';
import { saveSupabaseProfitIslrWithholding } from '../services/supabaseService';
import { generateTaxReportPDF, generateSeniatRetentionVoucherPDF, generatePaymentOrderPDF } from '../services/pdfReportService';

export default function IslrWithholdingModal({
  isOpen,
  onClose,
  islrConcepts = [],
  beneficiaries = [],
  paymentOrders = [],
  withholdings = [],
  accountsPayable = [],
  purchases = [],
  suppliers = [],
  config = {},
  currentUser = null,
  onRefresh
}) {
  const [activeTab, setActiveTab] = useState('withholdings'); // 'withholdings' | 'new_voucher' | 'payment_orders' | 'concepts'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState(null);

  // New Voucher Form State
  const [formData, setFormData] = useState({
    proveedorCod: '',
    proveedorNombre: '',
    proveedorRif: '',
    proveedorDireccion: '',
    nroFacturaAfectada: '',
    nroControl: '',
    fechaEmision: new Date().toISOString().split('T')[0],
    periodoFiscal: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
    codigoConceptoIslr: '',
    conceptoDescripcion: '',
    baseImponible: '',
    porcentajeRetencion: '2',
    sustraendo: '0',
    moneda: 'BS',
    tasaCambio: '36.50',
    montoTotalFactura: ''
  });

  const notify = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Filtered concepts
  const filteredConcepts = useMemo(() => {
    if (!searchQuery) return islrConcepts;
    const q = searchQuery.toLowerCase();
    return islrConcepts.filter(c =>
      (c.coIslr || '').toLowerCase().includes(q) ||
      (c.islrDes || '').toLowerCase().includes(q) ||
      (c.islrDes2 || '').toLowerCase().includes(q) ||
      (c.numeral || '').toLowerCase().includes(q) ||
      (c.literal || '').toLowerCase().includes(q)
    );
  }, [islrConcepts, searchQuery]);

  // Filtered payment orders
  const filteredPaymentOrders = useMemo(() => {
    if (!searchQuery) return paymentOrders;
    const q = searchQuery.toLowerCase();
    return paymentOrders.filter(o =>
      (o.ordNum || '').toString().toLowerCase().includes(q) ||
      (o.benDes || '').toLowerCase().includes(q) ||
      (o.descrip || '').toLowerCase().includes(q) ||
      (o.cheNum || '').toLowerCase().includes(q)
    );
  }, [paymentOrders, searchQuery]);

  // Filtered withholdings
  const filteredWithholdings = useMemo(() => {
    if (!searchQuery) return withholdings;
    const q = searchQuery.toLowerCase();
    return withholdings.filter(w =>
      (w.nroComprobante || '').toLowerCase().includes(q) ||
      (w.proveedorNombre || '').toLowerCase().includes(q) ||
      (w.proveedorRif || '').toLowerCase().includes(q) ||
      (w.nroFacturaAfectada || '').toLowerCase().includes(q)
    );
  }, [withholdings, searchQuery]);

  // Handle supplier change
  const handleSupplierSelect = (coProv) => {
    const sup = suppliers.find(s => s.co_prov === coProv || s.coProv === coProv);
    const ben = beneficiaries.find(b => b.codBen === coProv || b.cod_ben === coProv);
    if (sup) {
      setFormData(prev => ({
        ...prev,
        proveedorCod: sup.co_prov || sup.coProv,
        proveedorNombre: sup.prov_des || sup.provDes,
        proveedorRif: sup.rif || '',
        proveedorDireccion: sup.direc1 || ''
      }));
    } else if (ben) {
      setFormData(prev => ({
        ...prev,
        proveedorCod: ben.codBen || ben.cod_ben,
        proveedorNombre: ben.benDes || ben.ben_des,
        proveedorRif: ben.rif || '',
        proveedorDireccion: ben.direc1 || ''
      }));
    }
  };

  // Handle concept selection in form
  const handleConceptSelect = (coIslr) => {
    const concept = islrConcepts.find(c => c.coIslr === coIslr);
    if (concept) {
      setFormData(prev => ({
        ...prev,
        codigoConceptoIslr: concept.coIslr,
        conceptoDescripcion: concept.islrDes || concept.islrDes2 || ''
      }));
    }
  };

  // Calculated withholding amount
  const calculatedWithholding = useMemo(() => {
    const base = parseFloat(formData.baseImponible) || 0;
    const pct = parseFloat(formData.porcentajeRetencion) || 0;
    const sust = parseFloat(formData.sustraendo) || 0;
    const calculated = (base * (pct / 100)) - sust;
    return calculated > 0 ? calculated : 0;
  }, [formData.baseImponible, formData.porcentajeRetencion, formData.sustraendo]);

  const handleCreateVoucher = async (e) => {
    e.preventDefault();
    if (!formData.proveedorNombre || !formData.baseImponible || !formData.porcentajeRetencion) {
      notify('Por favor complete los campos obligatorios del comprobante', 'error');
      return;
    }

    setSaving(true);
    const now = new Date();
    const period = formData.periodoFiscal.replace('-', '');
    const nroComp = `${period}${String(Math.floor(100000 + Math.random() * 900000))}`;

    const newVoucher = {
      nroComprobante: nroComp,
      periodoFiscal: formData.periodoFiscal,
      fechaEmision: formData.fechaEmision,
      proveedorCod: formData.proveedorCod,
      proveedorNombre: formData.proveedorNombre,
      proveedorRif: formData.proveedorRif,
      proveedorDireccion: formData.proveedorDireccion,
      nroFacturaAfectada: formData.nroFacturaAfectada || 'S/N',
      nroControl: formData.nroControl || '00-000000',
      baseImponible: parseFloat(formData.baseImponible) || 0,
      porcentajeRetencion: parseFloat(formData.porcentajeRetencion) || 0,
      montoRetenido: calculatedWithholding,
      montoTotalFactura: parseFloat(formData.montoTotalFactura) || parseFloat(formData.baseImponible) || 0,
      codigoConceptoIslr: formData.codigoConceptoIslr || '01',
      conceptoDescripcion: formData.conceptoDescripcion || 'Servicios Generales',
      sustraendo: parseFloat(formData.sustraendo) || 0,
      moneda: formData.moneda,
      tasaCambio: parseFloat(formData.tasaCambio) || 1,
      coSucu: '01'
    };

    const res = await saveSupabaseProfitIslrWithholding(newVoucher);
    setSaving(false);
    if (res.success) {
      notify('✅ Comprobante de Retención ISLR generado y guardado exitosamente');
      setSelectedVoucher(res.data || newVoucher);
      setActiveTab('withholdings');
      if (onRefresh) onRefresh();
    } else {
      notify(`Error guardando comprobante: ${res.error}`, 'error');
    }
  };

  const printVoucher = () => {
    generateTaxReportPDF({
      sales: [],
      purchases: purchases || [],
      fiscalClosures: [],
      withholdings: selectedVoucher ? [selectedVoucher] : (withholdings || []),
      config,
      currentUser,
      reportType: 'ISLR'
    });
  };

  if (!isOpen) return null;

  const isDark = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="islr-modal-container" onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div
          className="no-print"
          style={{
            padding: '1.25rem 1.5rem',
            background: isDark
              ? 'linear-gradient(135deg, rgba(0, 43, 122, 0.45) 0%, rgba(10, 16, 32, 0.95) 100%)'
              : 'linear-gradient(135deg, #eef4ff 0%, #f8fafc 100%)',
            borderBottom: '1px solid var(--border-glass)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              padding: '10px',
              borderRadius: '12px',
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              color: 'var(--motorven-gold)',
              border: '1px solid rgba(245, 158, 11, 0.3)'
            }}>
              <FileText size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-heading)' }}>
                  Generador Oficial de Retenciones ISLR SENIAT
                </h2>
                <span className="badge badge-warning" style={{ fontSize: '0.68rem', letterSpacing: '0.5px' }}>
                  SENIAT Oficial
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Gestión de Comprobantes de Retención de I.S.L.R., Órdenes de Pago Supabase y Catálogo de Tarifas Fiscales
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn-icon"
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', borderRadius: '8px', padding: '6px' }}
            title="Cerrar modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Notification alert */}
        {notification && (
          <div className={`px-6 py-2.5 text-sm flex items-center gap-2 border-b ${
            notification.type === 'error'
              ? 'bg-rose-500/10 text-rose-300 border-rose-500/20'
              : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
          }`}>
            {notification.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
            <span>{notification.msg}</span>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="no-print px-6 border-b border-slate-800 bg-slate-900 flex items-center justify-between gap-4">
          <div className="flex gap-2">
            <button
              onClick={() => { setActiveTab('withholdings'); setSelectedVoucher(null); }}
              className={`px-4 py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
                activeTab === 'withholdings'
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Receipt className="w-4 h-4" />
              Comprobantes Emitidos ({withholdings.length})
            </button>
            <button
              onClick={() => setActiveTab('new_voucher')}
              className={`px-4 py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
                activeTab === 'new_voucher'
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Plus className="w-4 h-4" />
              Generar Nuevo Comprobante
            </button>
            <button
              onClick={() => setActiveTab('payment_orders')}
              className={`px-4 py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
                activeTab === 'payment_orders'
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              Órdenes de Pago & Beneficiarios ({paymentOrders.length})
            </button>
            <button
              onClick={() => setActiveTab('concepts')}
              className={`px-4 py-3 text-sm font-medium border-b-2 flex items-center gap-2 transition-colors ${
                activeTab === 'concepts'
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Tarifario SENIAT ({islrConcepts.length} Conceptos)
            </button>
          </div>

          {activeTab !== 'new_voucher' && (
            <div className="relative w-64 my-2">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700/60 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
              />
            </div>
          )}
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {/* TAB 1: LIST OF WITHHOLDINGS / VOUCHER VIEW */}
          {activeTab === 'withholdings' && (
            <div>
              {selectedVoucher ? (
                /* OFFICIAL SENIAT PRINTABLE VOUCHER */
                <div className="space-y-4">
                  <div className="no-print flex items-center justify-between bg-slate-800/60 p-4 rounded-xl border border-slate-700">
                    <button
                      onClick={() => setSelectedVoucher(null)}
                      className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold"
                    >
                      ← Volver al Listado de Comprobantes
                    </button>
                    <div className="flex gap-2">
                      <button
                        onClick={printVoucher}
                        className="btn btn-print-report text-xs flex items-center gap-2"
                      >
                        <Printer className="w-4 h-4" color="#ffffff" />
                        Imprimir Reporte
                      </button>
                    </div>
                  </div>

                  {/* SENIAT Printable Sheet */}
                  <div id="seniat-voucher" className="bg-white text-slate-900 p-8 rounded-xl border border-slate-300 shadow-xl print:shadow-none print:m-0 print:p-6 print:border-none">
                    
                    {/* Voucher Header */}
                    <div className="border-b-2 border-slate-900 pb-4 mb-4 flex justify-between items-start">
                      <div>
                        <h1 className="text-base font-black uppercase tracking-wider text-slate-900">
                          REPÚBLICA BOLIVARIANA DE VENEZUELA
                        </h1>
                        <p className="text-xs font-bold text-slate-700">
                          SERVICIO NACIONAL INTEGRADO DE ADMINISTRACIÓN ADUANERA Y TRIBUTARIA (SENIAT)
                        </p>
                        <p className="text-sm font-extrabold text-blue-900 mt-2">
                          SIGNUM MOTORVEN, C.A. / GRUPO MOTORVEN
                        </p>
                        <p className="text-[11px] text-slate-600">
                          RIF: J-30401927-4 | AGENTE DE RETENCIÓN DE I.S.L.R.
                        </p>
                      </div>
                      <div className="text-right border-2 border-slate-900 p-3 rounded-lg bg-slate-50">
                        <p className="text-[10px] font-bold text-slate-600 uppercase">N° DE COMPROBANTE</p>
                        <p className="text-lg font-black text-rose-700 tracking-wider">
                          {selectedVoucher.nroComprobante || '202604000001'}
                        </p>
                        <p className="text-[10px] font-bold text-slate-600 mt-1">PERÍODO FISCAL: {selectedVoucher.periodoFiscal}</p>
                        <p className="text-[10px] text-slate-500">FECHA: {selectedVoucher.fechaEmision}</p>
                      </div>
                    </div>

                    <div className="text-center py-2 mb-4 bg-slate-100 border border-slate-300 rounded font-black text-sm tracking-wide uppercase text-slate-800">
                      COMPROBANTE DE RETENCIÓN DEL IMPUESTO SOBRE LA RENTA (I.S.L.R.)
                      <div className="text-[10px] font-normal normal-case text-slate-600">
                        (Decreto N° 1.808 - Reglamento de la Ley de Impuesto Sobre la Renta en Materia de Retenciones)
                      </div>
                    </div>

                    {/* Agent & Subject Data */}
                    <div className="grid grid-cols-2 gap-4 text-xs mb-6">
                      <div className="p-3 border border-slate-300 rounded bg-slate-50">
                        <p className="font-bold text-slate-900 border-b pb-1 mb-2 text-[11px] uppercase">
                          1. DATOS DEL AGENTE DE RETENCIÓN
                        </p>
                        <p><strong className="text-slate-700">Nombre / Razón Social:</strong> SIGNUM MOTORVEN, C.A.</p>
                        <p><strong className="text-slate-700">R.I.F.:</strong> J-30401927-4</p>
                        <p><strong className="text-slate-700">Dirección Fiscal:</strong> AV. PRINCIPAL CRUCE CON CALLE COMERCIO, VALENCIA, CARABOBO</p>
                      </div>

                      <div className="p-3 border border-slate-300 rounded bg-slate-50">
                        <p className="font-bold text-slate-900 border-b pb-1 mb-2 text-[11px] uppercase">
                          2. DATOS DEL SUJETO RETENIDO (PROVEEDOR / BENEFICIARIO)
                        </p>
                        <p><strong className="text-slate-700">Nombre / Razón Social:</strong> {selectedVoucher.proveedorNombre || 'PROVEEDOR NO ESPECIFICADO'}</p>
                        <p><strong className="text-slate-700">R.I.F.:</strong> {selectedVoucher.proveedorRif || 'N/A'}</p>
                        <p><strong className="text-slate-700">Código / Ref:</strong> {selectedVoucher.proveedorCod || 'N/A'}</p>
                        <p><strong className="text-slate-700">Dirección:</strong> {selectedVoucher.proveedorDireccion || 'DOMICILIO FISCAL VENEZUELA'}</p>
                      </div>
                    </div>

                    {/* Withholding Calculations Table */}
                    <div className="border border-slate-300 rounded overflow-hidden mb-6">
                      <table className="w-full text-[11px] text-left">
                        <thead className="bg-slate-800 text-white font-bold uppercase text-[10px]">
                          <tr>
                            <th className="p-2">Fecha Fact.</th>
                            <th className="p-2">N° Factura</th>
                            <th className="p-2">N° Control</th>
                            <th className="p-2">Cód. ISLR</th>
                            <th className="p-2">Concepto / Actividad Legal</th>
                            <th className="p-2 text-right">Base Imponible</th>
                            <th className="p-2 text-center">% Ret.</th>
                            <th className="p-2 text-right">Sustraendo</th>
                            <th className="p-2 text-right">Total Retenido</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          <tr>
                            <td className="p-2 font-mono">{selectedVoucher.fechaEmision}</td>
                            <td className="p-2 font-mono font-bold text-blue-900">{selectedVoucher.nroFacturaAfectada}</td>
                            <td className="p-2 font-mono">{selectedVoucher.nroControl || '00-000000'}</td>
                            <td className="p-2 font-mono font-bold">{selectedVoucher.codigoConceptoIslr}</td>
                            <td className="p-2 max-w-xs">{selectedVoucher.conceptoDescripcion}</td>
                            <td className="p-2 text-right font-mono font-bold">
                              Bs. {Number(selectedVoucher.baseImponible).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-2 text-center font-bold text-amber-800">
                              {selectedVoucher.porcentajeRetencion}%
                            </td>
                            <td className="p-2 text-right font-mono">
                              Bs. {Number(selectedVoucher.sustraendo || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-2 text-right font-mono font-black text-rose-900 bg-rose-50">
                              Bs. {Number(selectedVoucher.montoRetenido).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        </tbody>
                        <tfoot className="bg-slate-100 font-bold border-t border-slate-300">
                          <tr>
                            <td colSpan="5" className="p-2 text-right uppercase text-[10px]">Totales Generales:</td>
                            <td className="p-2 text-right font-mono">
                              Bs. {Number(selectedVoucher.baseImponible).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                            </td>
                            <td></td>
                            <td className="p-2 text-right font-mono">
                              Bs. {Number(selectedVoucher.sustraendo || 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-2 text-right font-mono text-rose-900 bg-rose-100">
                              Bs. {Number(selectedVoucher.montoRetenido).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    {/* Equivalent in USD if applicable */}
                    {selectedVoucher.tasaCambio > 1 && (
                      <div className="mb-6 p-2.5 bg-slate-50 border border-slate-200 rounded text-xs flex justify-between items-center">
                        <span className="text-slate-600">
                          Monto equivalente en Divisas (Tasa Ref: {formatBs(selectedVoucher.tasaCambio)}/$):
                        </span>
                        <span className="font-mono font-bold text-slate-800">
                          Retención: {formatUsd(selectedVoucher.montoRetenido / selectedVoucher.tasaCambio)} USD | Base: {formatUsd(selectedVoucher.baseImponible / selectedVoucher.tasaCambio)} USD
                        </span>
                      </div>
                    )}

                    {/* Signature Boxes */}
                    <div className="grid grid-cols-2 gap-12 pt-12 mt-4 border-t border-slate-300 text-center text-xs">
                      <div>
                        <div className="border-b border-slate-900 pb-1 mb-1 w-3/4 mx-auto"></div>
                        <p className="font-bold text-slate-900">FIRMA Y SELLO AGENTE DE RETENCIÓN</p>
                        <p className="text-[10px] text-slate-600">SIGNUM MOTORVEN, C.A.</p>
                      </div>
                      <div>
                        <div className="border-b border-slate-900 pb-1 mb-1 w-3/4 mx-auto"></div>
                        <p className="font-bold text-slate-900">FIRMA Y SELLO BENEFICIARIO / PROVEEDOR</p>
                        <p className="text-[10px] text-slate-600">FECHA DE RECEPCIÓN: ____/____/________</p>
                      </div>
                    </div>

                  </div>
                </div>
              ) : (
                /* WITHHOLDINGS LIST */
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="text-xs text-slate-400">
                      Mostrando {filteredWithholdings.length} comprobantes registrados en base de datos.
                    </p>
                    <button
                      onClick={() => setActiveTab('new_voucher')}
                      className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 shadow"
                    >
                      <Plus className="w-4 h-4" />
                      Emitir Comprobante
                    </button>
                  </div>

                  {filteredWithholdings.length === 0 ? (
                    <div className="text-center py-12 bg-slate-800/30 rounded-2xl border border-slate-800">
                      <Receipt className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                      <p className="text-slate-400 font-medium">No se encontraron comprobantes de retención ISLR</p>
                      <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                        Genera un nuevo comprobante o selecciona una factura de compras para calcular la retención SENIAT automáticamente.
                      </p>
                      <button
                        onClick={() => setActiveTab('new_voucher')}
                        className="mt-4 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-semibold inline-flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Generar Primer Comprobante
                      </button>
                    </div>
                  ) : (
                    <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/60">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-800">
                          <tr>
                            <th className="p-3">N° Comprobante</th>
                            <th className="p-3">Fecha</th>
                            <th className="p-3">Proveedor / Beneficiario</th>
                            <th className="p-3">Factura Afectada</th>
                            <th className="p-3 text-right">Base Imponible</th>
                            <th className="p-3 text-center">% ISLR</th>
                            <th className="p-3 text-right">Monto Retenido</th>
                            <th className="p-3 text-center">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {filteredWithholdings.map((w, idx) => (
                            <tr key={w.id || idx} className="hover:bg-slate-800/40 transition-colors">
                              <td className="p-3 font-mono font-bold text-amber-400">
                                {w.nroComprobante}
                              </td>
                              <td className="p-3 text-slate-300 font-mono">
                                {w.fechaEmision?.slice(0, 10)}
                              </td>
                              <td className="p-3">
                                <div className="font-semibold text-slate-200">{w.proveedorNombre}</div>
                                <div className="text-[11px] text-slate-400 font-mono">{w.proveedorRif}</div>
                              </td>
                              <td className="p-3 font-mono text-slate-300">
                                {w.nroFacturaAfectada}
                              </td>
                              <td className="p-3 text-right font-mono text-slate-300 font-semibold">
                                Bs. {Number(w.baseImponible).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="p-3 text-center">
                                <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-bold">
                                  {w.porcentajeRetencion}%
                                </span>
                              </td>
                              <td className="p-3 text-right font-mono font-bold text-rose-400">
                                Bs. {Number(w.montoRetenido).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="p-3 text-center">
                                <div className="inline-flex items-center gap-1.5">
                                  <button
                                    onClick={() => {
                                      setSelectedVoucher(w);
                                      generateSeniatRetentionVoucherPDF({
                                        type: 'ISLR',
                                        record: w,
                                        config,
                                        currentUser
                                      });
                                    }}
                                    className="btn btn-print-report text-xs flex items-center gap-1"
                                    title="Descargar Comprobante Individual de Retención ISLR (Decreto 1.808)"
                                  >
                                    <Printer className="w-3.5 h-3.5" color="#ffffff" />
                                    Comprobante PDF
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: NEW VOUCHER GENERATOR */}
          {activeTab === 'new_voucher' && (
            <div className="max-w-4xl mx-auto space-y-6">
              <form onSubmit={handleCreateVoucher} className="bg-slate-800/40 p-6 rounded-2xl border border-slate-800 space-y-6">
                <div>
                  <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-amber-400" />
                    Emisión de Comprobante de Retención de I.S.L.R.
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Calcula automáticamente los montos y retenciones según las tarifas del Decreto 1.808 del SENIAT.
                  </p>
                </div>

                {/* Quick Preload from Supplier Purchases / CxP */}
                {accountsPayable.length > 0 && (
                  <div className="bg-slate-800/80 p-4 rounded-xl border border-slate-700/60">
                    <label className="block text-xs font-semibold text-amber-300 mb-2">
                      💡 Cargar datos rápidamente desde Cuenta por Pagar / Factura de Compra:
                    </label>
                    <select
                      onChange={(e) => {
                        const doc = accountsPayable.find(d => d.id === e.target.value || d.nroDoc === e.target.value);
                        if (doc) {
                          handleSupplierSelect(doc.coProv || doc.co_prov);
                          setFormData(prev => ({
                            ...prev,
                            nroFacturaAfectada: doc.nroDoc || '',
                            nroControl: doc.nroControl || '',
                            baseImponible: (doc.montoNet || doc.monto_net || doc.saldo || 0).toString(),
                            montoTotalFactura: (doc.montoTotal || doc.monto_bru || 0).toString(),
                            tasaCambio: (doc.tasa || 36.5).toString()
                          }));
                        }
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                    >
                      <option value="">-- Seleccione una Factura / CxP de Proveedor --</option>
                      {accountsPayable.slice(0, 50).map(d => (
                        <option key={d.id} value={d.id}>
                          Doc #{d.nroDoc} | Prov: {d.provDes || d.coProv} | Saldo: {formatBs(d.saldo || 0)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Grid Inputs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Supplier Info */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-700 pb-1">
                      1. Sujeto Retenido (Proveedor)
                    </h4>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Buscar Proveedor / Beneficiario</label>
                      <select
                        value={formData.proveedorCod}
                        onChange={e => handleSupplierSelect(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:border-amber-500"
                      >
                        <option value="">-- Seleccione Proveedor Registrado --</option>
                        {suppliers.map(s => (
                          <option key={s.id || s.co_prov} value={s.co_prov || s.coProv}>
                            {s.prov_des || s.provDes} ({s.rif || s.co_prov})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Nombre / Razón Social *</label>
                      <input
                        type="text"
                        required
                        value={formData.proveedorNombre}
                        onChange={e => setFormData({ ...formData, proveedorNombre: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:border-amber-500"
                        placeholder="Ej. REPUESTOS VALENCIA C.A."
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">R.I.F. *</label>
                        <input
                          type="text"
                          required
                          value={formData.proveedorRif}
                          onChange={e => setFormData({ ...formData, proveedorRif: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:border-amber-500"
                          placeholder="J-12345678-9"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Código</label>
                        <input
                          type="text"
                          value={formData.proveedorCod}
                          onChange={e => setFormData({ ...formData, proveedorCod: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:border-amber-500"
                          placeholder="PROV001"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Document & Period Details */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-700 pb-1">
                      2. Factura Afectada & Período
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">N° Factura Afectada *</label>
                        <input
                          type="text"
                          required
                          value={formData.nroFacturaAfectada}
                          onChange={e => setFormData({ ...formData, nroFacturaAfectada: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:border-amber-500"
                          placeholder="FACT-009823"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">N° Control</label>
                        <input
                          type="text"
                          value={formData.nroControl}
                          onChange={e => setFormData({ ...formData, nroControl: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:border-amber-500"
                          placeholder="00-001234"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Fecha de Emisión</label>
                        <input
                          type="date"
                          value={formData.fechaEmision}
                          onChange={e => setFormData({ ...formData, fechaEmision: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:border-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-400 mb-1">Período Fiscal (AAAA-MM)</label>
                        <input
                          type="month"
                          value={formData.periodoFiscal}
                          onChange={e => setFormData({ ...formData, periodoFiscal: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:border-amber-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Concept & Rates Section */}
                <div className="space-y-3 pt-2">
                  <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider border-b border-slate-700 pb-1">
                    3. Concepto Oficial SENIAT y Base Imponible
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-xs text-slate-400 mb-1">Seleccionar Concepto SENIAT (77 Oficiales)</label>
                      <select
                        value={formData.codigoConceptoIslr}
                        onChange={e => handleConceptSelect(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:border-amber-500"
                      >
                        <option value="">-- Seleccione Concepto de Retención --</option>
                        {islrConcepts.map(c => (
                          <option key={c.id || c.coIslr} value={c.coIslr}>
                            [{c.coIslr}] {c.islrDes} ({c.numeral ? `Num. ${c.numeral}` : ''})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs text-slate-400 mb-1">% de Retención Legal</label>
                      <div className="flex gap-1.5">
                        {['1', '2', '3', '5'].map(pct => (
                          <button
                            type="button"
                            key={pct}
                            onClick={() => setFormData({ ...formData, porcentajeRetencion: pct })}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              formData.porcentajeRetencion === pct
                                ? 'bg-amber-500 text-slate-950 shadow-md'
                                : 'bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700'
                            }`}
                          >
                            {pct}%
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Base Imponible (Bs.) *</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={formData.baseImponible}
                        onChange={e => setFormData({ ...formData, baseImponible: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:border-amber-500 font-mono font-bold"
                        placeholder="0.00"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Sustraendo (Bs. si aplica)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.sustraendo}
                        onChange={e => setFormData({ ...formData, sustraendo: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:border-amber-500 font-mono"
                        placeholder="0.00"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Tasa de Cambio (Bs./$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={formData.tasaCambio}
                        onChange={e => setFormData({ ...formData, tasaCambio: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 focus:border-amber-500 font-mono"
                        placeholder="36.50"
                      />
                    </div>
                  </div>
                </div>

                {/* Calculation Summary Box */}
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex justify-between items-center">
                  <div>
                    <span className="text-xs text-amber-300 font-bold block">MONTO TOTAL RETENCIÓN APLICADA:</span>
                    <span className="text-[11px] text-slate-400">
                      Cálculo: (Base {formatBs(parseFloat(formData.baseImponible || 0))} × {formData.porcentajeRetencion}%) - Sustraendo
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-mono font-black text-amber-400 block">
                      {formatBs(calculatedWithholding)}
                    </span>
                    {parseFloat(formData.tasaCambio) > 0 && (
                      <span className="text-xs text-slate-400 font-mono">
                        ≈ {formatUsd(calculatedWithholding / parseFloat(formData.tasaCambio))} USD
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('withholdings')}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-2 shadow-lg disabled:opacity-50"
                  >
                    {saving ? 'Guardando Comprobante...' : 'Generar y Registrar Comprobante'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: PAYMENT ORDERS & BENEFICIARIES */}
          {activeTab === 'payment_orders' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800">
                  <span className="text-xs text-slate-400">Total Órdenes Emitidas</span>
                  <p className="text-xl font-bold text-slate-200 mt-1">{paymentOrders.length}</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800">
                  <span className="text-xs text-slate-400">Beneficiarios Registrados</span>
                  <p className="text-xl font-bold text-amber-400 mt-1">{beneficiaries.length}</p>
                </div>
                <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-800">
                  <span className="text-xs text-slate-400">Monto Total Retenido en Órdenes</span>
                  <p className="text-xl font-bold text-rose-400 mt-1 font-mono">
                    Bs. {paymentOrders.reduce((sum, o) => sum + (o.montoRet || 0), 0).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              {/* Payment Orders Table */}
              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/60">
                <div className="px-4 py-3 bg-slate-800/80 border-b border-slate-800 flex justify-between items-center">
                  <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Órdenes de Pago Supabase (ord_pago)
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    Sincronizado con Banco & CxP
                  </span>
                </div>
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-800/50 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="p-3">N° Orden</th>
                      <th className="p-3">Fecha</th>
                      <th className="p-3">Beneficiario</th>
                      <th className="p-3">Concepto / Descripción</th>
                      <th className="p-3 text-center">Forma Pago</th>
                      <th className="p-3 text-right">Monto Bruto</th>
                      <th className="p-3 text-right">Retenciones</th>
                      <th className="p-3 text-right">Monto Neto</th>
                      <th className="p-3 text-center">PDF</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredPaymentOrders.map((o, idx) => (
                      <tr key={o.id || idx} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3 font-mono font-bold text-amber-400">
                          #{o.ordNum}
                        </td>
                        <td className="p-3 font-mono text-slate-300">
                          {o.fecha?.slice(0, 10)}
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-slate-200">{o.benDes || o.codBen}</div>
                          <div className="text-[10px] text-slate-400 font-mono">Cód: {o.codBen}</div>
                        </td>
                        <td className="p-3 text-slate-300 max-w-xs truncate">
                          {o.descrip}
                        </td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-mono">
                            {o.formaPag} {o.cheNum ? `#${o.cheNum}` : ''}
                          </span>
                        </td>
                        <td className="p-3 text-right font-mono text-slate-300 font-semibold">
                          Bs. {Number(o.monto).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-right font-mono font-bold text-rose-400">
                          Bs. {Number(o.montoRet).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-right font-mono font-black text-emerald-400">
                          Bs. {(Number(o.monto) - Number(o.montoRet)).toLocaleString('es-VE', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => generatePaymentOrderPDF({ paymentOrder: o, config, currentUser })}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-blue-700 text-amber-300 hover:text-white border border-slate-700 text-[11px] font-semibold inline-flex items-center gap-1"
                            title="Imprimir Orden de Pago oficial Carta PDF"
                          >
                            <Printer className="w-3 h-3" /> OP PDF
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: ISLR CONCEPTS DIRECTORY (77 OFFICIAL CONCEPTS) */}
          {activeTab === 'concepts' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-slate-800/40 p-3 rounded-xl border border-slate-800">
                <p className="text-xs text-slate-300">
                  Catálogo Oficial del SENIAT según el Reglamento de Retenciones de I.S.L.R. (Decreto 1.808)
                </p>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-semibold border border-amber-500/20">
                  {filteredConcepts.length} Conceptos Activos
                </span>
              </div>

              <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-900/60">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-800/80 text-slate-400 font-semibold border-b border-slate-800">
                    <tr>
                      <th className="p-3">Cód.</th>
                      <th className="p-3">Descripción Oficial</th>
                      <th className="p-3">Base Legal / Actividad Gravada</th>
                      <th className="p-3 text-center">Numeral</th>
                      <th className="p-3 text-center">Literal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredConcepts.map((c, idx) => (
                      <tr key={c.id || idx} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-3 font-mono font-bold text-amber-400">
                          {c.coIslr}
                        </td>
                        <td className="p-3 font-semibold text-slate-200">
                          {c.islrDes}
                        </td>
                        <td className="p-3 text-slate-400 text-[11px] max-w-md">
                          {c.islrDes2}
                        </td>
                        <td className="p-3 text-center font-mono text-slate-300">
                          {c.numeral || '-'}
                        </td>
                        <td className="p-3 text-center font-mono text-slate-300">
                          {c.literal || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
