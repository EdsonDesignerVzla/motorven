import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Download,
  Printer,
  Calendar,
  FileText,
  DollarSign,
  ShieldCheck,
  Building2,
  FileCode,
  FileCheck2,
  AlertCircle,
  TrendingUp,
  CreditCard,
  Hash,
  Receipt,
  Lock,
  ShieldAlert,
  CheckCircle2,
  Clock,
  ExternalLink
} from 'lucide-react';
import { formatBs, formatNumberVe, formatUsd } from '../services/formatService';
import {
  buildLibroVentasRows,
  buildLibroComprasRows,
  generateSeniatVatRetentionTxt,
  generateSeniatIslrXml,
  encodeIso88591Bytes,
  isFiscalDocEligible,
  validateRif,
  generarReporteX,
  ejecutarCierreZ,
  dedupeCanonicalDocs
} from '../services/fiscalService';
import FiscalTicketModal from '../components/FiscalTicketModal';
import IslrWithholdingModal from '../components/IslrWithholdingModal';
import { generateTaxReportPDF, generateSeniatRetentionVoucherPDF, generateAnnualArcRetentionPDF } from '../services/pdfReportService';

export default function TaxReportsView({
  sales = [],
  purchases = [],
  suppliers = [],
  profitSuppliers = [],
  fiscalClosures = [],
  onExecuteCierreZ,
  config: rawConfig = {},
  currentUser = null,
  profitIslrConcepts = [],
  profitBeneficiaries = [],
  profitPaymentOrders = [],
  profitIslrWithholdings = [],
  profitAccountsPayable = [],
  profitPurchases = [],
  onSyncProfit
}) {
  const config = rawConfig || {};
  const safeConfig = config;
  const [reportType, setReportType] = useState('LIBRO_VENTAS'); // LIBRO_VENTAS, LIBRO_COMPRAS, IGTF, CIERRES_FISCALES, EXPORT_SENIAT
  const [showIslrModal, setShowIslrModal] = useState(false);
  const [seniatExportFeedback, setSeniatExportFeedback] = useState(null);
  const [mesFiltro, setMesFiltro] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Modales de Cierres Fiscales
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [currentTicketClosure, setCurrentTicketClosure] = useState(null);
  const [showZConfirmModal, setShowZConfirmModal] = useState(false);
  const [isClosingZ, setIsClosingZ] = useState(false);
  const [zConfirmCheck, setZConfirmCheck] = useState(false);

  // Filtrado estricto por mes seleccionado y documentos fiscales válidos (excluye NE/Cotizaciones y fechas nulas)
  const filteredSales = useMemo(() => {
    return dedupeCanonicalDocs(sales || []).filter(s => {
      if (!s || !s.fecha || !isFiscalDocEligible(s)) return false;
      return String(s.fecha).slice(0, 7) === mesFiltro;
    });
  }, [sales, mesFiltro]);

  // Fusión normalizada y sin duplicados de compras locales Signum + profit_purchases
  const unifiedPurchases = useMemo(() => {
    const byKey = new Map();
    const buildKey = (num, rif, fallbackId) => {
      const f = String(num || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
      const r = String(rif || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
      return f ? `${f}::${r}` : String(fallbackId || '');
    };

    // Priorizar compras locales Signum cuando tengan desglose/retenciones completas, luego completar con profit_purchases
    (purchases || []).forEach(p => {
      if (!p) return;
      const num = p.numeroFacturaProv || p.numeroFactura || p.nroFactura || p.id;
      const key = buildKey(num, p.proveedorRif || p.proveedorId, p.id);
      if (key) byKey.set(key, p);
    });

    (profitPurchases || []).forEach(p => {
      if (!p) return;
      const num = p.facturaProv || p.factNum || p.id;
      const key = buildKey(num, p.provRif || p.coProv, p.id);
      if (!key || byKey.has(key)) return;
      const totUsd = Number(p.totNetoUsd ?? 0);
      const totBs = Number(p.totNetoBs ?? 0);
      const ivaUsd = Number(p.ivaUsd ?? 0);
      const ivaBs = Number(p.ivaBs ?? 0);
      const brutoBs = Number(p.totBrutoBs ?? 0);
      const brutoUsd = Number(p.totBrutoUsd ?? 0);
      const rate = (totBs > 0 && totUsd > 0) ? Number((totBs / totUsd).toFixed(4)) : (Number(safeConfig.tasaDolar) || 0);
      byKey.set(key, {
        id: p.id,
        tipoDoc: p.tipoDoc || 'FACTURA',
        numeroFactura: String(num || ''),
        numeroFacturaProv: String(num || ''),
        numeroControl: p.numeroControl || p.nroControl || '00-000000',
        fecha: p.fechaEmision || p.fecEmis || '',
        proveedorId: p.coProv || '',
        proveedorNombre: p.provNombre || 'PROVEEDOR',
        proveedorRif: p.provRif || '',
        tasaDolar: rate,
        subtotalUsd: brutoUsd,
        subtotalBs: brutoBs,
        baseGeneralUsd: ivaUsd > 0 ? brutoUsd : 0,
        baseGeneralBs: ivaBs > 0 ? brutoBs : 0,
        ivaGeneralUsd: ivaUsd,
        ivaGeneralBs: ivaBs,
        ivaUsd,
        ivaBs,
        montoExentoBs: ivaBs === 0 ? (totBs || brutoBs) : 0,
        totalUsd: totUsd,
        totalBs: totBs,
        retencionIvaBs: Number(p.retencionIvaBs ?? 0),
        retencionIslrBs: Number(p.retencionIslrBs ?? 0),
        comprobanteRetencionIva: p.comprobanteRetencionIva || '',
        anulada: Boolean(p.anulada || p.anulado)
      });
    });

    return Array.from(byKey.values());
  }, [purchases, profitPurchases, safeConfig.tasaDolar]);

  const filteredPurchases = useMemo(() => {
    return unifiedPurchases.filter(p => {
      const f = p?.fecha || p?.fechaEmision || p?.fechaCompra || '';
      if (!f) return false;
      return String(f).slice(0, 7) === mesFiltro;
    });
  }, [unifiedPurchases, mesFiltro]);

  const filteredIslrWithholdings = useMemo(() => {
    return (profitIslrWithholdings || []).filter(w => {
      if (!w) return false;
      if (w.periodoFiscal) {
        return String(w.periodoFiscal).replace(/[^0-9]/g, '') === mesFiltro.replace('-', '');
      }
      const f = w.fechaEmision || w.createdAt || '';
      return f ? String(f).slice(0, 7) === mesFiltro : false;
    });
  }, [profitIslrWithholdings, mesFiltro]);

  // Construcción de filas oficiales conforme al Reglamento de la Ley del IVA
  const libroVentasRows = useMemo(() => {
    return buildLibroVentasRows(filteredSales, safeConfig);
  }, [filteredSales, safeConfig]);

  const libroComprasRows = useMemo(() => {
    return buildLibroComprasRows(filteredPurchases, safeConfig);
  }, [filteredPurchases, safeConfig]);

  const ventasAuditSummary = useMemo(() => {
    const invalidRifRows = libroVentasRows.filter(r => !r.anulada && !r.rifValido);
    const missingIvaRows = libroVentasRows.filter(r => r.sinDesgloseIva);
    return { invalidRifRows, missingIvaRows };
  }, [libroVentasRows]);

  // Totales Libro de Ventas
  const totalesVentas = useMemo(() => {
    return libroVentasRows.reduce((acc, row) => ({
      totalVentasBs: acc.totalVentasBs + (row.totalVentasBs || 0),
      ventasExentasBs: acc.ventasExentasBs + (row.ventasExentasBs || 0),
      baseImponible16Bs: acc.baseImponible16Bs + (row.baseImponible16Bs || 0),
      iva16Bs: acc.iva16Bs + (row.iva16Bs || 0),
      baseImponible8Bs: acc.baseImponible8Bs + (row.baseImponible8Bs || 0),
      iva8Bs: acc.iva8Bs + (row.iva8Bs || 0),
      baseImponible31Bs: acc.baseImponible31Bs + (row.baseImponible31Bs || 0),
      iva31Bs: acc.iva31Bs + (row.iva31Bs || 0),
      igtfBs: acc.igtfBs + (row.igtfBs || 0),
      retencionIvaBs: acc.retencionIvaBs + (row.retencionIvaBs || 0),
    }), {
      totalVentasBs: 0,
      ventasExentasBs: 0,
      baseImponible16Bs: 0,
      iva16Bs: 0,
      baseImponible8Bs: 0,
      iva8Bs: 0,
      baseImponible31Bs: 0,
      iva31Bs: 0,
      igtfBs: 0,
      retencionIvaBs: 0,
    });
  }, [libroVentasRows]);

  // Totales Libro de Compras
  const totalesCompras = useMemo(() => {
    return libroComprasRows.reduce((acc, row) => ({
      totalComprasBs: acc.totalComprasBs + (row.totalComprasBs || 0),
      comprasExentasBs: acc.comprasExentasBs + (row.comprasExentasBs || 0),
      baseImponible16Bs: acc.baseImponible16Bs + (row.baseImponible16Bs || 0),
      creditoFiscal16Bs: acc.creditoFiscal16Bs + (row.creditoFiscal16Bs || 0),
      retencionIvaBs: acc.retencionIvaBs + (row.retencionIvaBs || 0),
      retencionIslrBs: acc.retencionIslrBs + (row.retencionIslrBs || 0),
    }), {
      totalComprasBs: 0,
      comprasExentasBs: 0,
      baseImponible16Bs: 0,
      creditoFiscal16Bs: 0,
      retencionIvaBs: 0,
      retencionIslrBs: 0,
    });
  }, [libroComprasRows]);

  // Ventas con percepción de IGTF
  const igtfSales = useMemo(() => {
    return filteredSales.filter(s => String(s.estado || '').toUpperCase() !== 'ANULADA' && !s.anulada && (s.igtfUsd > 0 || s.igtfBs > 0));
  }, [filteredSales]);

  // Documentos fiscales abiertos en la jornada activa pendientes de Cierre Z
  const openSales = useMemo(() => {
    return (sales || []).filter(s =>
      isFiscalDocEligible(s) &&
      !s.cierreZId &&
      !s.cierre_z_id &&
      !s.cerrada &&
      String(s.estado || '').toUpperCase() !== 'ANULADA' &&
      !s.anulada
    );
  }, [sales]);

  const openDatesCount = useMemo(() => {
    const dates = new Set(openSales.map(s => String(s.fecha || '').slice(0, 10)).filter(Boolean));
    return dates.size;
  }, [openSales]);

  const corteXActual = useMemo(() => {
    return generarReporteX({ sales, config: safeConfig, currentUser });
  }, [sales, safeConfig, currentUser]);

  const handleOpenReporteX = () => {
    const repX = generarReporteX({ sales, config: safeConfig, currentUser });
    setCurrentTicketClosure(repX);
    setShowTicketModal(true);
  };

  const handleConfirmCierreZ = async () => {
    if (!zConfirmCheck) return;
    setIsClosingZ(true);
    try {
      const result = await ejecutarCierreZ({
        sales,
        previousClosures: fiscalClosures,
        config: safeConfig,
        currentUser
      });
      if (onExecuteCierreZ) {
        await onExecuteCierreZ(result.cierreZ, result.closedSaleIds);
      }
      setShowZConfirmModal(false);
      setZConfirmCheck(false);
      setCurrentTicketClosure(result.cierreZ);
      setShowTicketModal(true);
    } catch (e) {
      console.error('Error al procesar Cierre Z:', e);
    } finally {
      setIsClosingZ(false);
    }
  };

  // Helper para descargar archivos de texto/xml (soporta bytes binarios para ISO-8859-1)
  const downloadFile = (filename, content, mimeType = 'text/plain;charset=utf-8') => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // 1. Exportar Libro de Ventas a CSV Oficial (incluyendo alícuota adicional 31%)
  const exportLibroVentasCsv = () => {
    let csv = "N° Operacion;Fecha;RIF Cliente;Nombre o Razon Social;Tipo Transaccion;N° Factura;N° Control;Factura Afectada;Total Ventas con IVA (Bs);Ventas Exentas (Bs);Base Imponible 16% (Bs);IVA 16% (Bs);Base Imponible 8% (Bs);IVA 8% (Bs);Base Imponible 31% (Bs);IVA 31% (Bs);IGTF 3% (Bs);IVA Retenido (Bs);N° Comprobante Retencion\n";
    libroVentasRows.forEach(r => {
      csv += `${r.numOperacion};${r.fecha};${r.rifCliente};"${r.nombreCliente.replace(/"/g, '""')}";${r.tipoTransaccion};${r.numeroFactura};${r.numeroControl};${r.facturaAfectada};${r.totalVentasBs.toFixed(2)};${r.ventasExentasBs.toFixed(2)};${r.baseImponible16Bs.toFixed(2)};${r.iva16Bs.toFixed(2)};${r.baseImponible8Bs.toFixed(2)};${r.iva8Bs.toFixed(2)};${(r.baseImponible31Bs || 0).toFixed(2)};${(r.iva31Bs || 0).toFixed(2)};${r.igtfBs.toFixed(2)};${r.retencionIvaBs.toFixed(2)};${r.comprobanteRetencion}\n`;
    });
    downloadFile(`LIBRO_VENTAS_${config.rif || 'J-31115365-9'}_${mesFiltro}.csv`, csv, 'text/csv;charset=utf-8');
  };

  // 2. Exportar Libro de Compras a CSV Oficial
  const exportLibroComprasCsv = () => {
    let csv = "N° Operacion;Fecha;RIF Proveedor;Nombre Proveedor;Tipo Transaccion;N° Factura;N° Control;Factura Afectada;Total Compras (Bs);Compras Exentas (Bs);Base Imponible 16% (Bs);Credito Fiscal IVA 16% (Bs);Retencion IVA (Bs);N° Comprobante Retencion (14 Digitos);Retencion ISLR (Bs)\n";
    libroComprasRows.forEach(r => {
      csv += `${r.numOperacion};${r.fecha};${r.rifProveedor};"${r.nombreProveedor.replace(/"/g, '""')}";${r.tipoTransaccion};${r.numeroFactura};${r.numeroControl};${r.documentoAfectado};${r.totalComprasBs.toFixed(2)};${r.comprasExentasBs.toFixed(2)};${r.baseImponible16Bs.toFixed(2)};${r.creditoFiscal16Bs.toFixed(2)};${r.retencionIvaBs.toFixed(2)};${r.comprobanteRetencion};${r.retencionIslrBs.toFixed(2)}\n`;
    });
    downloadFile(`LIBRO_COMPRAS_${config.rif || 'J-31115365-9'}_${mesFiltro}.csv`, csv, 'text/csv;charset=utf-8');
  };

  // Retenciones reales elegibles para TXT de Retenciones IVA SENIAT
  const eligibleVatRetentions = useMemo(() => {
    return filteredPurchases.filter(p => {
      if (!p || p.anulada || p.anulado || String(p.estado || p.status || '').toUpperCase() === 'ANULADA') return false;
      const retBs = Number(p.retencionIvaBs ?? 0);
      const comp = String(p.comprobanteRetencionIva || p.numeroComprobanteRetencionIva || '').trim();
      return retBs > 0 && /^\d{14}$/.test(comp);
    });
  }, [filteredPurchases]);

  // 3. Generar y Descargar Archivo TXT de Retenciones de IVA para el Portal SENIAT (16 Columnas Tabuladas)
  const handleDownloadSeniatTxt = () => {
    setSeniatExportFeedback(null);
    if (eligibleVatRetentions.length === 0) {
      setSeniatExportFeedback({
        type: 'warning',
        text: `No existen compras en ${mesFiltro} con retención de IVA aplicada (> Bs. 0,00) y N° de comprobante de 14 dígitos.`
      });
      return;
    }

    const invalidRifs = eligibleVatRetentions.filter(p => !validateRif(p.proveedorRif || '').isValid);
    if (invalidRifs.length > 0) {
      setSeniatExportFeedback({
        type: 'error',
        text: `Existen ${invalidRifs.length} registro(s) con RIF de proveedor inválido según Módulo 11 SENIAT. Corrígelos antes de exportar.`
      });
      return;
    }

    const retencionesData = eligibleVatRetentions.map((p, idx) => {
      const tasa = Number(p.tasaDolar || safeConfig.tasaDolar || 1);
      const ivaBs = Number(p.ivaGeneralBs ?? p.ivaBs ?? (p.ivaUsd != null ? Number(p.ivaUsd) * tasa : 0));
      const baseGenBs = Number(p.baseGeneralBs ?? (p.baseGeneralUsd != null ? Number(p.baseGeneralUsd) * tasa : (ivaBs > 0 ? Number(p.subtotalBs ?? 0) : 0)));
      const baseRedBs = Number(p.baseReducidaBs ?? 0);
      const alicuota = p.alicuota ?? (baseGenBs > 0 ? 16.00 : (baseRedBs > 0 ? 8.00 : 0.00));

      return {
        periodoFiscal: mesFiltro.replace('-', ''),
        fechaEmision: p.fecha || p.fechaEmision,
        tipoOperacion: 'C',
        tipoDocumento: p.tipoDoc === 'NOTA_CREDITO' ? '03' : (p.tipoDoc === 'NOTA_DEBITO' ? '02' : '01'),
        proveedorRif: p.proveedorRif,
        numeroFactura: p.numeroFactura || p.numeroFacturaProv || p.facturaProv || `FAC-${idx + 1}`,
        numeroControl: p.numeroControl || p.nroControl || '00-000000',
        totalDocumentoBs: Number(p.totalBs ?? 0),
        baseImponibleBs: baseGenBs || baseRedBs,
        montoIvaBs: ivaBs,
        montoRetenidoBs: Number(p.retencionIvaBs ?? 0),
        documentoAfectado: p.documentoAfectado || '0',
        comprobanteRetencion: String(p.comprobanteRetencionIva || p.numeroComprobanteRetencionIva || '').trim(),
        montoExentoBs: Number(p.montoExentoBs ?? p.baseExentaBs ?? 0),
        alicuota,
        numeroExpediente: '0'
      };
    });

    const txtContent = generateSeniatVatRetentionTxt(retencionesData, config);
    if (!txtContent) {
      setSeniatExportFeedback({
        type: 'error',
        text: 'Ningún comprobante superó la validación de 14 dígitos y RIF de 10 caracteres requerida por el SENIAT.'
      });
      return;
    }
    const cleanRif = (config.rif || 'J-31115365-9').replace(/[^A-Z0-9]/gi, '').toUpperCase();
    downloadFile(`${cleanRif}_${mesFiltro.replace('-', '')}_RET_IVA.txt`, txtContent, 'text/plain;charset=utf-8');
    setSeniatExportFeedback({
      type: 'success',
      text: `Archivo TXT generado con ${retencionesData.length} retención(es) de IVA reales.`
    });
  };

  // 4. Generar y Descargar Archivo XML de Retenciones de ISLR para el Portal SENIAT (ISO-8859-1 real desde profit_islr_withholdings)
  const handleDownloadSeniatXml = () => {
    setSeniatExportFeedback(null);
    if (filteredIslrWithholdings.length === 0) {
      setSeniatExportFeedback({
        type: 'warning',
        text: `No existen comprobantes de retención ISLR registrados en ${mesFiltro}. Emítelos primero desde "Retenciones ISLR SENIAT & Pagos".`
      });
      return;
    }

    const islrData = filteredIslrWithholdings.map((w) => {
      const isUsd = String(w.moneda || 'BS').toUpperCase() === 'USD';
      const tasa = Number(w.tasaCambio || safeConfig.tasaDolar || 1);
      const montoOpBs = isUsd ? Number(w.baseImponible || 0) * tasa : Number(w.baseImponible || 0);
      return {
        periodoFiscal: String(w.periodoFiscal || mesFiltro).replace('-', ''),
        fechaEmision: w.fechaEmision || w.createdAt,
        proveedorRif: w.proveedorRif,
        numeroFactura: w.nroFacturaAfectada || '',
        numeroControl: w.nroControl || '00-000000',
        codigoConcepto: w.codigoConceptoIslr || '055',
        montoOperacionBs: montoOpBs,
        porcentajeRetencion: Number(w.porcentajeRetencion ?? 0)
      };
    });

    const xmlContent = generateSeniatIslrXml(islrData, config);
    const isoBytes = encodeIso88591Bytes(xmlContent);
    const cleanRif = (config.rif || 'J-31115365-9').replace(/[^A-Z0-9]/gi, '').toUpperCase();
    downloadFile(`${cleanRif}_${mesFiltro.replace('-', '')}_ISLR.xml`, isoBytes, 'application/xml;charset=iso-8859-1');
    setSeniatExportFeedback({
      type: 'success',
      text: `Archivo XML ISO-8859-1 generado con ${islrData.length} comprobante(s) ISLR oficiales.`
    });
  };

  const handleGenerateAnnualArcReport = () => {
    const firstSupplier = (suppliers && suppliers.length > 0 ? suppliers[0] : (profitSuppliers && profitSuppliers.length > 0 ? profitSuppliers[0] : null));
    const targetYear = Number(mesFiltro?.slice(0, 4) || new Date().getFullYear());
    const targetProv = firstSupplier || {
      nombre: profitIslrWithholdings?.[0]?.proveedorNombre || 'PROVEEDOR GENERAL REGISTRADO',
      rif: profitIslrWithholdings?.[0]?.proveedorRif || 'J-00000000-0',
      direccion: profitIslrWithholdings?.[0]?.proveedorDireccion || 'Venezuela'
    };
    generateAnnualArcRetentionPDF({
      supplier: targetProv,
      year: targetYear,
      retentionRecords: profitIslrWithholdings || [],
      config: safeConfig,
      currentUser
    });
  };

  return (
    <div>
      {/* Cabecera Principal */}
      <div className="page-header-responsive">
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileSpreadsheet size={28} color="var(--motorven-red)" /> Libros Fiscales & Auditoría SENIAT
          </h1>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
            Cumplimiento estricto de Providencias SNAT/2011/00071, SNAT/2013/00030, Ley de IVA, IGTF y C.O.T.
          </p>
        </div>

        <div className="no-print" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button 
            className="btn" 
            onClick={() => setShowIslrModal(true)}
            style={{
              background: 'linear-gradient(135deg, #d97706, #b45309)',
              color: '#fff',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              border: 'none',
              boxShadow: '0 2px 10px rgba(217, 119, 6, 0.35)'
            }}
          >
            <Receipt size={18} />
            Retenciones ISLR SENIAT & Pagos
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => {
              if (profitIslrWithholdings && profitIslrWithholdings.length > 0) {
                handleGenerateAnnualArcReport();
              } else {
                setShowIslrModal(true);
              }
            }}
            title="Generar Comprobante Anual de Retenciones ISLR (Formulario ARC - Art. 24 Decreto 1.808)"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <FileText size={18} color="var(--motorven-gold)" />
            Comprobante Anual ARC
          </button>
          {reportType === 'LIBRO_VENTAS' && (
            <button className="btn btn-secondary" onClick={exportLibroVentasCsv}>
              <Download size={18} /> Exportar Ventas (CSV)
            </button>
          )}
          {reportType === 'LIBRO_COMPRAS' && (
            <button className="btn btn-secondary" onClick={exportLibroComprasCsv}>
              <Download size={18} /> Exportar Compras (CSV)
            </button>
          )}
          <button
            className="btn btn-print-report"
            onClick={() => generateTaxReportPDF({
              reportType,
              period: mesFiltro,
              sales: filteredSales,
              purchases: filteredPurchases,
              fiscalClosures,
              withholdings: profitIslrWithholdings,
              igtfSales,
              config: safeConfig,
              currentUser
            })}
            title="Descargar Libro Fiscal Oficial SENIAT en PDF"
            style={{ marginLeft: 'auto' }}
          >
            <Printer size={18} color="#ffffff" /> Imprimir Reporte
          </button>
        </div>
      </div>

      {/* Selector de Pestañas y Período */}
      <div className="card no-print" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', background: 'var(--bg-tertiary)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', flexWrap: 'wrap', gap: '4px' }}>
            <button
              className="btn btn-sm"
              onClick={() => setReportType('LIBRO_VENTAS')}
              style={{
                background: reportType === 'LIBRO_VENTAS' ? 'var(--motorven-red)' : 'transparent',
                color: reportType === 'LIBRO_VENTAS' ? '#fff' : 'var(--text-muted)',
                fontWeight: reportType === 'LIBRO_VENTAS' ? 700 : 500,
                transition: 'all 0.2s ease',
                boxShadow: reportType === 'LIBRO_VENTAS' ? '0 2px 8px rgba(204, 0, 16, 0.35)' : 'none'
              }}
            >
              <FileText size={15} style={{ marginRight: '4px' }} />
              Libro de Ventas (Art. 76)
            </button>
            <button
              className="btn btn-sm"
              onClick={() => setReportType('LIBRO_COMPRAS')}
              style={{
                background: reportType === 'LIBRO_COMPRAS' ? 'var(--motorven-red)' : 'transparent',
                color: reportType === 'LIBRO_COMPRAS' ? '#fff' : 'var(--text-muted)',
                fontWeight: reportType === 'LIBRO_COMPRAS' ? 700 : 500,
                transition: 'all 0.2s ease',
                boxShadow: reportType === 'LIBRO_COMPRAS' ? '0 2px 8px rgba(204, 0, 16, 0.35)' : 'none'
              }}
            >
              <FileSpreadsheet size={15} style={{ marginRight: '4px' }} />
              Libro de Compras (Art. 75)
            </button>
            <button
              className="btn btn-sm"
              onClick={() => setReportType('IGTF')}
              style={{
                background: reportType === 'IGTF' ? 'var(--motorven-red)' : 'transparent',
                color: reportType === 'IGTF' ? '#fff' : 'var(--text-muted)',
                fontWeight: reportType === 'IGTF' ? 700 : 500,
                transition: 'all 0.2s ease',
                boxShadow: reportType === 'IGTF' ? '0 2px 8px rgba(204, 0, 16, 0.35)' : 'none'
              }}
            >
              <DollarSign size={15} style={{ marginRight: '4px' }} />
              Percepción IGTF 3%
            </button>
            <button
              className="btn btn-sm"
              onClick={() => setReportType('CIERRES_FISCALES')}
              style={{
                background: reportType === 'CIERRES_FISCALES' ? 'var(--motorven-red)' : 'transparent',
                color: reportType === 'CIERRES_FISCALES' ? '#fff' : 'var(--text-muted)',
                fontWeight: reportType === 'CIERRES_FISCALES' ? 700 : 500,
                transition: 'all 0.2s ease',
                boxShadow: reportType === 'CIERRES_FISCALES' ? '0 2px 8px rgba(204, 0, 16, 0.35)' : 'none'
              }}
            >
              <Receipt size={15} style={{ marginRight: '4px' }} />
              Cierres Fiscales (X / Z)
            </button>
            <button
              className="btn btn-sm"
              onClick={() => setReportType('EXPORT_SENIAT')}
              style={{
                background: reportType === 'EXPORT_SENIAT' ? 'var(--motorven-red)' : 'transparent',
                color: reportType === 'EXPORT_SENIAT' ? '#fff' : 'var(--text-muted)',
                fontWeight: reportType === 'EXPORT_SENIAT' ? 700 : 500,
                transition: 'all 0.2s ease',
                boxShadow: reportType === 'EXPORT_SENIAT' ? '0 2px 8px rgba(204, 0, 16, 0.35)' : 'none'
              }}
            >
              <FileCode size={15} style={{ marginRight: '4px' }} />
              Portal SENIAT (TXT / XML)
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={16} color="var(--accent-amber)" />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Período Impositivo:</span>
            <input
              type="month"
              className="form-control"
              value={mesFiltro}
              onChange={(e) => setMesFiltro(e.target.value)}
              style={{ width: '160px', padding: '6px 10px', fontSize: '0.9rem' }}
            />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. VISTA LIBRO DE VENTAS (ART. 76 REGLAMENTO LEY DEL IVA) */}
      {/* ========================================================================= */}
      {reportType === 'LIBRO_VENTAS' && (
        <>
          {/* Tarjetas de Resumen Tributario */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="card" style={{ padding: '1rem', borderLeft: '4px solid var(--motorven-red)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Ventas Facturadas</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '4px' }}>{formatBs(totalesVentas.totalVentasBs)}</div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{libroVentasRows.length} documento(s) fiscal(es)</div>
            </div>
            <div className="card" style={{ padding: '1rem', borderLeft: '4px solid var(--accent-primary)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Base Imponible General (16%)</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '4px' }}>{formatBs(totalesVentas.baseImponible16Bs)}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--accent-primary)' }}>Débito Fiscal: {formatBs(totalesVentas.iva16Bs)}</div>
            </div>
            <div className="card" style={{ padding: '1rem', borderLeft: '4px solid var(--accent-amber)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>IGTF Percibido (3%)</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '4px', color: 'var(--accent-amber)' }}>{formatBs(totalesVentas.igtfBs)}</div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Pagos en divisas/crypto</div>
            </div>
            <div className="card" style={{ padding: '1rem', borderLeft: '4px solid var(--accent-emerald)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Retenciones IVA Soportadas</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '4px', color: 'var(--accent-emerald)' }}>{formatBs(totalesVentas.retencionIvaBs)}</div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Retenido por Agentes Especiales</div>
            </div>
          </div>

          <div className="card">
            {/* Membrete Legal Oficial */}
            <div style={{ textAlign: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 800 }}>
                {config.nombreEmpresa || 'SIGNUM MOTORVEN C.A.'}
              </h2>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                RIF: <strong>{config.rif || 'J-31115365-9'}</strong> | Domicilio Fiscal: {config.direccionEmpresa || 'Barquisimeto, Estado Lara'}
              </div>
              <h3 style={{ fontSize: '1.05rem', color: 'var(--motorven-red)', marginTop: '8px', fontWeight: 700 }}>
                LIBRO DE VENTAS FISCAL - PERÍODO: {mesFiltro}
              </h3>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Conforme al Artículo 76 del Reglamento General de la Ley del Impuesto al Valor Agregado
              </div>
            </div>

            {(ventasAuditSummary.invalidRifRows.length > 0 || ventasAuditSummary.missingIvaRows.length > 0) && (
              <div style={{ marginBottom: '1rem', padding: '0.85rem 1rem', borderRadius: 'var(--radius-sm)', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.4)', fontSize: '0.8rem', color: '#fcd34d', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <strong>Auditoría Fiscal SENIAT ({mesFiltro}):</strong>
                {ventasAuditSummary.invalidRifRows.length > 0 && (
                  <span>• {ventasAuditSummary.invalidRifRows.length} factura(s) con RIF inválido según Módulo 11 (marcadas en rojo en la columna RIF).</span>
                )}
                {ventasAuditSummary.missingIvaRows.length > 0 && (
                  <span>• {ventasAuditSummary.missingIvaRows.length} factura(s) con Base 16% positiva e IVA = Bs. 0,00 (verificar si corresponden a ventas exentas antes de declarar).</span>
                )}
              </div>
            )}

            <div className="table-container" style={{ overflowX: 'auto' }}>
              <table className="custom-table" style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-tertiary)' }}>
                    <th>N° Op.</th>
                    <th>Fecha</th>
                    <th>RIF Cliente</th>
                    <th>Razón Social / Cliente</th>
                    <th>Tipo Doc.</th>
                    <th>N° Factura</th>
                    <th>N° Control</th>
                    <th>Doc. Afectado</th>
                    <th>Total Ventas (Bs.)</th>
                    <th>Ventas Exentas (Bs.)</th>
                    <th>Base Imponible 16% (Bs.)</th>
                    <th>% Alíc.</th>
                    <th>Débito Fiscal IVA 16% (Bs.)</th>
                    <th>Base Imponible 8% (Bs.)</th>
                    <th>IVA 8% (Bs.)</th>
                    <th>Base Imponible 31% (Bs.)</th>
                    <th>IVA 31% (Bs.)</th>
                    <th>IGTF 3% (Bs.)</th>
                    <th>IVA Retenido (Bs.)</th>
                    <th>N° Comprobante Ret.</th>
                  </tr>
                </thead>
                <tbody>
                  {libroVentasRows.length === 0 ? (
                    <tr>
                      <td colSpan="20" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        No existen operaciones fiscales de venta registradas para el período {mesFiltro}.
                      </td>
                    </tr>
                  ) : (
                    libroVentasRows.map((row) => (
                      <tr key={row.numOperacion} style={{ backgroundColor: row.anulada ? 'rgba(148, 163, 184, 0.08)' : (row.tipoTransaccion.startsWith('03-') ? 'rgba(239, 68, 68, 0.05)' : 'inherit'), opacity: row.anulada ? 0.72 : 1 }}>
                        <td>{String(row.numOperacion).padStart(4, '0')}</td>
                        <td>{row.fecha}</td>
                        <td>
                          <code style={{ color: !row.anulada && !row.rifValido ? '#f87171' : 'inherit', fontWeight: !row.anulada && !row.rifValido ? 700 : 400 }} title={!row.anulada && !row.rifValido ? 'RIF inválido según Módulo 11 SENIAT' : ''}>
                            {row.rifCliente}
                          </code>
                        </td>
                        <td style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.nombreCliente}</td>
                        <td>
                          <span className={`badge ${row.anulada ? 'badge-secondary' : (row.tipoTransaccion === '03-REG' ? 'badge-danger' : (row.tipoTransaccion === '02-REG' ? 'badge-warning' : 'badge-primary'))}`} style={{ fontSize: '0.7rem' }}>
                            {row.tipoTransaccion}
                          </span>
                        </td>
                        <td><strong style={{ color: 'var(--accent-primary)' }}>{row.numeroFactura}</strong></td>
                        <td><code style={{ color: 'var(--accent-amber)' }}>{row.numeroControl}</code></td>
                        <td>{row.facturaAfectada ? <strong style={{ color: '#ef4444' }}>{row.facturaAfectada}</strong> : '-'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatBs(row.totalVentasBs)}</td>
                        <td style={{ textAlign: 'right' }}>{formatBs(row.ventasExentasBs)}</td>
                        <td style={{ textAlign: 'right' }}>{formatBs(row.baseImponible16Bs)}</td>
                        <td style={{ textAlign: 'center' }}>{row.baseImponible16Bs !== 0 ? '16%' : (row.baseImponible8Bs !== 0 ? '8%' : (row.baseImponible31Bs !== 0 ? '31%' : '0%'))}</td>
                        <td style={{ textAlign: 'right', color: row.sinDesgloseIva ? '#f59e0b' : 'var(--accent-primary)', fontWeight: 600 }}>{formatBs(row.iva16Bs)}</td>
                        <td style={{ textAlign: 'right' }}>{formatBs(row.baseImponible8Bs)}</td>
                        <td style={{ textAlign: 'right' }}>{formatBs(row.iva8Bs)}</td>
                        <td style={{ textAlign: 'right' }}>{formatBs(row.baseImponible31Bs || 0)}</td>
                        <td style={{ textAlign: 'right' }}>{formatBs(row.iva31Bs || 0)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--accent-amber)' }}>{formatBs(row.igtfBs)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--accent-emerald)' }}>{formatBs(row.retencionIvaBs)}</td>
                        <td><code>{row.comprobanteRetencion || '-'}</code></td>
                      </tr>
                    ))
                  )}
                </tbody>
                {libroVentasRows.length > 0 && (
                  <tfoot>
                    <tr style={{ background: 'var(--bg-tertiary)', fontWeight: 800, borderTop: '2px solid var(--border-color)' }}>
                      <td colSpan="8" style={{ textAlign: 'right', textTransform: 'uppercase' }}>TOTALES DEL PERÍODO (Bs.):</td>
                      <td style={{ textAlign: 'right' }}>{formatBs(totalesVentas.totalVentasBs)}</td>
                      <td style={{ textAlign: 'right' }}>{formatBs(totalesVentas.ventasExentasBs)}</td>
                      <td style={{ textAlign: 'right' }}>{formatBs(totalesVentas.baseImponible16Bs)}</td>
                      <td></td>
                      <td style={{ textAlign: 'right', color: 'var(--accent-primary)' }}>{formatBs(totalesVentas.iva16Bs)}</td>
                      <td style={{ textAlign: 'right' }}>{formatBs(totalesVentas.baseImponible8Bs)}</td>
                      <td style={{ textAlign: 'right' }}>{formatBs(totalesVentas.iva8Bs)}</td>
                      <td style={{ textAlign: 'right' }}>{formatBs(totalesVentas.baseImponible31Bs)}</td>
                      <td style={{ textAlign: 'right' }}>{formatBs(totalesVentas.iva31Bs)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--accent-amber)' }}>{formatBs(totalesVentas.igtfBs)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--accent-emerald)' }}>{formatBs(totalesVentas.retencionIvaBs)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* 2. VISTA LIBRO DE COMPRAS (ART. 75 REGLAMENTO LEY DEL IVA) */}
      {/* ========================================================================= */}
      {reportType === 'LIBRO_COMPRAS' && (
        <>
          {/* Tarjetas de Resumen Compras */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div className="card" style={{ padding: '1rem', borderLeft: '4px solid var(--accent-amber)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Compras Facturadas</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '4px' }}>{formatBs(totalesCompras.totalComprasBs)}</div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{libroComprasRows.length} documento(s) proveedor</div>
            </div>
            <div className="card" style={{ padding: '1rem', borderLeft: '4px solid var(--accent-primary)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Base Imponible General (16%)</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '4px' }}>{formatBs(totalesCompras.baseImponible16Bs)}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--accent-primary)' }}>Crédito Fiscal: {formatBs(totalesCompras.creditoFiscal16Bs)}</div>
            </div>
            <div className="card" style={{ padding: '1rem', borderLeft: '4px solid var(--motorven-red)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Retenciones IVA a Enterar</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '4px', color: 'var(--motorven-red)' }}>{formatBs(totalesCompras.retencionIvaBs)}</div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Obligación como Agente de Retención</div>
            </div>
            <div className="card" style={{ padding: '1rem', borderLeft: '4px solid var(--accent-emerald)' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Retenciones ISLR (2%)</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: '4px', color: 'var(--accent-emerald)' }}>{formatBs(totalesCompras.retencionIslrBs)}</div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Concepto 055 Adquisición Bienes</div>
            </div>
          </div>

          <div className="card">
            {/* Membrete Legal Oficial */}
            <div style={{ textAlign: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.2rem', fontWeight: 800 }}>
                {config.nombreEmpresa || 'SIGNUM MOTORVEN C.A.'}
              </h2>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                RIF: <strong>{config.rif || 'J-31115365-9'}</strong> | Domicilio Fiscal: {config.direccionEmpresa || 'Barquisimeto, Estado Lara'}
              </div>
              <h3 style={{ fontSize: '1.05rem', color: 'var(--accent-amber)', marginTop: '8px', fontWeight: 700 }}>
                LIBRO DE COMPRAS FISCAL - PERÍODO: {mesFiltro}
              </h3>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Conforme al Artículo 75 del Reglamento General de la Ley del Impuesto al Valor Agregado
              </div>
            </div>

            <div className="table-container" style={{ overflowX: 'auto' }}>
              <table className="custom-table" style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-tertiary)' }}>
                    <th>N° Op.</th>
                    <th>Fecha</th>
                    <th>RIF Proveedor</th>
                    <th>Nombre / Razón Social Proveedor</th>
                    <th>Tipo Trans.</th>
                    <th>N° Factura Proveedor</th>
                    <th>N° Control</th>
                    <th>Doc. Afectado</th>
                    <th>Total Compras (Bs.)</th>
                    <th>Compras Exentas (Bs.)</th>
                    <th>Base Imponible 16% (Bs.)</th>
                    <th>% Alíc.</th>
                    <th>Crédito Fiscal IVA 16% (Bs.)</th>
                    <th>Retención IVA (Bs.)</th>
                    <th>Comprobante Retención (14 Dígitos)</th>
                    <th>Retención ISLR 2% (Bs.)</th>
                  </tr>
                </thead>
                <tbody>
                  {libroComprasRows.length === 0 ? (
                    <tr>
                      <td colSpan="16" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        No existen compras registradas para el período {mesFiltro}.
                      </td>
                    </tr>
                  ) : (
                    libroComprasRows.map((row) => (
                      <tr key={row.numOperacion}>
                        <td>{String(row.numOperacion).padStart(4, '0')}</td>
                        <td>{row.fecha}</td>
                        <td><code>{row.rifProveedor}</code></td>
                        <td style={{ maxWidth: '170px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.nombreProveedor}</td>
                        <td><span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>{row.tipoTransaccion}</span></td>
                        <td><strong style={{ color: 'var(--accent-primary)' }}>{row.numeroFactura}</strong></td>
                        <td><code style={{ color: 'var(--accent-amber)' }}>{row.numeroControl}</code></td>
                        <td>{row.documentoAfectado || '-'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatBs(row.totalComprasBs)}</td>
                        <td style={{ textAlign: 'right' }}>{formatBs(row.comprasExentasBs)}</td>
                        <td style={{ textAlign: 'right' }}>{formatBs(row.baseImponible16Bs)}</td>
                        <td style={{ textAlign: 'center' }}>{row.alicuota16 ?? 0}%</td>
                        <td style={{ textAlign: 'right', color: 'var(--accent-primary)', fontWeight: 600 }}>{formatBs(row.creditoFiscal16Bs)}</td>
                        <td style={{ textAlign: 'right', color: 'var(--motorven-red)', fontWeight: 700 }}>{formatBs(row.retencionIvaBs)}</td>
                        <td>
                          {row.comprobanteRetencion && Number(row.retencionIvaBs || 0) > 0 ? (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                              <code style={{ color: 'var(--accent-emerald)', fontWeight: 700 }}>{row.comprobanteRetencion}</code>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '2px 6px', fontSize: '0.68rem' }}
                                onClick={() => generateSeniatRetentionVoucherPDF({
                                  type: 'IVA',
                                  record: {
                                    numeroFactura: row.numeroFactura,
                                    numeroFacturaProv: row.numeroFactura,
                                    numeroControl: row.numeroControl,
                                    proveedorNombre: row.nombreProveedor,
                                    proveedorRif: row.rifProveedor,
                                    fecha: row.fecha,
                                    tasaCambio: row.tasaBcv || safeConfig.tasaDolar,
                                    montoTotalBs: row.totalComprasBs,
                                    baseImponibleBs: row.baseImponible16Bs,
                                    ivaBs: row.creditoFiscal16Bs,
                                    baseExentaBs: row.comprasExentasBs,
                                    retencionIvaBs: row.retencionIvaBs,
                                    numeroComprobanteRetencionIva: row.comprobanteRetencion
                                  },
                                  config: safeConfig,
                                  currentUser
                                })}
                                title="Descargar Comprobante Retención IVA SENIAT en PDF"
                              >
                                <Printer size={11} /> PDF
                              </button>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Sin comprobante</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', color: 'var(--accent-amber)' }}>{formatBs(row.retencionIslrBs)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                {libroComprasRows.length > 0 && (
                  <tfoot>
                    <tr style={{ background: 'var(--bg-tertiary)', fontWeight: 800, borderTop: '2px solid var(--border-color)' }}>
                      <td colSpan="8" style={{ textAlign: 'right', textTransform: 'uppercase' }}>TOTALES DEL PERÍODO (Bs.):</td>
                      <td style={{ textAlign: 'right' }}>{formatBs(totalesCompras.totalComprasBs)}</td>
                      <td style={{ textAlign: 'right' }}>{formatBs(totalesCompras.comprasExentasBs)}</td>
                      <td style={{ textAlign: 'right' }}>{formatBs(totalesCompras.baseImponible16Bs)}</td>
                      <td></td>
                      <td style={{ textAlign: 'right', color: 'var(--accent-primary)' }}>{formatBs(totalesCompras.creditoFiscal16Bs)}</td>
                      <td style={{ textAlign: 'right', color: 'var(--motorven-red)' }}>{formatBs(totalesCompras.retencionIvaBs)}</td>
                      <td></td>
                      <td style={{ textAlign: 'right', color: 'var(--accent-amber)' }}>{formatBs(totalesCompras.retencionIslrBs)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      )}

      {/* ========================================================================= */}
      {/* 3. VISTA DECLARACIÓN Y RESUMEN DE IGTF (LEY DE IGTF) */}
      {/* ========================================================================= */}
      {reportType === 'IGTF' && (
        <div>
          <div className="card" style={{ marginBottom: '1.5rem', background: 'rgba(234, 179, 8, 0.05)', border: '1px solid rgba(234, 179, 8, 0.3)' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <AlertCircle color="var(--accent-amber)" size={24} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <h4 style={{ fontWeight: 700, color: 'var(--accent-amber)', marginBottom: '4px' }}>
                  Régimen de Percepción del Impuesto a las Grandes Transacciones Financieras (IGTF 3%)
                </h4>
                <p style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.4' }}>
                  Conforme al Artículo 13 de la Ley de Reforma Parcial del IGTF, los sujetos pasivos especiales fungen como agentes de percepción 
                  del 3% sobre los pagos recibidos en moneda extranjera o criptomonedas sin intermediación bancaria venezolana.
                  Este monto debe enterarse quincenalmente ante el SENIAT según el calendario fiscal.
                </p>
              </div>
            </div>
          </div>

          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800 }}>
                  Detalle de Transacciones Afectadas por IGTF ({mesFiltro})
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Total operaciones con cobro de IGTF: <strong>{igtfSales.length}</strong>
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Total IGTF Recaudado en el Período:</span>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--accent-amber)' }}>
                  {formatBs(totalesVentas.igtfBs)}
                </div>
              </div>
            </div>

            <div className="table-container">
              <table className="custom-table" style={{ fontSize: '0.85rem' }}>
                <thead>
                  <tr>
                    <th>N° Factura</th>
                    <th>N° Control</th>
                    <th>Fecha</th>
                    <th>Cliente / RIF</th>
                    <th>Método de Pago</th>
                    <th>Monto en Divisas ($)</th>
                    <th>Tasa BCV (Bs/$)</th>
                    <th>Base Afecta IGTF (Bs)</th>
                    <th>IGTF 3% (USD)</th>
                    <th>IGTF 3% Percibido (Bs)</th>
                  </tr>
                </thead>
                <tbody>
                  {igtfSales.length === 0 ? (
                    <tr>
                      <td colSpan="10" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        No existen operaciones con percepción de IGTF en el período {mesFiltro}.
                      </td>
                    </tr>
                  ) : (
                    igtfSales.map((s) => {
                      const tasa = s.tasaDolar || config.tasaDolar || 827.73;
                      const baseDivisas = s.totalUsd || 0;
                      const baseBs = baseDivisas * tasa;
                      return (
                        <tr key={s.id}>
                          <td><strong style={{ color: 'var(--accent-primary)' }}>{s.numeroDoc}</strong></td>
                          <td><code>{s.numeroControl || '-'}</code></td>
                          <td>{new Date(s.fecha).toLocaleDateString()}</td>
                          <td>{s.clienteNombre} <br/><small className="text-muted">{s.clienteRif}</small></td>
                          <td><span className="badge badge-warning">{s.metodoPago || 'DIVISAS_EFECTIVO'}</span></td>
                          <td>{formatUsd(baseDivisas)}</td>
                          <td><code>{formatNumberVe(tasa)}</code></td>
                          <td>{formatBs(baseBs)}</td>
                          <td style={{ fontWeight: 700, color: 'var(--accent-amber)' }}>{formatUsd(s.igtfUsd || 0)}</td>
                          <td style={{ fontWeight: 800, color: 'var(--accent-amber)' }}>{formatBs(s.igtfBs || (s.igtfUsd * tasa))}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. VISTA PORTAL SENIAT (DESCARGA DE ARCHIVOS TXT Y XML OFICIALES) */}
      {/* ========================================================================= */}
      {reportType === 'EXPORT_SENIAT' && (
        <div>
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '0.25rem' }}>
              Generación de Archivos para Declaración Masiva en Portal SENIAT
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Módulos certificados de exportación electrónica conforme a las especificaciones técnicas publicadas en www.seniat.gob.ve
            </p>
          </div>

          {seniatExportFeedback && (
            <div
              style={{
                marginBottom: '1.25rem',
                padding: '0.85rem 1rem',
                borderRadius: 'var(--radius-sm)',
                background: seniatExportFeedback.type === 'error'
                  ? 'rgba(239, 68, 68, 0.12)'
                  : (seniatExportFeedback.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)'),
                border: `1px solid ${seniatExportFeedback.type === 'error' ? '#ef4444' : (seniatExportFeedback.type === 'success' ? '#10b981' : '#f59e0b')}`,
                fontSize: '0.84rem',
                fontWeight: 600
              }}
            >
              {seniatExportFeedback.text}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {/* Card TXT IVA */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderTop: '4px solid var(--motorven-red)' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--motorven-red)' }}>
                    <FileText size={22} />
                  </div>
                  <div>
                    <h4 style={{ fontWeight: 800, fontSize: '1rem' }}>Retenciones de IVA (.TXT)</h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Providencia Administrativa SNAT/2013/00030</span>
                  </div>
                </div>

                <p style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.4', marginBottom: '1rem' }}>
                  Genera el archivo en texto plano con <strong>16 campos separados por tabuladores</strong> exigido para el módulo de <em>"Retenciones de IVA - Transmisión Masiva"</em> del portal fiscal.
                </p>

                <div style={{ background: 'var(--bg-tertiary)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', marginBottom: '1rem' }}>
                  <div>• <strong>Comprobantes válidos en el período:</strong> {eligibleVatRetentions.length} de {filteredPurchases.length} compras</div>
                  <div>• <strong>Monto total retenido:</strong> <span style={{ color: 'var(--motorven-red)', fontWeight: 700 }}>{formatBs(totalesCompras.retencionIvaBs)}</span></div>
                  <div>• <strong>Formato de archivo:</strong> <code>RIF_AAAAMM_RET_IVA.txt</code></div>
                </div>
              </div>

              <button
                className="btn btn-primary"
                onClick={handleDownloadSeniatTxt}
                style={{ width: '100%', justifyContent: 'center', gap: '8px' }}
              >
                <Download size={18} /> Descargar Archivo TXT para SENIAT
              </button>
            </div>

            {/* Card XML ISLR */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderTop: '4px solid var(--accent-emerald)' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-emerald)' }}>
                    <FileCode size={22} />
                  </div>
                  <div>
                    <h4 style={{ fontWeight: 800, fontSize: '1rem' }}>Retenciones de ISLR (.XML)</h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Decreto N° 1.808 (Reglamento de Retenciones de ISLR)</span>
                  </div>
                </div>

                <p style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.4', marginBottom: '1rem' }}>
                  Genera el archivo <strong>XML bajo codificación ISO-8859-1</strong> con el nodo raíz <code>&lt;RelacionRetencionesISLR&gt;</code> conectado a los comprobantes reales registrados.
                </p>

                <div style={{ background: 'var(--bg-tertiary)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', marginBottom: '1rem' }}>
                  <div>• <strong>Comprobantes ISLR en el período:</strong> {filteredIslrWithholdings.length} comprobante(s)</div>
                  <div>• <strong>Monto total retenido:</strong> <span style={{ color: 'var(--accent-emerald)', fontWeight: 700 }}>{formatBs(filteredIslrWithholdings.reduce((acc, w) => acc + Number(w.montoRetenido || 0) * (String(w.moneda || 'BS').toUpperCase() === 'USD' ? Number(w.tasaCambio || safeConfig.tasaDolar || 1) : 1), 0))}</span></div>
                  <div>• <strong>Formato de archivo:</strong> <code>RIF_AAAAMM_ISLR.xml</code></div>
                </div>
              </div>

              <button
                className="btn btn-secondary"
                onClick={handleDownloadSeniatXml}
                style={{ width: '100%', justifyContent: 'center', gap: '8px', borderColor: 'var(--accent-emerald)', color: 'var(--accent-emerald)' }}
              >
                <Download size={18} /> Descargar Archivo XML para SENIAT
              </button>
            </div>

            {/* Card Validación y Auditoría */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', borderTop: '4px solid var(--accent-amber)' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1rem' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', background: 'rgba(234, 179, 8, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-amber)' }}>
                    <ShieldCheck size={22} />
                  </div>
                  <div>
                    <h4 style={{ fontWeight: 800, fontSize: '1rem' }}>Auditoría y Certificación</h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>C.O.T. y Providencia 00071</span>
                  </div>
                </div>

                <div style={{ fontSize: '0.85rem', color: '#94a3b8', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: 'var(--accent-emerald)', fontWeight: 'bold' }}>✓</span>
                    <span>Algoritmo Módulo 11 en RIFs activo</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: 'var(--accent-emerald)', fontWeight: 'bold' }}>✓</span>
                    <span>Correlativos y N° de Control independientes</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: 'var(--accent-emerald)', fontWeight: 'bold' }}>✓</span>
                    <span>Comprobantes de Retención 14 dígitos (AAAAMMDDDDDDDD)</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: 'var(--accent-emerald)', fontWeight: 'bold' }}>✓</span>
                    <span>Trazabilidad BCV y segregación multimoneda</span>
                  </div>
                </div>
              </div>

              <div style={{ padding: '0.75rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: 'var(--radius-sm)', textAlign: 'center', fontSize: '0.8rem', color: 'var(--accent-emerald)', fontWeight: 700 }}>
                Sistema Preparado para Fiscalización SENIAT
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. VISTA CIERRES FISCALES: REPORTE X Y REPORTE Z (SNAT/2011/00071) */}
      {/* ========================================================================= */}
      {reportType === 'CIERRES_FISCALES' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {openDatesCount > 1 && (
            <div style={{ padding: '0.9rem 1rem', borderRadius: 'var(--radius-sm)', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.45)', fontSize: '0.82rem', color: '#fcd34d' }}>
              <strong>Aviso de Saneamiento Histórico:</strong> Hay {openSales.length} documento(s) fiscal(es) abierto(s) distribuidos en <strong>{openDatesCount} fecha(s) distintas</strong> sin Cierre Z asignado. Se recomienda conciliar/cerrar por fecha el histórico antes de emitir el próximo Cierre Z operativo.
            </div>
          )}

          {/* PANEL DE CONTROL DEL TURNO / JORNADA ACTIVA */}
          <div className="bento-card" style={{ borderLeft: '4px solid var(--motorven-red)' }}>
            <div className="bento-card-header" style={{ marginBottom: '1.25rem' }}>
              <div>
                <span className="bento-card-header-title">
                  <Clock size={18} color="var(--motorven-red)" />
                  Jornada Fiscal Activa - Auditoría en Vivo
                </span>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                  Documentos y operaciones acumuladas desde el último Cierre Diario Z (Providencia SNAT/2011/00071)
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <button className="btn btn-secondary btn-sm" onClick={handleOpenReporteX} style={{ fontSize: '0.82rem' }}>
                  <Receipt size={16} /> Generar Reporte X (Corte Parcial)
                </button>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setZConfirmCheck(false);
                    setShowZConfirmModal(true);
                  }}
                  style={{
                    background: 'var(--motorven-red)',
                    borderColor: 'var(--motorven-red)',
                    fontSize: '0.82rem'
                  }}
                >
                  <Lock size={16} /> Ejecutar Cierre Z (Definitivo)
                </button>
              </div>
            </div>

            {/* 4 KPIs Bento de la Jornada Activa */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem' }}>
              <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-code)' }}>Documentos en Turno</div>
                <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.4rem', fontWeight: 900, marginTop: '2px', color: 'var(--text-primary)' }}>
                  {openSales.length}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                  {corteXActual.cantidadFacturas} Fact. | {corteXActual.cantidadNc} NC | {corteXActual.cantidadNd} ND
                </div>
              </div>

              <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-code)' }}>Ventas Brutas Pendientes</div>
                <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.4rem', fontWeight: 900, marginTop: '2px', color: 'var(--semaforo-verde)' }}>
                  {formatBs(corteXActual.totalVentasBs)}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                  Ref: {formatUsd(corteXActual.totalVentasUsd)}
                </div>
              </div>

              <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-code)' }}>Débito Fiscal Acumulado</div>
                <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.4rem', fontWeight: 900, marginTop: '2px', color: 'var(--motorven-navy-light)' }}>
                  {formatBs(corteXActual.totalDebitoFiscalBs)}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                  IVA 16%: {formatBs(corteXActual.debitoGeneralBs)}
                </div>
              </div>

              <div style={{ background: 'var(--bg-tertiary)', padding: '1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)' }}>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'var(--font-code)' }}>Percepción IGTF (3%)</div>
                <div style={{ fontFamily: 'var(--font-tech)', fontSize: '1.4rem', fontWeight: 900, marginTop: '2px', color: 'var(--motorven-gold)' }}>
                  {formatBs(corteXActual.totalIgtfBs)}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                  Base: {formatBs(corteXActual.baseIgtfBs)}
                </div>
              </div>
            </div>
          </div>

          {/* HISTÓRICO DE CIERRES FISCALES Z Y MEMORIA FISCAL DIGITAL */}
          <div className="bento-card">
            <div className="bento-card-header">
              <span className="bento-card-header-title">
                <ShieldCheck size={18} color="var(--semaforo-verde)" />
                Registro Legal de Cierres Diarios Z & Memoria Fiscal Digital
              </span>
              <span className="badge badge-success" style={{ fontSize: '0.68rem', fontFamily: 'var(--font-code)' }}>
                {fiscalClosures.filter(c => c.tipo === 'Z').length} Cierres Emitidos
              </span>
            </div>

            <div className="table-container">
              <table className="custom-table" style={{ fontSize: '0.82rem' }}>
                <thead>
                  <tr>
                    <th style={{ fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>CORRELATIVO Z</th>
                    <th style={{ fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>FECHA / HORA</th>
                    <th style={{ fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>RANGO FACTURAS</th>
                    <th style={{ textAlign: 'center', fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>DOCS</th>
                    <th style={{ textAlign: 'right', fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>TOTAL VENTAS (BS.)</th>
                    <th style={{ textAlign: 'right', fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>DÉBITO FISCAL</th>
                    <th style={{ textAlign: 'right', fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>IGTF (3%)</th>
                    <th style={{ textAlign: 'right', fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>GRAN TOTAL HISTÓRICO</th>
                    <th style={{ textAlign: 'center', fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>INTEGRIDAD SHA-256</th>
                    <th style={{ textAlign: 'center', fontFamily: 'var(--font-code)', fontSize: '0.72rem' }}>ACCIONES</th>
                  </tr>
                </thead>
                <tbody>
                  {fiscalClosures.length === 0 ? (
                    <tr>
                      <td colSpan="10" style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                        No se registran Cierres Fiscales Z archivados.
                      </td>
                    </tr>
                  ) : (
                    fiscalClosures.map((cierre) => {
                      const fechaCierreObj = new Date(cierre.fechaCierre || new Date());
                      const isZ = cierre.tipo === 'Z';

                      return (
                        <tr key={cierre.id}>
                          <td>
                            <strong style={{ fontFamily: 'var(--font-tech)', color: isZ ? 'var(--motorven-red)' : 'var(--motorven-gold)' }}>
                              {isZ ? `Z-${String(cierre.numeroZ || 1).padStart(8, '0')}` : cierre.id}
                            </strong>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{fechaCierreObj.toLocaleDateString('es-VE')}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                              {fechaCierreObj.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </td>
                          <td style={{ fontFamily: 'var(--font-code)', fontSize: '0.75rem' }}>
                            {cierre.primeraFactura && cierre.primeraFactura !== '---'
                              ? `${cierre.primeraFactura} ➔ ${cierre.ultimaFactura}`
                              : 'Sin Facturas'}
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>
                            {cierre.totalDocumentos || 0}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 800, fontFamily: 'var(--font-tech)', color: 'var(--semaforo-verde)' }}>
                            {formatBs(cierre.totalVentasBs || 0)}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-code)', color: 'var(--text-primary)' }}>
                            {formatBs(cierre.totalDebitoFiscalBs || 0)}
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-code)', color: 'var(--motorven-gold)' }}>
                            {formatBs(cierre.totalIgtfBs || 0)}
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 900, fontFamily: 'var(--font-tech)', color: 'var(--motorven-gold)' }}>
                            {formatBs(cierre.granTotalHistoricoBs || cierre.totalVentasBs || 0)}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span
                              className="badge badge-success"
                              title={`Firma Criptográfica SHA-256:\n${cierre.firmaHashSha256 || 'N/A'}`}
                              style={{ fontSize: '0.65rem', display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                            >
                              <ShieldCheck size={12} />
                              {(cierre.firmaHashSha256 || 'HASH').substring(0, 8)}...
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              className="btn btn-print-report btn-sm"
                              onClick={() => {
                                setCurrentTicketClosure(cierre);
                                generateTaxReportPDF({
                                  reportType: cierre.tipo === 'Z' ? 'CIERRE_Z' : 'CIERRE_X',
                                  period: mesFiltro,
                                  fiscalClosures: [cierre],
                                  config: safeConfig,
                                  currentUser
                                });
                                setShowTicketModal(true);
                              }}
                              style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                            >
                              <Printer size={13} color="#ffffff" /> Imprimir Reporte
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN DE CIERRE DEFINITIVO Z */}
      {showZConfirmModal && (
        <div className="modal-overlay" onClick={() => setShowZConfirmModal(false)} style={{ zIndex: 1100 }}>
          <div className="bento-card modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px', padding: '1.5rem' }}>
            <div className="bento-card-header" style={{ marginBottom: '1.25rem' }}>
              <span className="bento-card-header-title">
                <ShieldAlert size={20} color="var(--motorven-red)" />
                Confirmación Legal de Cierre Fiscal Diario (Reporte Z)
              </span>
              <button className="close-btn" onClick={() => setShowZConfirmModal(false)}>×</button>
            </div>

            {/* Advertencia Legal */}
            <div style={{ background: 'var(--semaforo-rojo-bg)', border: '1px solid rgba(230,0,18,0.35)', borderRadius: 'var(--radius-sm)', padding: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <ShieldAlert size={24} color="var(--motorven-red)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <div style={{ fontWeight: 800, color: 'var(--motorven-red)', fontSize: '0.9rem', marginBottom: '4px' }}>
                    OPERACIÓN IRREVERSIBLE Y VINCULANTE (SNAT/2011/00071)
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-primary)', lineHeight: '1.4' }}>
                    La emisión del <strong>Reporte Z</strong> concluye formalmente la jornada comercial. Todas las facturas y notas emitidas quedarán <strong>consolidadas, bloqueadas y protegidas criptográficamente</strong>, incorporándose al Gran Total Histórico.
                  </p>
                </div>
              </div>
            </div>

            {/* Resumen del Cierre a Emitir */}
            <div style={{ background: 'var(--bg-tertiary)', padding: '0.85rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Documentos a Consolidar:</span>
                <strong>{openSales.length} documento(s)</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Monto Total Facturado:</span>
                <strong style={{ color: 'var(--semaforo-verde)', fontFamily: 'var(--font-tech)' }}>{formatBs(corteXActual.totalVentasBs)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Total Débito Fiscal:</span>
                <strong style={{ color: 'var(--motorven-navy-light)' }}>{formatBs(corteXActual.totalDebitoFiscalBs)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Tasa Oficial de Liquidación:</span>
                <span style={{ fontFamily: 'var(--font-code)', color: 'var(--motorven-gold)', fontWeight: 700 }}>{formatBs(corteXActual.tasaBcv)} / USD</span>
              </div>
            </div>

            {/* Checkbox de Confirmación Explícita */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-primary)', marginBottom: '1.5rem' }}>
              <input
                type="checkbox"
                checked={zConfirmCheck}
                onChange={(e) => setZConfirmCheck(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--motorven-red)', cursor: 'pointer' }}
              />
              <span>Confirmo y autorizo la emisión legal del Cierre Diario Z.</span>
            </label>

            {/* Botones de Acción */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowZConfirmModal(false)} disabled={isClosingZ}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmCierreZ}
                disabled={!zConfirmCheck || isClosingZ}
                style={{
                  background: 'var(--motorven-red)',
                  borderColor: 'var(--motorven-red)',
                  gap: '6px'
                }}
              >
                <Lock size={15} />
                {isClosingZ ? 'Procesando Cierre Z...' : 'Confirmar y Emitir Reporte Z'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE TICKET FISCAL SENIAT */}
      {showTicketModal && currentTicketClosure && (
        <FiscalTicketModal
          closure={currentTicketClosure}
          config={config}
          currentUser={currentUser}
          onClose={() => setShowTicketModal(false)}
        />
      )}

      {/* MODAL DE RETENCIONES ISLR SENIAT & ÓRDENES DE PAGO PROFIT */}
      {showIslrModal && (
        <IslrWithholdingModal
          isOpen={showIslrModal}
          onClose={() => setShowIslrModal(false)}
          islrConcepts={profitIslrConcepts}
          beneficiaries={profitBeneficiaries}
          paymentOrders={profitPaymentOrders}
          withholdings={profitIslrWithholdings}
          accountsPayable={profitAccountsPayable}
          purchases={unifiedPurchases}
          suppliers={suppliers}
          profitSuppliers={profitSuppliers}
          config={config}
          currentUser={currentUser}
          onRefresh={onSyncProfit}
        />
      )}
    </div>
  );
}

