import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  FilePlus2,
  Calendar,
  DollarSign,
  TrendingUp,
  Building2,
  User,
  Phone,
  MapPin,
  FileText,
  ShieldCheck,
  CheckCircle2,
  RotateCcw,
  Search,
  Check,
  AlertCircle,
  Hash,
  Percent,
  Clock,
  Layers,
  ArrowRight
} from 'lucide-react';
import { formatUsd, formatBs } from '../services/formatService';
import { useNotification } from '../context/NotificationContext';
import { REAL_PROFIT_SELLERS } from '../data/supabaseRealData';

const round2 = (num) => Math.round((Number(num || 0) + Number.EPSILON) * 100) / 100;

const normalizeIsoDateOnly = (d) => {
  if (!d) return '';
  if (typeof d === 'string') {
    const match = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  }
  const dateObj = d instanceof Date ? d : new Date(d);
  if (isNaN(dateObj.getTime())) return '';
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toIsoDate = normalizeIsoDateOnly;

const addDaysToIso = (isoStr, days) => {
  const clean = normalizeIsoDateOnly(isoStr);
  if (!clean) return '';
  const [y, m, d] = clean.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d, 12, 0, 0);
  dateObj.setDate(dateObj.getDate() + Number(days || 0));
  return normalizeIsoDateOnly(dateObj);
};

const diffDaysIso = (startIso, endIso) => {
  const c1 = normalizeIsoDateOnly(startIso);
  const c2 = normalizeIsoDateOnly(endIso);
  if (!c1 || !c2) return 0;
  const [y1, m1, day1] = c1.split('-').map(Number);
  const [y2, m2, day2] = c2.split('-').map(Number);
  const date1 = new Date(y1, m1 - 1, day1, 12, 0, 0);
  const date2 = new Date(y2, m2 - 1, day2, 12, 0, 0);
  return Math.round((date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24));
};

export default function CxcInvoiceCreationModal({
  isOpen = false,
  onClose,
  onSaveDocument,
  initialData = null,
  clients = [],
  sellers = [],
  config = {},
  suggestedCorrelativo = '000001'
}) {
  const notify = useNotification();

  // Tasa actual de configuración
  const tasaBcvDefault = Number(config?.tasaDolar) || 899.27;

  // Estado del formulario
  const [tipoDoc, setTipoDoc] = useState('FACTURA'); // 'FACTURA' | 'NOTA_ENTREGA'
  const [factNum, setFactNum] = useState('');
  const [numeroControl, setNumeroControl] = useState('');

  // Fechas (por defecto fecha de noviembre para cuadre contable)
  const [fechaEmision, setFechaEmision] = useState('2026-11-15');
  const [diasCredito, setDiasCredito] = useState(15);
  const [fechaVencimiento, setFechaVencimiento] = useState('2026-11-30');

  // Datos del Cliente (100% editables)
  const [clienteSearch, setClienteSearch] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [clienteCodigo, setClienteCodigo] = useState('');
  const [clienteRif, setClienteRif] = useState('');
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteDireccion, setClienteDireccion] = useState('');
  const [clienteTelefono, setClienteTelefono] = useState('');

  // Vendedor
  const [vendedorId, setVendedorId] = useState('FS');
  const [vendedorNombre, setVendedorNombre] = useState('Freddy Sepulveda');

  // Montos y Divisas
  const [precioDivisas, setPrecioDivisas] = useState('100.00'); // Subtotal / Base en USD
  const [isExento, setIsExento] = useState(false);
  const [ivaUsd, setIvaUsd] = useState('16.00');
  const [totalUsd, setTotalUsd] = useState('116.00');
  const [tasa, setTasa] = useState(String(tasaBcvDefault));

  // Cobranzas y CxC
  const [abonosUsd, setAbonosUsd] = useState('0.00');
  const [observaciones, setObservaciones] = useState('Cuadre de facturas noviembre 2026');

  // Opciones de flujo
  const [keepOpenAfterSave, setKeepOpenAfterSave] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Inicializar o sugerir correlativo al abrir
  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        const nextTipo = initialData.tipoDoc || 'FACTURA';
        setTipoDoc(nextTipo);
        setFactNum(initialData.factNum || initialData.factura || initialData.numeroDoc || '');
        setNumeroControl(initialData.numeroControl || '');
        const emis = normalizeIsoDateOnly(initialData.fechaEmision || initialData.fecha) || '2026-11-15';
        const rawDc = Number(initialData.diasCredito ?? initialData.dias_credito);
        const dc = rawDc > 0 ? rawDc : 15;
        const rawVenc = normalizeIsoDateOnly(initialData.fechaVencimiento || initialData.fecha_vencimiento);
        const venc = (rawVenc && rawVenc !== emis) ? rawVenc : addDaysToIso(emis, dc);
        const calculatedDc = diffDaysIso(emis, venc);
        setFechaEmision(emis);
        setDiasCredito(calculatedDc > 0 ? calculatedDc : dc);
        setFechaVencimiento(venc);

        setClienteCodigo(initialData.clienteId || initialData.cliente_id || '');
        setClienteRif(initialData.clienteRif || initialData.cliente_rif || initialData.rif || '');
        setClienteNombre(initialData.clienteNombre || initialData.cliente || '');
        setClienteDireccion(initialData.clienteDireccion || initialData.direccion || '');
        setClienteTelefono(initialData.clienteTelefono || initialData.telefono || '');
        if (initialData.vendedorId || initialData.vendedor) {
          handleSellerSelect(initialData.vendedorId || initialData.vendedor);
        }
        const neto = Number(initialData.totNetoUsd ?? initialData.totalUsd ?? 100);
        const bruto = Number(initialData.totBrutoUsd ?? initialData.subtotalUsd ?? neto);
        setPrecioDivisas(bruto.toFixed(2));
        setIsExento(Boolean(initialData.isExento || nextTipo === 'NOTA_ENTREGA'));
        setIvaUsd(Number(initialData.ivaUsd ?? 0).toFixed(2));
        setTotalUsd(neto.toFixed(2));
        setAbonosUsd(Number(initialData.abonosUsd ?? 0).toFixed(2));
        setObservaciones(initialData.observaciones || '');
      } else {
        if (!factNum) {
          if (tipoDoc === 'NOTA_ENTREGA') {
            setFactNum(`NE-${suggestedCorrelativo || '000001'}`);
          } else {
            setFactNum(suggestedCorrelativo || '000001');
            setNumeroControl(`00-${suggestedCorrelativo || '000001'}`);
          }
        }
      }
    }
  }, [isOpen, initialData, suggestedCorrelativo, tipoDoc]);

  // Recalcular montos al cambiar precioDivisas, isExento, tipoDoc o tasa
  const handlePrecioChange = (val) => {
    const rawVal = val === '' ? '' : val;
    setPrecioDivisas(rawVal);
    const base = Math.max(0, Number(rawVal || 0));

    if (tipoDoc === 'NOTA_ENTREGA' || isExento) {
      setIvaUsd('0.00');
      setTotalUsd(base.toFixed(2));
    } else {
      const iva = round2(base * 0.16);
      setIvaUsd(iva.toFixed(2));
      setTotalUsd(round2(base + iva).toFixed(2));
    }
  };

  const handleExentoToggle = (exentoValue) => {
    setIsExento(exentoValue);
    const base = Math.max(0, Number(precioDivisas || 0));
    if (exentoValue || tipoDoc === 'NOTA_ENTREGA') {
      setIvaUsd('0.00');
      setTotalUsd(base.toFixed(2));
    } else {
      const iva = round2(base * 0.16);
      setIvaUsd(iva.toFixed(2));
      setTotalUsd(round2(base + iva).toFixed(2));
    }
  };

  const handleTipoDocChange = (newTipo) => {
    setTipoDoc(newTipo);
    const currentNum = factNum.replace(/^NE-/i, '').replace(/^FAC-/i, '');
    if (newTipo === 'NOTA_ENTREGA') {
      setFactNum(currentNum ? `NE-${currentNum}` : `NE-${suggestedCorrelativo || '000001'}`);
      setIsExento(true);
      const base = Math.max(0, Number(precioDivisas || 0));
      setIvaUsd('0.00');
      setTotalUsd(base.toFixed(2));
    } else {
      setFactNum(currentNum || suggestedCorrelativo || '000001');
      setNumeroControl(`00-${currentNum || suggestedCorrelativo || '000001'}`);
      setIsExento(false);
      const base = Math.max(0, Number(precioDivisas || 0));
      const iva = round2(base * 0.16);
      setIvaUsd(iva.toFixed(2));
      setTotalUsd(round2(base + iva).toFixed(2));
    }
  };

  const handleTotalUsdChange = (val) => {
    const rawVal = val === '' ? '' : val;
    setTotalUsd(rawVal);
    const total = Math.max(0, Number(rawVal || 0));
    if (tipoDoc === 'NOTA_ENTREGA' || isExento) {
      setPrecioDivisas(total.toFixed(2));
      setIvaUsd('0.00');
    } else {
      const base = round2(total / 1.16);
      const iva = round2(total - base);
      setPrecioDivisas(base.toFixed(2));
      setIvaUsd(iva.toFixed(2));
    }
  };

  // Manejo de Fechas y Días de Crédito
  const handleFechaEmisionChange = (val) => {
    setFechaEmision(val);
    if (val) {
      const dc = Number(diasCredito) > 0 ? Number(diasCredito) : 15;
      setDiasCredito(dc);
      setFechaVencimiento(addDaysToIso(val, dc));
    }
  };

  const handleDiasCreditoChange = (val) => {
    if (val === '') {
      setDiasCredito('');
      return;
    }
    const dias = Math.max(0, parseInt(val, 10) || 0);
    setDiasCredito(dias);
    if (fechaEmision) {
      setFechaVencimiento(addDaysToIso(fechaEmision, dias));
    }
  };

  const handleFechaVencimientoChange = (val) => {
    setFechaVencimiento(val);
    if (fechaEmision && val) {
      const calculatedDias = diffDaysIso(fechaEmision, val);
      setDiasCredito(Math.max(0, calculatedDias));
    }
  };

  // Cálculos reactivos en Bolívares y Saldos
  const tasaNum = Math.max(0.0001, Number(tasa) || tasaBcvDefault);
  const subtotalNum = Math.max(0, Number(precioDivisas) || 0);
  const ivaNum = Math.max(0, Number(ivaUsd) || 0);
  const totalNum = Math.max(0, Number(totalUsd) || 0);
  const abonosNum = Math.max(0, Number(abonosUsd) || 0);
  const saldoNum = Math.max(0, round2(totalNum - abonosNum));

  const subtotalBs = round2(subtotalNum * tasaNum);
  const ivaBs = round2(ivaNum * tasaNum);
  const totalBs = round2(totalNum * tasaNum);
  const saldoBs = round2(saldoNum * tasaNum);

  // Vendedores disponibles
  const sellersList = useMemo(() => {
    if (Array.isArray(sellers) && sellers.length > 0) return sellers;
    return REAL_PROFIT_SELLERS || [
      { coVen: 'FS', venDes: 'Freddy Sepulveda' },
      { coVen: 'VV', venDes: 'Victor Vargas' },
      { coVen: 'YC', venDes: 'Yosmar Chirinos' },
      { coVen: 'CB', venDes: 'Carlos Blanco' },
      { coVen: 'OF', venDes: 'Venta Directa Oficina' }
    ];
  }, [sellers]);

  const handleSellerSelect = (coVen) => {
    const sObj = sellersList.find(s => (s.coVen || s.co_ven || s.id) === coVen);
    setVendedorId(coVen);
    if (sObj) {
      setVendedorNombre(sObj.venDes || sObj.ven_des || sObj.nombre || coVen);
    }
  };

  // Búsqueda y filtrado de Clientes
  const filteredClients = useMemo(() => {
    if (!clienteSearch || clienteSearch.trim().length < 2) return [];
    const q = clienteSearch.toLowerCase().trim();
    return (clients || []).filter(c => {
      const cod = String(c.codigo || c.co_cli || c.id || '').toLowerCase();
      const rif = String(c.rif || '').toLowerCase();
      const nom = String(c.nombre || c.razonSocial || c.cli_des || '').toLowerCase();
      return cod.includes(q) || rif.includes(q) || nom.includes(q);
    }).slice(0, 10);
  }, [clients, clienteSearch]);

  const handleSelectClient = (c) => {
    if (!c) return;
    setClienteCodigo(c.codigo || c.co_cli || c.id || '');
    setClienteRif(c.rif || c.co_cli || '');
    setClienteNombre(c.nombre || c.razonSocial || c.cli_des || '');
    setClienteDireccion(c.direccion2 || c.direccion || c.direc1 || c.dir || '');
    setClienteTelefono(c.telefonos || c.telefono || c.tel || '');

    // Vendedor habitual
    const sellerCode = c.vendedorAsignado || c.coVen || c.co_ven || '';
    if (sellerCode) {
      handleSellerSelect(sellerCode);
    }

    // Días de crédito: Si el cliente tiene días de crédito mayores a 0, utilizarlos.
    // Si tiene 0 o no tiene configurado, mantener los días de crédito actuales (o 15 por defecto).
    const rawDc = Number(c.diasCredito ?? c.dias_credito);
    const currentDc = Number(diasCredito);
    const dc = (rawDc && rawDc > 0) ? rawDc : (currentDc > 0 ? currentDc : 15);
    setDiasCredito(dc);
    if (fechaEmision) {
      setFechaVencimiento(addDaysToIso(fechaEmision, dc));
    }

    setClienteSearch('');
    setShowClientDropdown(false);
  };

  // Enviar / Guardar Documento
  const handleFormSubmit = async (e) => {
    e.preventDefault();

    const cleanNum = String(factNum || '').trim();
    if (!cleanNum) {
      notify.warning('Por favor ingrese el número de factura o nota de entrega.');
      return;
    }
    if (!clienteNombre.trim()) {
      notify.warning('Por favor ingrese el nombre o razón social del cliente.');
      return;
    }
    if (totalNum <= 0) {
      notify.warning('El monto total de la factura debe ser mayor a 0.');
      return;
    }
    if (tasaNum <= 0) {
      notify.warning('La tasa de cambio en bolívares debe ser mayor a 0.');
      return;
    }

    setIsSaving(true);

    try {
      const isNotaEntrega = tipoDoc === 'NOTA_ENTREGA';
      const docId = isNotaEntrega
        ? (cleanNum.toUpperCase().startsWith('NE-') ? cleanNum : `NE-${cleanNum}`)
        : (cleanNum.toUpperCase().startsWith('FAC-') ? cleanNum : `FAC-${cleanNum}`);

      // Garantizar cálculo consistente de fecha de vencimiento y días de crédito
      let finalDiasCredito = diasCredito === '' ? 15 : Math.max(0, Number(diasCredito || 0));
      let finalFechaVenc = fechaVencimiento;

      if (!finalFechaVenc || (finalFechaVenc === fechaEmision && finalDiasCredito <= 0)) {
        finalDiasCredito = finalDiasCredito > 0 ? finalDiasCredito : 15;
        finalFechaVenc = addDaysToIso(fechaEmision, finalDiasCredito);
      } else if (finalFechaVenc && fechaEmision && finalDiasCredito <= 0) {
        const diff = diffDaysIso(fechaEmision, finalFechaVenc);
        finalDiasCredito = diff > 0 ? diff : 15;
        if (diff <= 0) {
          finalFechaVenc = addDaysToIso(fechaEmision, finalDiasCredito);
        }
      }

      const payload = {
        id: docId,
        factNum: cleanNum,
        originalFactNum: cleanNum,
        numeroControl: numeroControl || `00-${cleanNum.replace(/\D/g, '').padStart(6, '0')}`,
        tipoDoc,
        fechaEmision: fechaEmision,
        fec_emis: fechaEmision,
        fechaVencimiento: finalFechaVenc,
        fec_venc: finalFechaVenc,
        diasCredito: finalDiasCredito,
        dias_credito: finalDiasCredito,
        clienteId: clienteCodigo || `CLI-${cleanNum}`,
        cliente_id: clienteCodigo || `CLI-${cleanNum}`,
        clienteNombre: clienteNombre.trim(),
        cliente_nombre: clienteNombre.trim(),
        clienteRif: (clienteRif || 'J-00000000-0').trim().toUpperCase(),
        cliente_rif: (clienteRif || 'J-00000000-0').trim().toUpperCase(),
        clienteDireccion: clienteDireccion.trim(),
        cliente_direccion: clienteDireccion.trim(),
        clienteTelefono: clienteTelefono.trim(),
        cliente_telefono: clienteTelefono.trim(),
        vendedorId: vendedorId || 'FS',
        vendedor_id: vendedorId || 'FS',
        vendedorNombre: vendedorNombre || '',
        vendedor_nombre: vendedorNombre || '',
        totBrutoUsd: subtotalNum,
        tot_bruto_usd: subtotalNum,
        totBrutoBs: subtotalBs,
        tot_bruto_bs: subtotalBs,
        isExento: isNotaEntrega || isExento,
        ivaUsd: isNotaEntrega ? 0 : ivaNum,
        iva_usd: isNotaEntrega ? 0 : ivaNum,
        ivaBs: isNotaEntrega ? 0 : ivaBs,
        iva_bs: isNotaEntrega ? 0 : ivaBs,
        totNetoUsd: totalNum,
        tot_neto_usd: totalNum,
        totNetoBs: totalBs,
        tot_neto_bs: totalBs,
        abonosUsd: abonosNum,
        abonos_usd: abonosNum,
        abonosBs: round2(abonosNum * tasaNum),
        abonos_bs: round2(abonosNum * tasaNum),
        saldoUsd: saldoNum,
        saldo_usd: saldoNum,
        saldoBs: saldoBs,
        saldo_bs: saldoBs,
        tasa: tasaNum,
        tasaDolar: tasaNum,
        status: saldoNum <= 0.01 ? 'COBRADA' : 'PENDIENTE',
        estado: saldoNum <= 0.01 ? 'PAGADO' : 'PENDIENTE',
        formaPago: finalDiasCredito > 0 ? '03' : '01',
        condicionPago: finalDiasCredito > 0 ? 'CREDITO' : 'CONTADO',
        observaciones: observaciones || 'Cuadre facturas noviembre 2026',
        items: (Array.isArray(initialData?.items) && initialData.items.length > 0)
          ? initialData.items
          : [
              {
                id: `ITEM-${cleanNum}`,
                codigo: 'LUB-MANUAL',
                nombre: isNotaEntrega ? 'Despacho Nota de Entrega (Manual/Histórico)' : 'Venta Factura Fiscal (Manual/Histórica)',
                cantidad: 1,
                unidad: 'Unid',
                precio: subtotalNum,
                precioUsd: subtotalNum,
                subtotal: subtotalNum,
                subtotalUsd: subtotalNum,
                totalUsd: totalNum,
                totalBs: totalBs
              }
            ],
        _customCreated: true
      };

      if (onSaveDocument) {
        await onSaveDocument(payload);
      }

      notify.success(
        `¡${isNotaEntrega ? 'Nota de Entrega' : 'Factura Fiscal'} #${cleanNum} guardada y subida a Cobranzas (CxC) exitosamente!`
      );

      if (keepOpenAfterSave) {
        // Sugerir siguiente correlativo y limpiar solo datos del documento
        const nextDigits = (parseInt(cleanNum.replace(/\D/g, ''), 10) || 0) + 1;
        const formattedNext = String(nextDigits).padStart(6, '0');
        if (isNotaEntrega) {
          setFactNum(`NE-${formattedNext}`);
        } else {
          setFactNum(formattedNext);
          setNumeroControl(`00-${formattedNext}`);
        }
        setClienteNombre('');
        setClienteCodigo('');
        setClienteRif('');
        setClienteDireccion('');
        setClienteTelefono('');
        const effectiveDc = finalDiasCredito > 0 ? finalDiasCredito : 15;
        setDiasCredito(effectiveDc);
        if (fechaEmision) {
          setFechaVencimiento(addDaysToIso(fechaEmision, effectiveDc));
        }
      } else {
        if (onClose) onClose();
      }
    } catch (err) {
      console.error('Error guardando documento a cobranzas:', err);
      notify.error(`Error guardando documento: ${err.message || 'Error desconocido'}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(3, 7, 18, 0.88)',
        backdropFilter: 'blur(8px)',
        zIndex: 10050,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <div
        style={{
          background: 'linear-gradient(180deg, #0e172a 0%, #090e1a 100%)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '18px',
          width: '100%',
          maxWidth: '960px',
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.9), 0 0 30px rgba(59, 130, 246, 0.15)',
          overflow: 'hidden'
        }}
      >
        {/* ENCABEZADO */}
        <div
          style={{
            padding: '1.25rem 1.75rem',
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'linear-gradient(90deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '12px',
                background: tipoDoc === 'NOTA_ENTREGA'
                  ? 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'
                  : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
              }}
            >
              <FilePlus2 size={24} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.02em' }}>
                  Cargar Factura o Nota de Entrega a Cobranzas (CxC)
                </h3>
                <span
                  style={{
                    padding: '2px 8px',
                    borderRadius: '6px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    background: 'rgba(16, 185, 129, 0.18)',
                    color: '#34d399',
                    border: '1px solid rgba(16, 185, 129, 0.3)'
                  }}
                >
                  Cuadre Noviembre
                </span>
              </div>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.80rem', color: '#94a3b8' }}>
                Cree documentos con requerimientos 100% editables y súbalos en tiempo real a Cuentas por Cobrar y Ventas.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '10px',
              padding: '8px',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
            title="Cerrar modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* SELECTOR DE TIPO DE DOCUMENTO */}
        <div
          style={{
            padding: '0.85rem 1.75rem',
            background: 'rgba(15, 23, 42, 0.6)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={() => handleTipoDocChange('FACTURA')}
              style={{
                padding: '8px 18px',
                borderRadius: '10px',
                border: tipoDoc === 'FACTURA' ? '2px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.1)',
                background: tipoDoc === 'FACTURA' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                color: tipoDoc === 'FACTURA' ? '#60a5fa' : '#94a3b8',
                fontWeight: 800,
                fontSize: '0.86rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.15s'
              }}
            >
              <FileText size={16} />
              <span>Factura Fiscal (SENIAT)</span>
              {tipoDoc === 'FACTURA' && <Check size={14} color="#60a5fa" />}
            </button>

            <button
              type="button"
              onClick={() => handleTipoDocChange('NOTA_ENTREGA')}
              style={{
                padding: '8px 18px',
                borderRadius: '10px',
                border: tipoDoc === 'NOTA_ENTREGA' ? '2px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.1)',
                background: tipoDoc === 'NOTA_ENTREGA' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.03)',
                color: tipoDoc === 'NOTA_ENTREGA' ? '#fbbf24' : '#94a3b8',
                fontWeight: 800,
                fontSize: '0.86rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.15s'
              }}
            >
              <ShieldCheck size={16} />
              <span>Nota de Entrega (Sin IVA / Alm 02)</span>
              {tipoDoc === 'NOTA_ENTREGA' && <Check size={14} color="#fbbf24" />}
            </button>
          </div>

          {/* Accesos Rápidos de Fecha para Noviembre */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.74rem', color: '#64748b', fontWeight: 600 }}>Cortes Noviembre:</span>
            {[
              { label: '01 Nov', date: '2026-11-01' },
              { label: '15 Nov', date: '2026-11-15' },
              { label: '30 Nov', date: '2026-11-30' },
              { label: 'Hoy', date: toIsoDate(new Date()) }
            ].map(preset => (
              <button
                key={preset.label}
                type="button"
                onClick={() => handleFechaEmisionChange(preset.date)}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: fechaEmision === preset.date ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.1)',
                  background: fechaEmision === preset.date ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.04)',
                  color: fechaEmision === preset.date ? '#38bdf8' : '#94a3b8',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* CUERPO DEL FORMULARIO CON SCROLL */}
        <form
          onSubmit={handleFormSubmit}
          style={{
            padding: '1.5rem 1.75rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
            flex: 1
          }}
        >
          {/* SECCIÓN 1: DATOS DEL DOCUMENTO & FECHAS */}
          <div
            style={{
              background: 'rgba(30, 41, 59, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              borderRadius: '14px',
              padding: '1.15rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '0.85rem' }}>
              <Hash size={16} color="#60a5fa" />
              <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: '#f1f5f9', textTransform: 'uppercase' }}>
                1. Identificación del Documento & Período
              </h4>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
              {/* N° Documento */}
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                  {tipoDoc === 'NOTA_ENTREGA' ? 'N° Nota de Entrega *' : 'N° Factura Fiscal *'}
                </label>
                <input
                  type="text"
                  required
                  value={factNum}
                  onChange={(e) => {
                    setFactNum(e.target.value);
                    if (tipoDoc === 'FACTURA') {
                      setNumeroControl(`00-${e.target.value.replace(/\D/g, '').padStart(6, '0')}`);
                    }
                  }}
                  placeholder={tipoDoc === 'NOTA_ENTREGA' ? 'Ej. NE-000105' : 'Ej. 000214'}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(59, 130, 246, 0.4)',
                    background: 'rgba(15, 23, 42, 0.8)',
                    color: '#60a5fa',
                    fontWeight: 800,
                    fontFamily: 'monospace',
                    fontSize: '0.95rem'
                  }}
                />
              </div>

              {/* N° Control (solo fiscal) */}
              {tipoDoc === 'FACTURA' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                    N° Control SENIAT
                  </label>
                  <input
                    type="text"
                    value={numeroControl}
                    onChange={(e) => setNumeroControl(e.target.value)}
                    placeholder="Ej. 00-000214"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      background: 'rgba(15, 23, 42, 0.8)',
                      color: '#e2e8f0',
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      fontSize: '0.90rem'
                    }}
                  />
                </div>
              )}

              {/* Fecha Emisión */}
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Fecha Emisión *
                </label>
                <input
                  type="date"
                  required
                  value={fechaEmision}
                  onChange={(e) => handleFechaEmisionChange(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(56, 189, 248, 0.4)',
                    background: 'rgba(15, 23, 42, 0.8)',
                    color: '#f8fafc',
                    fontWeight: 700,
                    fontSize: '0.88rem'
                  }}
                />
              </div>

              {/* Días de Crédito */}
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Días de Crédito
                </label>
                <input
                  type="number"
                  min="0"
                  max="180"
                  value={diasCredito}
                  onChange={(e) => handleDiasCreditoChange(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    background: 'rgba(15, 23, 42, 0.8)',
                    color: '#f8fafc',
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    fontSize: '0.90rem'
                  }}
                />
              </div>

              {/* Fecha Vencimiento */}
              <div>
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.74rem', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', marginBottom: '4px' }}>
                  <span>Fecha Vencimiento *</span>
                  <span style={{ color: '#38bdf8', fontWeight: 600, fontSize: '0.70rem', textTransform: 'none' }}>
                    ({diasCredito === '' ? 0 : Number(diasCredito || 0)} días crédito)
                  </span>
                </label>
                <input
                  type="date"
                  required
                  value={fechaVencimiento}
                  onChange={(e) => handleFechaVencimientoChange(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(245, 158, 11, 0.4)',
                    background: 'rgba(15, 23, 42, 0.8)',
                    color: '#fbbf24',
                    fontWeight: 700,
                    fontSize: '0.88rem'
                  }}
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: DATOS DEL CLIENTE (AUTOCOMPLETADO + 100% EDITABLES) */}
          <div
            style={{
              background: 'rgba(30, 41, 59, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              borderRadius: '14px',
              padding: '1.15rem',
              position: 'relative'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <User size={16} color="#34d399" />
                <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: '#f1f5f9', textTransform: 'uppercase' }}>
                  2. Datos del Cliente & Despacho (100% Editables)
                </h4>
              </div>
              <span style={{ fontSize: '0.72rem', color: '#64748b' }}>
                Puede seleccionar un cliente registrado o escribir uno nuevo manualmente
              </span>
            </div>

            {/* Buscador Rápido de Cliente */}
            <div style={{ position: 'relative', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                <Search size={15} color="#94a3b8" style={{ position: 'absolute', left: '12px' }} />
                <input
                  type="text"
                  value={clienteSearch}
                  onChange={(e) => {
                    setClienteSearch(e.target.value);
                    setShowClientDropdown(true);
                  }}
                  onFocus={() => setShowClientDropdown(true)}
                  placeholder="Buscar cliente registrado por nombre, código o RIF (632 clientes en catálogo)..."
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 36px',
                    borderRadius: '8px',
                    border: '1px solid rgba(52, 211, 153, 0.3)',
                    background: 'rgba(15, 23, 42, 0.9)',
                    color: '#e2e8f0',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              {/* Dropdown de resultados */}
              {showClientDropdown && filteredClients.length > 0 && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    marginTop: '4px',
                    background: '#0f172a',
                    border: '1px solid rgba(52, 211, 153, 0.4)',
                    borderRadius: '10px',
                    maxHeight: '220px',
                    overflowY: 'auto',
                    zIndex: 100,
                    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.6)'
                  }}
                >
                  {filteredClients.map((c) => (
                    <div
                      key={c.id || c.codigo || c.rif}
                      onClick={() => handleSelectClient(c)}
                      style={{
                        padding: '8px 12px',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'background 0.15s'
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(52, 211, 153, 0.15)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.84rem', color: '#f8fafc' }}>
                          {c.nombre || c.razonSocial || c.cli_des}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontFamily: 'monospace' }}>
                          Código: {c.codigo || c.co_cli || c.id} | RIF: {c.rif || 'N/A'}
                        </div>
                      </div>
                      <span style={{ fontSize: '0.70rem', color: '#34d399', fontWeight: 700 }}>
                        Seleccionar →
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Campos individuales de cliente 100% editables */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem' }}>
              {/* Código */}
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Código Cliente
                </label>
                <input
                  type="text"
                  value={clienteCodigo}
                  onChange={(e) => setClienteCodigo(e.target.value)}
                  placeholder="Ej. CLI-001"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    background: 'rgba(15, 23, 42, 0.8)',
                    color: '#e2e8f0',
                    fontFamily: 'monospace',
                    fontSize: '0.86rem'
                  }}
                />
              </div>

              {/* RIF */}
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                  RIF del Cliente *
                </label>
                <input
                  type="text"
                  value={clienteRif}
                  onChange={(e) => setClienteRif(e.target.value)}
                  placeholder="Ej. J-12345678-9"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    background: 'rgba(15, 23, 42, 0.8)',
                    color: '#e2e8f0',
                    fontFamily: 'monospace',
                    fontSize: '0.86rem',
                    textTransform: 'uppercase'
                  }}
                />
              </div>

              {/* Nombre / Razón Social */}
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Nombre / Razón Social del Cliente *
                </label>
                <input
                  type="text"
                  required
                  value={clienteNombre}
                  onChange={(e) => setClienteNombre(e.target.value)}
                  placeholder="Ej. DISTRIBUIDORA MOTOREX CARABOBO C.A."
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    background: 'rgba(15, 23, 42, 0.8)',
                    color: '#f8fafc',
                    fontWeight: 700,
                    fontSize: '0.88rem'
                  }}
                />
              </div>

              {/* Dirección Completa */}
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Dirección Completa de Despacho / Fiscal
                </label>
                <textarea
                  rows={2}
                  value={clienteDireccion}
                  onChange={(e) => setClienteDireccion(e.target.value)}
                  placeholder="Ej. Av. Principal Zona Industrial Carabobo, Galpón N° 4, Valencia, Edo. Carabobo"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    background: 'rgba(15, 23, 42, 0.8)',
                    color: '#e2e8f0',
                    fontSize: '0.84rem',
                    resize: 'none'
                  }}
                />
              </div>

              {/* Teléfono */}
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Teléfono de Contacto
                </label>
                <input
                  type="text"
                  value={clienteTelefono}
                  onChange={(e) => setClienteTelefono(e.target.value)}
                  placeholder="Ej. 0414-1234567 / 0241-8765432"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    background: 'rgba(15, 23, 42, 0.8)',
                    color: '#e2e8f0',
                    fontSize: '0.86rem'
                  }}
                />
              </div>

              {/* Asesor Comercial / Vendedor */}
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Asesor Comercial / Vendedor
                </label>
                <select
                  value={vendedorId}
                  onChange={(e) => handleSellerSelect(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    background: 'rgba(15, 23, 42, 0.8)',
                    color: '#f8fafc',
                    fontWeight: 700,
                    fontSize: '0.86rem'
                  }}
                >
                  {sellersList.map(s => {
                    const code = s.coVen || s.co_ven || s.id;
                    const desc = s.venDes || s.ven_des || s.nombre || code;
                    return (
                      <option key={code} value={code}>
                        {code} - {desc}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
          </div>

          {/* SECCIÓN 3: PRECIOS, DIVISAS ($ USD), TASA (Bs.) Y EXENTO */}
          <div
            style={{
              background: 'rgba(30, 41, 59, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              borderRadius: '14px',
              padding: '1.15rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <DollarSign size={16} color="#f59e0b" />
                <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: '#f1f5f9', textTransform: 'uppercase' }}>
                  3. Importes en Divisas ($ USD), Tasa en Bolívares y Exención
                </h4>
              </div>

              {/* Switch Exento */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: tipoDoc === 'NOTA_ENTREGA' ? 'not-allowed' : 'pointer',
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: isExento ? '#34d399' : '#94a3b8'
                  }}
                >
                  <input
                    type="checkbox"
                    disabled={tipoDoc === 'NOTA_ENTREGA'}
                    checked={isExento || tipoDoc === 'NOTA_ENTREGA'}
                    onChange={(e) => handleExentoToggle(e.target.checked)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <span>¿Operación Exenta de IVA (0%)?</span>
                </label>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              {/* Precio / Base en Divisas */}
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Precio Base ($ USD) *
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '10px', top: '8px', color: '#94a3b8', fontWeight: 700 }}>$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={precioDivisas}
                    onChange={(e) => handlePrecioChange(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 24px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      background: 'rgba(15, 23, 42, 0.8)',
                      color: '#f8fafc',
                      fontWeight: 800,
                      fontFamily: 'monospace',
                      fontSize: '0.95rem'
                    }}
                  />
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '3px' }}>
                  Bs. {formatBs(subtotalBs)}
                </div>
              </div>

              {/* IVA ($ USD) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: isExento ? '#34d399' : '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                  IVA 16% ($ USD)
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '10px', top: '8px', color: '#94a3b8', fontWeight: 700 }}>$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    disabled={isExento || tipoDoc === 'NOTA_ENTREGA'}
                    value={ivaUsd}
                    onChange={(e) => {
                      setIvaUsd(e.target.value);
                      const iva = Number(e.target.value || 0);
                      setTotalUsd(round2(subtotalNum + iva).toFixed(2));
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 24px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      background: (isExento || tipoDoc === 'NOTA_ENTREGA') ? 'rgba(52, 211, 153, 0.08)' : 'rgba(15, 23, 42, 0.8)',
                      color: (isExento || tipoDoc === 'NOTA_ENTREGA') ? '#34d399' : '#f8fafc',
                      fontWeight: 700,
                      fontFamily: 'monospace',
                      fontSize: '0.90rem'
                    }}
                  />
                </div>
                <div style={{ fontSize: '0.72rem', color: (isExento || tipoDoc === 'NOTA_ENTREGA') ? '#34d399' : '#64748b', marginTop: '3px' }}>
                  {(isExento || tipoDoc === 'NOTA_ENTREGA') ? 'Exento de IVA (Bs. 0,00)' : `Bs. ${formatBs(ivaBs)}`}
                </div>
              </div>

              {/* Total en Divisas ($ USD) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#f59e0b', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Total Documento ($ USD) *
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '10px', top: '8px', color: '#f59e0b', fontWeight: 800 }}>$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={totalUsd}
                    onChange={(e) => handleTotalUsdChange(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 24px',
                      borderRadius: '8px',
                      border: '1px solid rgba(245, 158, 11, 0.5)',
                      background: 'rgba(15, 23, 42, 0.8)',
                      color: '#fbbf24',
                      fontWeight: 900,
                      fontFamily: 'monospace',
                      fontSize: '1.05rem'
                    }}
                  />
                </div>
                <div style={{ fontSize: '0.74rem', color: '#fbbf24', fontWeight: 700, marginTop: '3px' }}>
                  Bs. {formatBs(totalBs)}
                </div>
              </div>

              {/* Tasa de Cambio en Bolívares */}
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Tasa en Bolívares (Bs/USD) *
                </label>
                <input
                  type="number"
                  step="0.0001"
                  min="0.0001"
                  required
                  value={tasa}
                  onChange={(e) => setTasa(e.target.value)}
                  placeholder="Ej. 899.27"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(52, 211, 153, 0.4)',
                    background: 'rgba(15, 23, 42, 0.8)',
                    color: '#34d399',
                    fontWeight: 800,
                    fontFamily: 'monospace',
                    fontSize: '0.95rem'
                  }}
                />
                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '3px' }}>
                  Tasa oficial aplicada al cuadre
                </div>
              </div>
            </div>

            {/* Resumen de totales en Bolívares */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1rem',
                background: 'rgba(15, 23, 42, 0.7)',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                fontSize: '0.80rem',
                flexWrap: 'wrap',
                gap: '8px'
              }}
            >
              <div style={{ color: '#94a3b8' }}>
                Base Imponible: <strong style={{ color: '#f8fafc' }}>Bs. {formatBs(subtotalBs)}</strong>
              </div>
              <div style={{ color: '#94a3b8' }}>
                IVA (16%): <strong style={{ color: (isExento || tipoDoc === 'NOTA_ENTREGA') ? '#34d399' : '#f8fafc' }}>
                  {(isExento || tipoDoc === 'NOTA_ENTREGA') ? 'Exento (Bs. 0,00)' : `Bs. ${formatBs(ivaBs)}`}
                </strong>
              </div>
              <div style={{ color: '#38bdf8', fontWeight: 800 }}>
                Total Facturado: <strong style={{ color: '#38bdf8', fontSize: '0.92rem' }}>Bs. {formatBs(totalBs)}</strong>
              </div>
            </div>
          </div>

          {/* SECCIÓN 4: CONDICIÓN DE COBRANZA & SALDO CXC */}
          <div
            style={{
              background: 'rgba(30, 41, 59, 0.4)',
              border: '1px solid rgba(255, 255, 255, 0.07)',
              borderRadius: '14px',
              padding: '1.15rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={16} color="#a855f7" />
                <h4 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 800, color: '#f1f5f9', textTransform: 'uppercase' }}>
                  4. Condición de Cobranza & Destino en Cuentas por Cobrar (CxC)
                </h4>
              </div>

              {/* Badge de Estado en CxC */}
              <div
                style={{
                  padding: '4px 10px',
                  borderRadius: '6px',
                  fontSize: '0.76rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: saldoNum <= 0.01 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                  color: saldoNum <= 0.01 ? '#34d399' : '#fbbf24',
                  border: saldoNum <= 0.01 ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)'
                }}
              >
                {saldoNum <= 0.01 ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                <span>{saldoNum <= 0.01 ? 'ESTADO: COBRADA / PAGADA' : 'ESTADO: PENDIENTE POR COBRAR'}</span>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '0.85rem' }}>
              {/* Abono Inicial ($ USD) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#34d399', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Abono Inicial ($ USD)
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '10px', top: '8px', color: '#34d399', fontWeight: 700 }}>$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={totalNum}
                    value={abonosUsd}
                    onChange={(e) => setAbonosUsd(e.target.value)}
                    placeholder="0.00"
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 24px',
                      borderRadius: '8px',
                      border: '1px solid rgba(52, 211, 153, 0.4)',
                      background: 'rgba(15, 23, 42, 0.8)',
                      color: '#34d399',
                      fontWeight: 800,
                      fontFamily: 'monospace',
                      fontSize: '0.90rem'
                    }}
                  />
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '3px' }}>
                  Bs. {formatBs(round2(abonosNum * tasaNum))}
                </div>
              </div>

              {/* Saldo Restante en CxC ($ USD) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#ef4444', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Saldo Pendiente en CxC ($ USD)
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '10px', top: '8px', color: '#ef4444', fontWeight: 700 }}>$</span>
                  <input
                    type="text"
                    readOnly
                    value={saldoNum.toFixed(2)}
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 24px',
                      borderRadius: '8px',
                      border: '1px solid rgba(239, 68, 68, 0.4)',
                      background: 'rgba(239, 68, 68, 0.08)',
                      color: '#f87171',
                      fontWeight: 900,
                      fontFamily: 'monospace',
                      fontSize: '1rem',
                      cursor: 'not-allowed'
                    }}
                  />
                </div>
                <div style={{ fontSize: '0.72rem', color: '#f87171', fontWeight: 700, marginTop: '3px' }}>
                  Bs. {formatBs(saldoBs)}
                </div>
              </div>

              {/* Observaciones / Notas de Cuadre */}
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Observaciones / Motivo de Cuadre
                </label>
                <input
                  type="text"
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                  placeholder="Ej. Cuadre de facturación noviembre 2026 / Factura manual cargada a CxC"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    background: 'rgba(15, 23, 42, 0.8)',
                    color: '#e2e8f0',
                    fontSize: '0.84rem'
                  }}
                />
              </div>
            </div>
          </div>

          {/* FOOTER Y ACCIONES */}
          <div
            style={{
              paddingTop: '0.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              marginTop: 'auto'
            }}
          >
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                fontSize: '0.80rem',
                color: '#94a3b8'
              }}
            >
              <input
                type="checkbox"
                checked={keepOpenAfterSave}
                onChange={(e) => setKeepOpenAfterSave(e.target.checked)}
                style={{ width: '15px', height: '15px', cursor: 'pointer' }}
              />
              <span>Mantener modal abierto para cargar otra factura de noviembre</span>
            </label>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving}
                style={{
                  padding: '9px 18px',
                  borderRadius: '10px',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  background: 'rgba(255, 255, 255, 0.05)',
                  color: '#e2e8f0',
                  fontSize: '0.84rem',
                  fontWeight: 600,
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s'
                }}
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={isSaving}
                style={{
                  padding: '9px 24px',
                  borderRadius: '10px',
                  border: 'none',
                  background: isSaving
                    ? '#475569'
                    : tipoDoc === 'NOTA_ENTREGA'
                      ? 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)'
                      : 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
                  color: '#ffffff',
                  fontSize: '0.86rem',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 15px rgba(16, 185, 129, 0.35)',
                  transition: 'all 0.15s'
                }}
              >
                <CheckCircle2 size={16} />
                <span>{isSaving ? 'Guardando en Cobranzas...' : 'Guardar y Subir a Cobranzas (CxC)'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
