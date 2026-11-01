import React, { useState } from 'react';
import {
  Printer,
  Copy,
  Download,
  X,
  ShieldCheck,
  Check,
  FileText,
  Calendar,
  Lock,
  Receipt
} from 'lucide-react';
import { formatFiscalTicketText } from '../services/fiscalService';
import { formatBs, formatUsd } from '../services/formatService';
import { generateTaxReportPDF } from '../services/pdfReportService';

export default function FiscalTicketModal({ closure, config = {}, currentUser = null, onClose }) {
  const [copied, setCopied] = useState(false);
  const [paperWidth, setPaperWidth] = useState('80mm'); // '80mm' | '58mm'

  if (!closure) return null;

  const isZ = closure.tipo === 'Z';
  const rawTicketText = formatFiscalTicketText(closure, config);

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(rawTicketText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('Error copiando al portapapeles:', e);
    }
  };

  const handleDownloadTxt = () => {
    const filename = `${isZ ? 'REPORTE_Z' : 'REPORTE_X'}_${isZ ? String(closure.numeroZ).padStart(8, '0') : closure.id}_${new Date().toISOString().slice(0, 10)}.txt`;
    const blob = new Blob([rawTicketText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    generateTaxReportPDF({
      sales: [],
      purchases: [],
      fiscalClosures: [closure],
      config,
      currentUser,
      reportType: isZ ? 'CIERRE_Z' : 'CIERRE_X'
    });
  };

  const fechaObj = new Date(closure.fechaCierre || new Date());
  const fechaStr = fechaObj.toLocaleDateString('es-VE');
  const horaStr = fechaObj.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1050 }}>
      {/* Estilos específicos de impresión térmica */}
      <style>{`
        @page {
          size: ${paperWidth === '80mm' ? '80mm auto' : '58mm auto'};
          margin: 0;
        }
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
          }
          body * {
            visibility: hidden;
          }
          #printable-fiscal-ticket, #printable-fiscal-ticket * {
            visibility: visible;
          }
          #printable-fiscal-ticket {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: ${paperWidth === '80mm' ? '76mm' : '52mm'} !important;
            margin: 0 auto !important;
            padding: 2mm 1mm !important;
            background: #fff !important;
            color: #000 !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            height: auto !important;
            overflow: visible !important;
            font-size: ${paperWidth === '80mm' ? '11px' : '9px'} !important;
            line-height: 1.3 !important;
            page-break-inside: avoid;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div
        className="bento-card modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '560px',
          width: '95%',
          maxHeight: '94vh',
          height: '92vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.25rem',
          boxSizing: 'border-box'
        }}
      >
        {/* Cabecera del Modal */}
        <div className="bento-card-header no-print" style={{ marginBottom: '0.75rem', flexShrink: 0 }}>
          <span className="bento-card-header-title">
            {isZ ? <Lock size={18} color="var(--motorven-red)" /> : <Receipt size={18} color="var(--motorven-gold)" />}
            {isZ ? 'TICKET FISCAL OFICIAL - REPORTE Z' : 'CORTE DE TURNO - REPORTE X'}
          </span>
          <button className="close-btn" onClick={onClose} title="Cerrar modal">×</button>
        </div>

        {/* Barra de Controles de Impresión y Formato */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.85rem', flexShrink: 0 }}>
          {/* Selector de Ancho */}
          <div style={{ display: 'flex', background: 'var(--bg-tertiary)', padding: '2px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)' }}>
            <button
              className="btn btn-sm"
              onClick={() => setPaperWidth('80mm')}
              style={{
                background: paperWidth === '80mm' ? 'var(--motorven-red)' : 'transparent',
                color: paperWidth === '80mm' ? '#fff' : 'var(--text-secondary)',
                fontSize: '0.72rem',
                padding: '3px 10px',
                fontWeight: paperWidth === '80mm' ? 700 : 500
              }}
            >
              80 mm (Estándar)
            </button>
            <button
              className="btn btn-sm"
              onClick={() => setPaperWidth('58mm')}
              style={{
                background: paperWidth === '58mm' ? 'var(--motorven-red)' : 'transparent',
                color: paperWidth === '58mm' ? '#fff' : 'var(--text-secondary)',
                fontSize: '0.72rem',
                padding: '3px 10px',
                fontWeight: paperWidth === '58mm' ? 700 : 500
              }}
            >
              58 mm (POS Móvil)
            </button>
          </div>

          {/* Botones de Acción */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <button className="btn btn-secondary btn-sm" onClick={handleCopyText} title="Copiar texto plano">
              {copied ? <Check size={14} color="var(--semaforo-verde)" /> : <Copy size={14} />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
            <button className="btn btn-secondary btn-sm" onClick={handleDownloadTxt} title="Descargar archivo TXT">
              <Download size={14} /> TXT
            </button>
            <button className="btn btn-print-report btn-sm" onClick={handlePrint} title="Enviar a la impresora o generar PDF">
              <Printer size={14} color="#ffffff" /> Imprimir Reporte
            </button>
          </div>
        </div>

        {/* Área de Visualización del Ticket Térmico */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            background: 'var(--bg-deep, #070d18)',
            padding: '1.25rem 1rem 2rem 1rem',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}
        >
          <div
            id="printable-fiscal-ticket"
            style={{
              width: paperWidth === '80mm' ? '360px' : '290px',
              maxWidth: '100%',
              background: '#ffffff',
              color: '#000000',
              padding: '1.5rem 1.25rem',
              borderRadius: '6px',
              fontFamily: "'JetBrains Mono', 'Courier New', monospace",
              fontSize: paperWidth === '80mm' ? '0.78rem' : '0.68rem',
              lineHeight: 1.4,
              boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
              borderTop: isZ ? '5px solid #cc0010' : '5px solid #d97706',
              boxSizing: 'border-box',
              flexShrink: 0,
              height: 'auto',
              minHeight: 'fit-content'
            }}
          >
            {/* Encabezado Legal SENIAT */}
            <div style={{ textAlign: 'center', marginBottom: '8px' }}>
              <div style={{ fontWeight: 900, fontSize: '0.95em' }}>{(config.nombreEmpresa || 'GRUPO MOTORVEN, C.A.').toUpperCase()}</div>
              <div style={{ fontWeight: 700 }}>RIF: {(config.rif || 'J-31115365-9').toUpperCase()}</div>
              <div style={{ fontSize: '0.85em', color: '#333' }}>{config.direccion || 'ZONA IND. III, BARQUISIMETO / CARACAS'}</div>
              <div style={{ fontSize: '0.82em', fontWeight: 700, marginTop: '2px' }}>PROVIDENCIA SNAT/2011/00071</div>
            </div>

            <div style={{ borderTop: '2px dashed #000', margin: '6px 0' }} />

            {/* Rótulo de Reporte */}
            <div style={{ textAlign: 'center', fontWeight: 900, padding: '2px 0' }}>
              {isZ ? '*** REPORTE Z - CIERRE FISCAL DIARIO ***' : '*** REPORTE X - CORTE DE TURNO ***'}
            </div>
            <div style={{ textAlign: 'center', fontWeight: 800, fontSize: '1.05em' }}>
              {isZ ? `REPORTE Z N°: ${String(closure.numeroZ || 1).padStart(8, '0')}` : `CORTE: ${closure.id}`}
            </div>

            <div style={{ borderTop: '2px dashed #000', margin: '6px 0' }} />

            {/* Metadata de Emisión */}
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>FECHA:</span>
              <strong>{fechaStr}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>HORA:</span>
              <strong>{horaStr}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>OPERADOR:</span>
              <span>{(closure.usuarioNombre || 'ADMIN').toUpperCase()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>TASA OFICIAL BCV:</span>
              <strong>Bs. {Number(closure.tasaBcv || 827.73).toFixed(2)} / USD</strong>
            </div>

            <div style={{ borderTop: '1px dashed #666', margin: '6px 0' }} />

            {/* Rango de Documentos */}
            <div style={{ textAlign: 'center', fontWeight: 800, fontSize: '0.9em' }}>RANGO DE DOCUMENTOS EMITIDOS</div>
            <div style={{ borderTop: '1px dashed #666', margin: '4px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>PRIMERA FACTURA:</span>
              <strong>{closure.primeraFactura || '---'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>ÚLTIMA FACTURA:</span>
              <strong>{closure.ultimaFactura || '---'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>TOTAL FACTURAS:</span>
              <strong>{closure.cantidadFacturas || 0}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>NOTAS DE CRÉDITO:</span>
              <span>{closure.cantidadNc || 0}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>NOTAS DE DÉBITO:</span>
              <span>{closure.cantidadNd || 0}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
              <span>TOTAL DOCUMENTOS:</span>
              <span>{closure.totalDocumentos || 0}</span>
            </div>

            <div style={{ borderTop: '1px dashed #666', margin: '6px 0' }} />

            {/* Desglose de Bases Imponibles y Débitos */}
            <div style={{ textAlign: 'center', fontWeight: 800, fontSize: '0.9em' }}>BASES IMPONIBLES Y DÉBITOS</div>
            <div style={{ borderTop: '1px dashed #666', margin: '4px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>VENTAS EXENTAS (E):</span>
              <span>{formatBs(closure.ventasExentasBs || 0)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>BASE GENERAL (16%):</span>
              <span>{formatBs(closure.baseGeneralBs || 0)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>DÉBITO FISCAL (16%):</span>
              <strong>{formatBs(closure.debitoGeneralBs || 0)}</strong>
            </div>

            {(closure.baseReducidaBs > 0 || closure.debitoReducidoBs > 0) && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>BASE REDUCIDA (8%):</span>
                  <span>{formatBs(closure.baseReducidaBs || 0)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>DÉBITO FISCAL (8%):</span>
                  <strong>{formatBs(closure.debitoReducidoBs || 0)}</strong>
                </div>
              </>
            )}

            <div style={{ borderTop: '1px dotted #888', margin: '4px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800 }}>
              <span>TOTAL DÉBITO FISCAL:</span>
              <span>{formatBs(closure.totalDebitoFiscalBs || 0)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
              <span>PERCEPCIÓN IGTF (3%):</span>
              <span>{formatBs(closure.totalIgtfBs || 0)}</span>
            </div>

            <div style={{ borderTop: '2px solid #000', margin: '6px 0' }} />

            {/* Totales Facturados */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.05em', fontWeight: 900 }}>
              <span>TOTAL FACTURADO:</span>
              <span>{formatBs(closure.totalVentasBs || 0)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9em', color: '#333' }}>
              <span>REF. DÓLARES:</span>
              <span>{formatUsd(closure.totalVentasUsd || 0)}</span>
            </div>

            <div style={{ borderTop: '2px solid #000', margin: '6px 0' }} />

            {/* Desglose de Medios de Pago */}
            <div style={{ textAlign: 'center', fontWeight: 800, fontSize: '0.9em' }}>MEDIOS DE PAGO RECIBIDOS</div>
            <div style={{ borderTop: '1px dashed #666', margin: '4px 0' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>EFECTIVO USD:</span>
              <span>{formatBs(closure.desglosePagos?.EFECTIVO_USD || 0)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>PAGO MÓVIL:</span>
              <span>{formatBs(closure.desglosePagos?.PAGO_MOVIL || 0)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>TRANSFERENCIA BS:</span>
              <span>{formatBs(closure.desglosePagos?.TRANSFERENCIA_BS || 0)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>PUNTO DE VENTA:</span>
              <span>{formatBs(closure.desglosePagos?.PUNTO_VENTA || 0)}</span>
            </div>
            {((closure.desglosePagos?.ZELLE || 0) + (closure.desglosePagos?.OTROS || 0)) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>ZELLE / OTROS:</span>
                <span>{formatBs((closure.desglosePagos?.ZELLE || 0) + (closure.desglosePagos?.OTROS || 0))}</span>
              </div>
            )}

            {/* Bloque Exclusivo de Cierre Z: Memoria Fiscal y Hash Criptográfico */}
            {isZ && (
              <>
                <div style={{ borderTop: '2px dashed #000', margin: '8px 0' }} />
                <div style={{ textAlign: 'center', fontWeight: 900, fontSize: '0.95em' }}>MEMORIA FISCAL DIGITAL</div>
                <div style={{ borderTop: '1px dashed #666', margin: '4px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1em' }}>
                  <span>GRAN TOTAL HISTÓRICO:</span>
                  <span>{formatBs(closure.granTotalHistoricoBs || 0)}</span>
                </div>
                <div style={{ borderTop: '1px dashed #666', margin: '6px 0' }} />
                <div style={{ textAlign: 'center', fontSize: '0.8em', color: '#444' }}>FIRMA DIGITAL DE INTEGRIDAD (SHA-256)</div>
                <div style={{ wordBreak: 'break-all', fontSize: '0.72em', textAlign: 'center', background: '#f5f5f5', padding: '4px', borderRadius: '3px', marginTop: '2px', border: '1px solid #ddd' }}>
                  {closure.firmaHashSha256 || 'HASH-INMUTABLE-SENIAT'}
                </div>
              </>
            )}

            <div style={{ borderTop: '2px dashed #000', margin: '8px 0' }} />

            {/* Pie Legal Obligatorio */}
            <div style={{ textAlign: 'center', fontSize: '0.85em', fontWeight: 700 }}>
              COMPROBANTE DE CONTROL TRIBUTARIO
              <br />
              NO VÁLIDO COMO FACTURA
            </div>
          </div>
        </div>

        {/* Footer del Modal */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.85rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-glass)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <ShieldCheck size={16} color="var(--semaforo-verde)" />
            <span>Documento Inalterable bajo Providencia SNAT/2011/00071</span>
          </div>
          <button className="btn btn-secondary" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
