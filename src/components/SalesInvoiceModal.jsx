import React, { useState } from 'react';
import {
  Printer,
  Copy,
  Download,
  X,
  ShieldCheck,
  Check,
  FileText,
  Receipt,
  Plus,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  Layers,
  Truck
} from 'lucide-react';
import { formatSaleInvoiceTicketText } from '../services/fiscalService';
import { generateSalesPOSPDF, generateWarehouseDispatchGuidePDF, generateLetterInvoiceSeniatPDF, generateDeliveryNotePDF } from '../services/pdfReportService';
import motorvenLogo from '../assets/logo_motorven_limpio.png';

/**
 * Función que divide los renglones facturados en páginas tamaño Carta
 * respetando el margen superior de 4.5 cm y margen inferior de 4.5 cm (área útil: 189.4 mm).
 * - Si todos caben en 1 sola hoja (hasta 5 renglones con totales y firma), genera 1 sola página.
 * - Si rebasan la capacidad, divide en múltiples páginas mostrando la numeración "1/2", "2/2".
 */
function splitInvoiceItemsIntoPages(items) {
  const allItems = items || [];
  if (allItems.length <= 5) {
    return [allItems];
  }

  const pages = [];
  const totalItems = allItems.length;
  // Con márgenes de 4.5 cm superior e inferior, la primera página lleva hasta 5 ítems si son pocos o 6 si son muchos
  const firstPageCount = totalItems <= 8 ? Math.min(5, totalItems - 1) : 6;
  pages.push(allItems.slice(0, firstPageCount));

  let currentIndex = firstPageCount;
  while (currentIndex < totalItems) {
    const remainingCount = totalItems - currentIndex;
    // Si lo que queda cabe en la hoja final (máximo 5 ítems junto con totales y firma)
    if (remainingCount <= 5) {
      pages.push(allItems.slice(currentIndex));
      break;
    }
    // Si quedan más de 5, llenamos una página intermedia de hasta 7 ítems
    const take = Math.min(7, remainingCount - 1);
    pages.push(allItems.slice(currentIndex, currentIndex + take));
    currentIndex += take;
  }

  return pages;
}

export default function SalesInvoiceModal({ sale, config = {}, currentUser = null, onClose, onNewSale }) {
  const [copied, setCopied] = useState(false);
  const [paperWidth, setPaperWidth] = useState('80mm'); // '80mm' | '58mm'
  const [viewMode, setViewMode] = useState('CARTA'); // 'TICKET' | 'CARTA'
  const [zoomMode, setZoomMode] = useState('FIT'); // 'FIT' | 'REAL'
  const [activePage, setActivePage] = useState('ALL'); // 'ALL' | 0 | 1...

  if (!sale) return null;

  const safeConfig = config || {};
  const tasaBcv = Number(sale.tasaDolar || safeConfig.tasaDolar) || 827.73;
  const rawTicketText = formatSaleInvoiceTicketText(sale, safeConfig);

  const isNc = sale.tipoDoc === 'NOTA_CREDITO';
  const isNd = sale.tipoDoc === 'NOTA_DEBITO';
  const isNe = sale.tipoDoc === 'NOTA_ENTREGA';
  const isFacturaOrNotaEntrega = isNe || (!isNc && !isNd && sale.tipoDoc !== 'COTIZACION');
  const invoiceTotalBs = Number(sale.totalBs) || (Number(sale.totalUsd || 0) * tasaBcv);

  const docTitle = isNc
    ? 'NOTA DE CRÉDITO'
    : (isNd ? 'NOTA DE DÉBITO' : (isNe ? 'NOTA DE ENTREGA' : 'FACTURA FISCAL'));

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
    const filename = `${sale.tipoDoc || 'FACTURA'}_${sale.numeroDoc || '000000'}_${new Date().toISOString().slice(0, 10)}.txt`;
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

  const correlativoDisplay = String(sale.numeroDoc || sale.nroFactura || '000000').replace(/[^0-9]/g, '').slice(-6).padStart(6, '0') || '000000';

  const handlePrint = () => {
    if (viewMode === 'CARTA') {
      if (isNe) {
        generateDeliveryNotePDF({ sale, config: safeConfig, currentUser, autoPrint: true });
        return;
      }
      generateLetterInvoiceSeniatPDF({ sale, config: safeConfig, currentUser });
      return;
    }

    const printableEl = document.getElementById('printable-sale-invoice');
    if (!printableEl) {
      window.print();
      return;
    }

    const existingFrame = document.getElementById('invoice-print-frame');
    if (existingFrame) existingFrame.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'invoice-print-frame';
    iframe.style.position = 'fixed';
    iframe.style.top = '-9999px';
    iframe.style.left = '-9999px';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();

    const isCarta = viewMode === 'CARTA';
    const pageStyles = isCarta
      ? `
        @page {
          size: letter portrait;
          margin: 4.5cm 1.5cm 4.5cm 1.5cm;
        }
        :root, html, body {
          color-scheme: light !important;
        }
        * {
          box-sizing: border-box !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          box-shadow: none !important;
          text-shadow: none !important;
        }
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          background-color: #ffffff !important;
          color: #0f172a !important;
          font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        }
        .no-print, .carta-page-badge {
          display: none !important;
        }
        .no-screen {
          display: flex !important;
        }
        .carta-page-wrapper {
          width: 100% !important;
          margin: 0 !important;
          padding: 0 !important;
          page-break-after: always !important;
          break-after: page !important;
        }
        .carta-page-wrapper:last-child {
          page-break-after: avoid !important;
          break-after: avoid !important;
        }
        .carta-page {
          width: 100% !important;
          min-height: 0 !important;
          height: 178mm !important;
          max-height: 178mm !important;
          padding: 0 !important;
          margin: 0 !important;
          box-shadow: none !important;
          border: none !important;
          border-radius: 0 !important;
          display: flex !important;
          flex-direction: column !important;
          justify-content: space-between !important;
          overflow: hidden !important;
          background: transparent !important;
        }
        .carta-page:last-child {
          page-break-after: avoid !important;
          break-after: avoid !important;
        }
      `
      : `
        @page {
          size: ${paperWidth === '80mm' ? '80mm auto' : '58mm auto'};
          margin: 0;
        }
        :root, html, body {
          color-scheme: light !important;
        }
        * {
          box-sizing: border-box !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          box-shadow: none !important;
          text-shadow: none !important;
        }
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          background: #ffffff !important;
          background-color: #ffffff !important;
          color: #111827 !important;
          font-family: "Courier New", Courier, monospace !important;
        }
        .no-print {
          display: none !important;
        }
        #printable-sale-invoice {
          width: ${paperWidth === '80mm' ? '76mm' : '52mm'} !important;
          margin: 0 auto !important;
          padding: 2mm 1mm !important;
        }
      `;

    doc.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Factura ${correlativoDisplay}</title>
  <style>${pageStyles}</style>
</head>
<body style="margin: 0; padding: 0; background: #ffffff !important;">
  ${printableEl.outerHTML}
</body>
</html>`);
    doc.close();

    setTimeout(() => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (err) {
        console.error('Error al imprimir por iframe, usando print global:', err);
        window.print();
      } finally {
        setTimeout(() => {
          iframe.remove();
        }, 5000);
      }
    }, 300);
  };

  const handlePrintReport = () => {
    generateSalesPOSPDF({
      sales: [sale],
      config: safeConfig,
      currentUser,
      tipoDoc: docTitle
    });
  };

  const handlePrintWarehouseGuide = () => {
    generateWarehouseDispatchGuidePDF({
      sale,
      config: safeConfig,
      currentUser
    });
  };

  const fechaObj = new Date(sale.fechaEmision || sale.fecha || new Date());
  const fechaStr = fechaObj.toLocaleDateString('es-VE');
  const horaStr = fechaObj.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const diasCreditoDoc = sale.condicionPago === 'CONTADO' ? 0 : Number(sale.diasCredito ?? 0);
  const fechaVencObj = sale.fechaVencimiento
    ? new Date(sale.fechaVencimiento)
    : new Date(fechaObj.getTime() + (diasCreditoDoc * 24 * 60 * 60 * 1000));
  const fechaVencStr = fechaVencObj.toLocaleDateString('es-VE');

  // Paginación para formato Carta Vertical
  const pages = splitInvoiceItemsIntoPages(sale.items);
  const totalPages = pages.length;

  const getItemsSubtotal = (itemsList) => {
    return (itemsList || []).reduce((acc, it) => acc + (it.subtotalUsd || (it.cantidad * it.precioUsd)), 0);
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      {/* Estilos específicos de impresión térmica / carta con paginación */}
      <style>{`
        @page {
          size: ${viewMode === 'TICKET' ? (paperWidth === '80mm' ? '80mm auto' : '58mm auto') : 'letter portrait'};
          margin: ${viewMode === 'TICKET' ? '0' : '4.5cm 1.5cm 4.5cm 1.5cm'};
        }
        @media screen {
          .no-screen {
            display: none !important;
          }
        }
        @media print {
          :root, html, body {
            color-scheme: light !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            background-color: #ffffff !important;
            color: #0f172a !important;
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          /* Neutralizar TODOS los fondos oscuros del app y modales */
          #root, .modal-overlay, .modal-content, [class*="modal"], [class*="overlay"], div:not(.carta-page):not(.carta-page *) {
            background: transparent !important;
            background-color: transparent !important;
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
            box-shadow: none !important;
            border-color: transparent !important;
          }
          body * {
            visibility: hidden !important;
          }
          #printable-sale-invoice, #printable-sale-invoice * {
            visibility: visible !important;
          }
          #printable-sale-invoice {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: ${viewMode === 'TICKET' ? (paperWidth === '80mm' ? '76mm' : '52mm') : '100%'} !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: transparent !important;
            color: #0f172a !important;
            box-shadow: none !important;
            border: none !important;
            transform: none !important;
          }
          .carta-page-wrapper {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            page-break-after: always !important;
            break-after: page !important;
          }
          .carta-page-wrapper:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          .carta-page {
            width: 100% !important;
            min-height: 0 !important;
            height: 178mm !important;
            max-height: 178mm !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            box-sizing: border-box !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            overflow: hidden !important;
            background: transparent !important;
          }
          .carta-page:last-child {
            page-break-after: avoid !important;
            break-after: avoid !important;
          }
          .no-screen {
            display: flex !important;
          }
          .no-print, .carta-page-badge {
            display: none !important;
          }
        }
      `}</style>

      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: viewMode === 'CARTA' ? '920px' : '560px',
          width: '98%',
          maxHeight: '96vh',
          height: '95vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '1.1rem 1.25rem',
          boxSizing: 'border-box',
          transition: 'max-width 0.25s ease'
        }}
      >
        {/* Cabecera del Modal */}
        <div className="modal-header no-print" style={{ marginBottom: '0.65rem', flexShrink: 0, paddingBottom: '0.65rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'var(--semaforo-verde-bg)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--semaforo-verde)'
              }}
            >
              <ShieldCheck size={22} />
            </div>
            <div>
              <h3 className="modal-title" style={{ fontSize: '1.15rem', margin: 0 }}>
                {docTitle} Emitida Exitosamente
              </h3>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                N° Documento: <strong style={{ color: 'var(--text-primary)' }}>{sale.numeroDoc}</strong> | Control: <strong style={{ color: 'var(--motorven-red)' }}>{sale.numeroControl || '00-001043'}</strong>
                {totalPages > 1 && viewMode === 'CARTA' && (
                  <span style={{ marginLeft: '8px', color: '#60a5fa', fontWeight: 600 }}>
                    • Consta de {totalPages} páginas tamaño carta
                  </span>
                )}
              </div>
            </div>
          </div>
          <button className="close-btn" onClick={onClose} title="Cerrar ventana">×</button>
        </div>

        {/* Barra de Controles de Impresión, Formato y Zoom */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem', flexShrink: 0 }}>
          {/* Selector de Modo de Vista (Ticket vs Carta) */}
          <div style={{ display: 'flex', background: 'var(--bg-tertiary)', padding: '2px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)' }}>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setViewMode('TICKET')}
              style={{
                background: viewMode === 'TICKET' ? 'var(--motorven-red)' : 'transparent',
                color: viewMode === 'TICKET' ? '#fff' : 'var(--text-secondary)',
                fontSize: '0.72rem',
                padding: '4px 10px',
                fontWeight: viewMode === 'TICKET' ? 700 : 500
              }}
            >
              <Receipt size={13} style={{ marginRight: '4px' }} />
              Ticket Térmico (POS)
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setViewMode('CARTA')}
              style={{
                background: viewMode === 'CARTA' ? (isNe ? 'var(--semaforo-verde)' : 'var(--motorven-navy-light)') : 'transparent',
                color: viewMode === 'CARTA' ? '#fff' : 'var(--text-secondary)',
                fontSize: '0.72rem',
                padding: '4px 10px',
                fontWeight: viewMode === 'CARTA' ? 700 : 500
              }}
            >
              <FileText size={13} style={{ marginRight: '4px' }} />
              {isNe ? 'Nota de Entrega (Carta Vertical)' : 'Factura SENIAT (Carta Vertical)'}
            </button>
          </div>

          {/* Controles Específicos para Formato Carta: Zoom y Selector de Páginas */}
          {viewMode === 'CARTA' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              {/* Selector de Zoom (Ajustar a Pantalla vs Tamaño Real) */}
              <div style={{ display: 'flex', background: 'var(--bg-tertiary)', padding: '2px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)' }}>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setZoomMode('FIT')}
                  title="Ajusta la hoja completa al tamaño del monitor sin recortes"
                  style={{
                    background: zoomMode === 'FIT' ? 'var(--motorven-gold)' : 'transparent',
                    color: zoomMode === 'FIT' ? '#000' : 'var(--text-secondary)',
                    fontSize: '0.7rem',
                    padding: '3px 8px',
                    fontWeight: zoomMode === 'FIT' ? 700 : 500
                  }}
                >
                  <Minimize2 size={12} style={{ marginRight: '4px' }} />
                  Ajustar a Pantalla
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setZoomMode('REAL')}
                  title="Ver al 100% de escala real"
                  style={{
                    background: zoomMode === 'REAL' ? 'var(--motorven-gold)' : 'transparent',
                    color: zoomMode === 'REAL' ? '#000' : 'var(--text-secondary)',
                    fontSize: '0.7rem',
                    padding: '3px 8px',
                    fontWeight: zoomMode === 'REAL' ? 700 : 500
                  }}
                >
                  <Maximize2 size={12} style={{ marginRight: '4px' }} />
                  100% Real
                </button>
              </div>

              {/* Selector de Páginas cuando hay más de una hoja */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', background: 'var(--bg-tertiary)', padding: '2px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)' }}>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => setActivePage('ALL')}
                    style={{
                      background: activePage === 'ALL' ? '#3b82f6' : 'transparent',
                      color: activePage === 'ALL' ? '#fff' : 'var(--text-secondary)',
                      fontSize: '0.7rem',
                      padding: '3px 8px',
                      fontWeight: activePage === 'ALL' ? 700 : 500
                    }}
                  >
                    <Layers size={12} style={{ marginRight: '4px' }} />
                    Todas ({totalPages})
                  </button>
                  {pages.map((_, pIdx) => (
                    <button
                      key={pIdx}
                      type="button"
                      className="btn btn-sm"
                      onClick={() => setActivePage(pIdx)}
                      style={{
                        background: activePage === pIdx ? '#3b82f6' : 'transparent',
                        color: activePage === pIdx ? '#fff' : 'var(--text-secondary)',
                        fontSize: '0.7rem',
                        padding: '3px 7px',
                        fontWeight: activePage === pIdx ? 700 : 500
                      }}
                    >
                      {pIdx + 1}/{totalPages}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Sub-selector de Ancho en caso de Ticket */}
          {viewMode === 'TICKET' && (
            <div style={{ display: 'flex', background: 'var(--bg-tertiary)', padding: '2px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)' }}>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setPaperWidth('80mm')}
                style={{
                  background: paperWidth === '80mm' ? 'var(--motorven-gold)' : 'transparent',
                  color: paperWidth === '80mm' ? '#000' : 'var(--text-muted)',
                  fontSize: '0.7rem',
                  padding: '2px 8px',
                  fontWeight: 700
                }}
              >
                80mm
              </button>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setPaperWidth('58mm')}
                style={{
                  background: paperWidth === '58mm' ? 'var(--motorven-gold)' : 'transparent',
                  color: paperWidth === '58mm' ? '#000' : 'var(--text-muted)',
                  fontSize: '0.7rem',
                  padding: '2px 8px',
                  fontWeight: 700
                }}
              >
                58mm
              </button>
            </div>
          )}

          {/* Botones Rápidos de Exportación */}
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleCopyText}
              style={{ fontSize: '0.72rem', padding: '3px 8px' }}
              title="Copiar texto monoespaciado"
            >
              {copied ? <Check size={13} color="var(--semaforo-verde)" /> : <Copy size={13} />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleDownloadTxt}
              style={{ fontSize: '0.72rem', padding: '3px 8px' }}
              title="Descargar archivo TXT oficial"
            >
              <Download size={13} /> TXT
            </button>
            <button
              type="button"
              className="btn btn-sm"
              onClick={handlePrintWarehouseGuide}
              style={{
                fontSize: '0.75rem',
                padding: '4px 12px',
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: '#fff',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)'
              }}
              title="Generar e imprimir Guía de Despacho física para Almacén (sin precios, solo litros y verificación en rampa)"
            >
              <Truck size={14} color="#ffffff" /> Guía Almacén
            </button>
            {viewMode === 'CARTA' && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  if (isNe) {
                    generateDeliveryNotePDF({ sale, config: safeConfig, currentUser });
                  } else {
                    generateLetterInvoiceSeniatPDF({ sale, config: safeConfig, currentUser });
                  }
                }}
                style={{
                  fontSize: '0.75rem',
                  padding: '4px 10px',
                  background: isNe ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                  border: isNe ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(59, 130, 246, 0.4)',
                  color: isNe ? 'var(--semaforo-verde)' : '#60a5fa',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
                title={isNe ? "Descargar Nota de Entrega oficial tamaño Carta con desbordamiento y numeración" : "Descargar PDF oficial SENIAT con márgenes de 4.5 cm y correlativo de 6 dígitos"}
              >
                <Download size={13} /> {isNe ? 'Nota de Entrega PDF' : 'PDF Carta'}
              </button>
            )}
            <button
              type="button"
              className="btn btn-print-report btn-sm"
              onClick={handlePrint}
              style={{ fontSize: '0.75rem', padding: '4px 12px' }}
            >
              <Printer size={14} color="#ffffff" /> Imprimir Reporte
            </button>
          </div>
        </div>

        {/* CONTENEDOR DE VISUALIZACIÓN / IMPRESIÓN */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            background: 'rgba(0,0,0,0.45)',
            borderRadius: '12px',
            padding: viewMode === 'CARTA' ? (zoomMode === 'FIT' ? '1rem 0.5rem' : '1.5rem 1rem') : '1rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            boxSizing: 'border-box'
          }}
        >
          {/* ========================================================================= */}
          {/* MODO 1: TICKET TÉRMICO (80MM / 58MM) */}
          {/* ========================================================================= */}
          {viewMode === 'TICKET' && (
            <div
              id="printable-sale-invoice"
              style={{
                width: paperWidth === '80mm' ? '320px' : '240px',
                background: '#ffffff',
                color: '#111827',
                padding: '1.25rem 1rem',
                borderRadius: '6px',
                boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
                fontFamily: '"Courier New", Courier, monospace',
                fontSize: paperWidth === '80mm' ? '0.78rem' : '0.68rem',
                lineHeight: '1.35',
                border: '1px solid #d1d5db',
                boxSizing: 'border-box'
              }}
            >
              {/* Cabecera del Ticket */}
              <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                <strong style={{ fontSize: '1rem', display: 'block', letterSpacing: '0.5px' }}>
                  {safeConfig.nombreEmpresa || 'GRUPO MOTORVEN, C.A.'}
                </strong>
                <div style={{ fontSize: '0.75rem', color: '#4b5563' }}>
                  {safeConfig.marcaOficial || 'OILSTONE ® POR KEYSTONE, C.A.'}
                </div>
                <div style={{ fontSize: '0.75rem', fontWeight: 'bold' }}>
                  RIF: {safeConfig.rif || 'J-31115365-9'}
                </div>
                <div style={{ fontSize: '0.68rem', color: '#6b7280' }}>
                  {safeConfig.direccion || 'Zona Industrial III, Barquisimeto / Caracas'}
                </div>
                <div style={{ fontSize: '0.65rem', color: '#6b7280' }}>
                  SENIAT - Providencia SNAT/2011/00071
                </div>
              </div>

              <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }} />

              {/* Título del Documento y Correlativos */}
              <div style={{ textAlign: 'center', margin: '4px 0' }}>
                <strong style={{ fontSize: '0.95rem', letterSpacing: '1px' }}>
                  *** {docTitle} ***
                </strong>
                <div style={{ fontWeight: 'bold', fontSize: '0.88rem' }}>
                  N°: {sale.numeroDoc}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#374151' }}>
                  N° DE CONTROL: <strong>{sale.numeroControl || '00-001043'}</strong>
                </div>
              </div>

              {sale.documentoAfectado && (
                <div style={{ textAlign: 'center', color: '#b91c1c', fontWeight: 'bold', fontSize: '0.72rem', margin: '4px 0' }}>
                  AFECTA A FACTURA: {sale.documentoAfectado}
                </div>
              )}

              <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }} />

              {/* Datos de la Venta y Receptor */}
              <div style={{ fontSize: '0.72rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>EMISIÓN: {fechaStr}</span>
                  <span>VENCIMIENTO: {fechaVencStr}</span>
                </div>
                <div>CAJERO: {sale.vendedor || 'CAJA MOSTRADOR'}</div>
                <div>CONDICIÓN: {sale.condicionPago || 'CONTADO'} ({diasCreditoDoc} DÍAS) - {sale.metodoPago || 'EFECTIVO USD'}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>TASA BCV:</span>
                  <strong>Bs. {tasaBcv.toFixed(2)} / USD</strong>
                </div>
                <div style={{ borderBottom: '1px dotted #9ca3af', margin: '4px 0' }} />
                <div>CLIENTE: <strong>{sale.clienteNombre}</strong></div>
                <div>RIF/CI: <strong>{sale.clienteRif}</strong></div>
                <div style={{ fontSize: '0.68rem', color: '#4b5563' }}>DIREC: {sale.clienteDireccion || 'Barquisimeto, Edo. Lara'}</div>
              </div>

              <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }} />

              {/* Detalle de Artículos */}
              <div style={{ fontSize: '0.72rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', borderBottom: '1px solid #d1d5db', paddingBottom: '2px' }}>
                  <span>CANT x DESCRIPCIÓN</span>
                  <span>TOTAL ($)</span>
                </div>
                {(sale.items || []).map((item, idx) => (
                  <div key={idx} style={{ margin: '4px 0' }}>
                    <div style={{ fontWeight: '600' }}>
                      {item.cantidad} x {item.descripcion}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#4b5563' }}>
                      <span>P.U. ${formatUsd(item.precioUsd)} ({item.tipoAlicuota || '16%'})</span>
                      <strong style={{ color: '#111827' }}>{formatUsd(item.subtotalUsd || (item.cantidad * item.precioUsd))}</strong>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ borderBottom: '1px dashed #000', margin: '6px 0' }} />

              {/* Liquidación de Impuestos y Totales */}
              <div style={{ fontSize: '0.72rem', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {Number(sale.baseExentaBs || 0) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>VENTAS EXENTAS (E):</span>
                    <span>{formatBs(sale.baseExentaBs)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>BASE IMPONIBLE (G 16%):</span>
                  <span>{formatBs(sale.baseGeneralBs)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>DÉBITO FISCAL (16%):</span>
                  <span>{formatBs(sale.ivaGeneralBs || sale.ivaBs)}</span>
                </div>
                {Number(sale.baseReducidaBs || 0) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>IVA REDUCIDO (8%):</span>
                    <span>{formatBs(sale.ivaReducidaBs)}</span>
                  </div>
                )}
                {Number(sale.igtfBs || 0) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b45309' }}>
                    <span>PERCEPCIÓN IGTF (3%):</span>
                    <strong>{formatBs(sale.igtfBs)}</strong>
                  </div>
                )}
                {Number(sale.retencionIvaBs || 0) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#0369a1' }}>
                    <span>RETENCIÓN IVA:</span>
                    <span>-{formatBs(sale.retencionIvaBs)}</span>
                  </div>
                )}

                <div style={{ borderBottom: '1px double #000', margin: '4px 0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '0.88rem' }}>
                  <span>TOTAL USD:</span>
                  <span>{formatUsd(sale.totalUsd)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '0.88rem' }}>
                  <span>TOTAL BS:</span>
                  <span>{formatBs(sale.totalBs)}</span>
                </div>
              </div>

              <div style={{ borderBottom: '1px dashed #000', margin: '8px 0 6px 0' }} />

              {/* Pie Legal */}
              <div style={{ textAlign: 'center', fontSize: '0.62rem', color: '#6b7280', marginTop: '6px' }}>
                <div>DOCUMENTO FISCAL VENEZUELA</div>
                <div>GRACIAS POR SU COMPRA</div>
                <div style={{ fontWeight: 'bold', color: '#111827', marginTop: '2px' }}>
                  GRUPO MOTORVEN - LUBRICANTES
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODO 2: FACTURA LEGAL FORMATO CARTA SENIAT (VERTICAL CON PAGINACIÓN) */}
          {/* ========================================================================= */}
          {viewMode === 'CARTA' && (
            <div
              id="printable-sale-invoice"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '2.5rem',
                width: '100%',
                transform: zoomMode === 'FIT' ? 'scale(0.65)' : 'none',
                transformOrigin: 'top center',
                marginBottom: zoomMode === 'FIT' ? (totalPages > 1 && activePage === 'ALL' ? '-480px' : '-310px') : '1.5rem'
              }}
            >
              {pages.map((pageItems, pageIdx) => {
                const pageNumber = pageIdx + 1;
                const isFirstPage = pageIdx === 0;
                const isLastPage = pageIdx === totalPages - 1;
                const isVisibleOnScreen = activePage === 'ALL' || activePage === pageIdx;

                // Contar cuántos renglones se facturaron antes de esta hoja
                const itemsBefore = pages.slice(0, pageIdx).reduce((acc, p) => acc + p.length, 0);

                // Subtotales acumulados
                const currentAccumulatedUsd = getItemsSubtotal(sale.items.slice(0, itemsBefore + pageItems.length));
                const currentAccumulatedBs = currentAccumulatedUsd * tasaBcv;
                const prevAccumulatedUsd = getItemsSubtotal(sale.items.slice(0, itemsBefore));
                const prevAccumulatedBs = prevAccumulatedUsd * tasaBcv;

                return (
                  <div
                    key={pageIdx}
                    className={`carta-page-wrapper ${!isVisibleOnScreen ? 'no-screen' : ''}`}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      width: '100%'
                    }}
                  >
                    {/* Badge indicador de página en pantalla */}
                    {totalPages > 1 && (
                      <div
                        className="no-print carta-page-badge"
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          color: '#93c5fd',
                          background: 'rgba(30, 58, 138, 0.7)',
                          border: '1px solid rgba(147, 197, 253, 0.35)',
                          borderRadius: '20px',
                          padding: '3px 14px',
                          marginBottom: '10px',
                          letterSpacing: '0.5px'
                        }}
                      >
                        PÁGINA {pageNumber} / {totalPages} {isLastPage ? '— (Totales y Firma de Recepción)' : '— (Continuación de Renglones)'}
                      </div>
                    )}

                    {/* Hoja Tamaño Carta Individual (Márgenes SENIAT: Sup: 4.5cm, Inf: 4.5cm, Izq: 1.5cm, Der: 1.5cm) */}
                    <div
                      className="carta-page"
                      style={{
                        width: '760px',
                        minHeight: '1000px',
                        background: '#ffffff',
                        color: '#0f172a',
                        padding: '4.5cm 1.5cm 4.5cm 1.5cm',
                        borderRadius: '6px',
                        boxShadow: '0 12px 35px rgba(0,0,0,0.5)',
                        fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
                        fontSize: '0.78rem',
                        lineHeight: '1.4',
                        boxSizing: 'border-box',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        position: 'relative'
                      }}
                    >
                      {/* Guías visuales informativas solo en pantalla (ocultas en impresión) */}
                      <div
                        className="no-print"
                        style={{
                          position: 'absolute',
                          top: '1.2cm',
                          left: '1.5cm',
                          right: '1.5cm',
                          borderBottom: '1px dashed #cbd5e1',
                          paddingBottom: '4px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.66rem',
                          color: '#94a3b8',
                          userSelect: 'none'
                        }}
                      >
                        <span>Margen Superior: 4.5 cm (Espacio para Membrete Preimpreso)</span>
                        <span>Papel Carta SENIAT</span>
                      </div>

                      <div
                        className="no-print"
                        style={{
                          position: 'absolute',
                          bottom: '1.2cm',
                          left: '1.5cm',
                          right: '1.5cm',
                          borderTop: '1px dashed #cbd5e1',
                          paddingTop: '4px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: '0.66rem',
                          color: '#94a3b8',
                          userSelect: 'none'
                        }}
                      >
                        <span>Margen Inferior: 4.5 cm (Espacio para Pie Legal Preimpreso)</span>
                        <span>Márgenes Laterales: 1.5 cm</span>
                      </div>

                      {/* PARTE SUPERIOR: Encabezado sin cabecera institucional y Tabla */}
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        
                        {/* 1. ENCABEZADO: SIN CABECERA INSTITUCIONAL, SOLO CORRELATIVO DE 6 DÍGITOS */}
                        {isFirstPage ? (
                          <>
                            {/* Correlativo de 6 Dígitos Consecutivos (Ejemplo: 000000, 000001, 000002) */}
                            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: '0.65rem' }}>
                              <div style={{ textAlign: 'right', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '4px 14px', background: '#f8fafc' }}>
                                <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                  {isNe ? 'NOTA DE ENTREGA N°' : (isNc ? 'NOTA DE CRÉDITO N°' : (isNd ? 'NOTA DE DÉBITO N°' : 'FACTURA N°'))}
                                </div>
                                <div style={{ fontSize: '1.45rem', fontWeight: 900, fontFamily: 'monospace', color: '#0f172a', letterSpacing: '2px' }}>
                                  {correlativoDisplay}
                                </div>
                              </div>
                            </div>

                            {/* Metadatos del Cliente y Venta */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: '0.85rem', background: '#f8fafc', padding: '0.7rem 0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '0.85rem' }}>
                              <div>
                                <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>Datos del Adquirente:</div>
                                <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a', margin: '2px 0' }}>{sale.clienteNombre}</div>
                                <div style={{ fontSize: '0.75rem', color: '#334155' }}>
                                  <strong>RIF / C.I.:</strong> <code>{sale.clienteRif}</code>
                                </div>
                                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                                  Domicilio Fiscal: {sale.clienteDireccion || 'Calle 48 con Pedro León Torres, Barquisimeto'}
                                </div>
                              </div>

                              <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: '0.85rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '2px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                                  <span style={{ color: '#64748b' }}>Fecha de Emisión:</span>
                                  <strong>{fechaStr} {horaStr}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                                  <span style={{ color: '#64748b' }}>Fecha de Vencimiento:</span>
                                  <strong style={{ color: '#002b7a' }}>{fechaVencStr} ({diasCreditoDoc} Días)</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                                  <span style={{ color: '#64748b' }}>Condición de Pago:</span>
                                  <strong>{sale.condicionPago || 'CONTADO'}</strong>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                                  <span style={{ color: '#64748b' }}>Método de Pago:</span>
                                  <span>{sale.metodoPago || 'EFECTIVO USD'}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                                  <span style={{ color: '#64748b' }}>Tasa Oficial BCV:</span>
                                  <strong style={{ color: '#d97706' }}>Bs. {tasaBcv.toFixed(2)} / USD</strong>
                                </div>
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            {/* Encabezado de Continuación (sin cabecera institucional) */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #cbd5e1', paddingBottom: '0.45rem', marginBottom: '0.65rem' }}>
                              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#475569' }}>
                                CONTINUACIÓN FACTURA N° <span style={{ fontFamily: 'monospace', fontSize: '1.05rem', fontWeight: 900, color: '#0f172a' }}>{correlativoDisplay}</span>
                              </div>
                              <div style={{ fontSize: '0.72rem', color: '#0369a1', fontWeight: 700 }}>
                                TRANSPORTE (VIENE DE PÁG. {pageNumber - 1}): ${formatUsd(prevAccumulatedUsd)} (Bs. {formatBs(prevAccumulatedBs)})
                              </div>
                            </div>
                          </>
                        )}

                        {sale.documentoAfectado && isFirstPage && (
                          <div style={{ padding: '0.45rem 0.85rem', background: '#fee2e2', border: '1px solid #ef4444', borderRadius: '6px', color: '#991b1b', fontWeight: 'bold', fontSize: '0.72rem', marginBottom: '0.75rem' }}>
                            DOCUMENTO AFECTADO: Factura Fiscal {sale.documentoAfectado}
                          </div>
                        )}

                        {/* 2. TABLA DE RENGLONES FACTURADOS */}
                        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '0.5rem', fontSize: '0.74rem' }}>
                          <thead>
                            <tr style={{ background: '#002b7a', color: '#ffffff', textAlign: 'left' }}>
                              <th style={{ padding: '6px 8px', width: '35px', textAlign: 'center' }}>#</th>
                              <th style={{ padding: '6px 8px' }}>DESCRIPCIÓN DEL LUBRICANTE</th>
                              <th style={{ padding: '6px 8px', textAlign: 'center', width: '50px' }}>CANT.</th>
                              <th style={{ padding: '6px 8px', textAlign: 'right', width: '75px' }}>P. UNIT ($)</th>
                              <th style={{ padding: '6px 8px', textAlign: 'center', width: '65px' }}>ALÍC.</th>
                              <th style={{ padding: '6px 8px', textAlign: 'right', width: '85px' }}>SUBTOTAL ($)</th>
                              <th style={{ padding: '6px 8px', textAlign: 'right', width: '105px' }}>TOTAL (BS.)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pageItems.map((it, idx) => {
                              const globalIdx = itemsBefore + idx + 1;
                              const subUsd = it.subtotalUsd || (it.cantidad * it.precioUsd);
                              const subBs = subUsd * tasaBcv;
                              return (
                                <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                                  <td style={{ padding: '5px 8px', textAlign: 'center', fontWeight: 600 }}>{globalIdx}</td>
                                  <td style={{ padding: '5px 8px' }}>
                                    <strong style={{ color: '#0f172a' }}>{it.descripcion}</strong>
                                    <div style={{ fontSize: '0.64rem', color: '#64748b' }}>{it.codigo || 'LUB-OILSTONE'}</div>
                                  </td>
                                  <td style={{ padding: '5px 8px', textAlign: 'center', fontWeight: 700 }}>{it.cantidad}</td>
                                  <td style={{ padding: '5px 8px', textAlign: 'right' }}>{formatUsd(it.precioUsd)}</td>
                                  <td style={{ padding: '5px 8px', textAlign: 'center' }}>
                                    <span style={{ fontSize: '0.64rem', background: '#e0f2fe', color: '#0369a1', padding: '1px 5px', borderRadius: '4px', fontWeight: 700 }}>
                                      {it.tipoAlicuota || '16%'}
                                    </span>
                                  </td>
                                  <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 700, color: '#0f172a' }}>{formatUsd(subUsd)}</td>
                                  <td style={{ padding: '5px 8px', textAlign: 'right', fontWeight: 600, color: '#475569' }}>{formatBs(subBs)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>

                        {/* Barra de Subtotal Acumulado si la factura continúa en la siguiente página */}
                        {!isLastPage && (
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              background: '#eff6ff',
                              border: '1px solid #bfdbfe',
                              borderRadius: '6px',
                              padding: '0.5rem 0.85rem',
                              marginTop: '0.5rem',
                              fontSize: '0.72rem'
                            }}
                          >
                            <span style={{ color: '#1e40af', fontWeight: 700 }}>
                              SUBTOTAL ACUMULADO HOJA {pageNumber}:
                            </span>
                            <span style={{ color: '#1e3a8a', fontWeight: 800 }}>
                              ${formatUsd(currentAccumulatedUsd)} (Bs. {formatBs(currentAccumulatedBs)}) — CONTINÚA EN PÁGINA {pageNumber + 1}/{totalPages}...
                            </span>
                          </div>
                        )}
                      </div>

                      {/* PARTE INFERIOR: Totales Fiscales y Firma en la última hoja, o pie formal */}
                      <div style={{ marginTop: 'auto', paddingTop: '0.4rem' }}>
                        {isLastPage ? (
                          <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 1.25fr', gap: '0.85rem', alignItems: 'end', marginBottom: '0.45rem' }}>
                            {/* Cajetín de Firma y Sello */}
                            <div>
                              <div style={{ border: '1px dashed #cbd5e1', borderRadius: '6px', padding: '0.65rem 0.85rem', background: '#fafafa', textAlign: 'center' }}>
                                <div style={{ borderBottom: '1px solid #94a3b8', width: '80%', margin: '0.85rem auto 4px auto' }} />
                                <div style={{ fontWeight: 700, fontSize: '0.72rem', color: '#0f172a' }}>Firma y Sello de Recepción</div>
                                <div style={{ fontSize: '0.64rem', color: '#64748b' }}>C.I. / RIF del Receptor • Fecha: ____/____/________</div>
                              </div>
                            </div>

                            {/* Tarjeta de Totales Fiscales */}
                            <div style={{ background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0.75rem 0.85rem' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: '0.72rem', color: '#475569' }}>
                                <span>Base Imponible General (16%):</span>
                                <strong>{formatUsd(sale.baseGeneralUsd)} ({formatBs(sale.baseGeneralBs)})</strong>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: '0.72rem', color: '#475569' }}>
                                <span>Débito Fiscal IVA (16%):</span>
                                <strong>{formatUsd(sale.ivaGeneralUsd || sale.ivaUsd)} ({formatBs(sale.ivaGeneralBs || sale.ivaBs)})</strong>
                              </div>

                              {Number(sale.igtfUsd || 0) > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: '0.72rem', color: '#b45309' }}>
                                  <span>Percepción IGTF Divisas (3%):</span>
                                  <strong>{formatUsd(sale.igtfUsd)} ({formatBs(sale.igtfBs)})</strong>
                                </div>
                              )}

                              {Number(sale.retencionIvaBs || 0) > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: '0.72rem', color: '#0284c7' }}>
                                  <span>Retención IVA Sufrida:</span>
                                  <strong>-{formatBs(sale.retencionIvaBs)}</strong>
                                </div>
                              )}

                              <div style={{ borderTop: '2px solid #002b7a', margin: '6px 0 5px 0' }} />

                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                  <div style={{ fontSize: '0.62rem', textTransform: 'uppercase', color: '#64748b' }}>Total de la Factura:</div>
                                  <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#059669', fontFamily: 'monospace' }}>
                                    {formatUsd(sale.totalUsd)}
                                  </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                  <div style={{ fontSize: '0.62rem', color: '#64748b' }}>Total Oficial en Bolívares:</div>
                                  <div style={{ fontSize: '1.05rem', fontWeight: 900, color: '#d97706', fontFamily: 'monospace' }}>
                                    {formatBs(sale.totalBs)}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div style={{ height: '35px' }} />
                        )}

                        {/* Pie Oficial Carta con Numeración Solicitada (Ejemplo: 1/2) y Leyenda Legal */}
                        <div
                          style={{
                            borderTop: '1px solid #cbd5e1',
                            paddingTop: '0.4rem',
                            display: 'flex',
                            justifyContent: isFacturaOrNotaEntrega ? 'space-between' : 'flex-end',
                            alignItems: 'center',
                            gap: '0.75rem',
                            fontSize: '0.72rem',
                            color: '#64748b',
                            fontWeight: 700
                          }}
                        >
                          {isFacturaOrNotaEntrega && (
                            <div
                              style={{
                                fontSize: '0.64rem',
                                color: '#475569',
                                fontWeight: 500,
                                textAlign: 'left',
                                maxWidth: '75%',
                                lineHeight: '1.25'
                              }}
                            >
                              Monto en <strong>{formatBs(invoiceTotalBs)}</strong>, referencial a la fecha de emisión. Los pagos en Bs se deberán realizar según la tasa oficial BCV a la fecha de su cancelación.
                            </div>
                          )}
                          <span style={{ background: '#f1f5f9', padding: '2px 10px', borderRadius: '4px', border: '1px solid #cbd5e1', color: '#0f172a', whiteSpace: 'nowrap' }}>
                            PÁGINA {pageNumber} / {totalPages}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Barra de Acciones Inferior */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem', flexShrink: 0 }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            style={{ fontSize: '0.82rem' }}
          >
            Cerrar Ventana
          </button>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                onClose();
                if (onNewSale) onNewSale();
              }}
              style={{
                background: 'var(--semaforo-verde)',
                borderColor: 'var(--semaforo-verde)',
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Plus size={16} /> Emitir Nueva Factura
            </button>
            <button
              type="button"
              className="btn"
              onClick={handlePrintWarehouseGuide}
              style={{
                fontSize: '0.85rem',
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: '#fff',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
              title="Descargar e imprimir Guía de Despacho oficial para el Almacén y Chofer"
            >
              <Truck size={16} color="#ffffff" /> Guía de Despacho (Almacén)
            </button>
            <button
              type="button"
              className="btn btn-print-report"
              onClick={handlePrint}
              style={{ fontSize: '0.85rem' }}
              title="Generar y descargar Factura Fiscal Oficial en PDF (Formato Carta SENIAT con márgenes de 4.5 cm y correlativo de 6 dígitos)"
            >
              <Printer size={16} color="#ffffff" /> Imprimir Factura
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
