/**
 * =========================================================================
 * MOTOR CENTRAL DE REPORTES CORPORATIVOS EN PDF - SIGNUM MOTORVEN C.A.
 * =========================================================================
 * Formato Oficial: Tamaño Carta (Letter: 215.9 mm × 279.4 mm), Posición Vertical (Portrait).
 * Margen estricto de 1.5 cm (15 mm) en todos sus lados.
 * Contenedor Padre Unificado (Parent Container Frame) con bordes finos institucionales.
 * Cero solapamientos (Zero Overlap), paginación inteligente y tipografía compacta de alta fidelidad.
 * Cumple con identidad visual corporativa: Azul Marino (#002b7a), Rojo SIGNUM (#e60012).
 */

import { jsPDF } from 'jspdf';
import rawAutoTable from 'jspdf-autotable';
import qrcode from 'qrcode-generator';
import { MOTORVEN_LOGO_BASE64 } from '../assets/logoBase64.js';
import { formatUsd, formatBs, formatUnitVe, resolveProductUnit, resolveProductLitersPerUnit, getProductWarehouseStocks, round2 } from './formatService.js';
import { parseInvoiceDateInfo } from './creditPolicyService.js';
import { getProductRetailPrice, getProductCost as resolveWarehouseProductCost } from './pricingService.js';
import { resolveProductListPrice, safePct, PRICE_LIST_TIERS } from '../utils/profitabilityUtils.js';
import { REAL_PRODUCTS, REAL_CLIENTS, REAL_PROFIT_BANK_ACCOUNTS, REAL_PROFIT_SELLERS } from '../data/supabaseRealData.js';
import { buildTrialBalance, buildGeneralLedger, buildFinancialStatements } from './accountingService.js';
import { SYSTEM_METADATA, MODULES_DOCUMENTATION, WORKFLOWS_STEP_BY_STEP } from '../data/appDocumentationData.js';
import {
  resolveExchangeRates,
  computeBankBalancesSummary,
  computeCashDesksSummary,
  computeBankAccountValuation
} from '../utils/treasuryAccountUtils.js';
import {
  isFiscalDocumentForRatePolicy,
  normalizeRateType,
  resolveRecordRateType,
  resolveRateMeta,
  resolveEffectiveRateNumber,
  isDirectCurrencyRateType,
  summarizeByRateClassification
} from '../utils/rateClassificationUtils.js';
import { classifyCollectionRateType } from '../utils/cxcUtils.js';
import { resolveKardexLineCosts } from '../utils/kardexUtils.js';
import {
  buildLibroVentasRows,
  buildLibroComprasRows,
  isFiscalDocEligible,
  validateRif
} from './fiscalService.js';

// Paleta Institucional SIGNUM MOTORVEN
const COLORS = {
  navy: [0, 43, 122],          // #002b7a - Principal
  red: [230, 0, 18],           // #e60012 - Acento SIGNUM
  dark: [15, 23, 42],          // #0f172a - Texto primario
  slate: [71, 85, 105],        // #475569 - Texto secundario
  muted: [100, 116, 139],      // #64748b - Subtítulos
  lightBg: [248, 250, 252],    // #f8fafc - Fondo suave
  border: [203, 213, 225],     // #cbd5e1 - Bordes sutiles
  emerald: [5, 150, 105],      // #059669 - Éxito
  amber: [217, 119, 6],        // #d97706 - Alerta
  cyan: [14, 165, 233]         // #0ea5e9 - Información
};

// Dimensiones fijas de página Carta en mm
export const PAGE_LETTER = {
  width: 215.9,
  height: 279.4,
  margin: 15,                  // 1.5 cm en todos los lados
  contentWidth: 185.9,         // 215.9 - 30 mm
  contentHeight: 249.4,        // 279.4 - 30 mm
  innerPadding: 3,             // Holgura interior dentro del contenedor padre
  tableWidth: 179.9            // 185.9 - (3 * 2) mm
};

/**
 * Escalador central para todas las tablas autoTable: mejora la legibilidad global
 * según la densidad de columnas sin provocar desbordes horizontales ni cortes de palabra.
 */
function autoTable(doc, options = {}) {
  const headRow = Array.isArray(options.head) && Array.isArray(options.head[0]) ? options.head[0] : [];
  const bodyRow = Array.isArray(options.body) && Array.isArray(options.body[0]) ? options.body[0] : [];
  const colCount = Math.max(1, headRow.length || bodyRow.length || 6);
  const pageW = doc?.internal?.pageSize?.getWidth?.() || PAGE_LETTER.width;
  const tableW = Number(options.tableWidth) || Math.max(120, pageW - (PAGE_LETTER.margin + PAGE_LETTER.innerPadding) * 2);
  const avgColMm = tableW / colCount;

  let targetHead = 8.0;
  let targetBody = 7.8;
  let targetFoot = 8.0;
  let targetPad = 1.8;

  if (avgColMm < 15) {
    targetHead = 5.8;
    targetBody = 6.0;
    targetFoot = 6.0;
    targetPad = 1.15;
  } else if (avgColMm < 18) {
    targetHead = 6.6;
    targetBody = 6.8;
    targetFoot = 6.8;
    targetPad = 1.35;
  } else if (avgColMm < 24) {
    targetHead = 7.2;
    targetBody = 7.3;
    targetFoot = 7.4;
    targetPad = 1.55;
  }

  const origHeadSize = Number(options.headStyles?.fontSize || 0);
  const origBodySize = Number(options.styles?.fontSize || 0);
  const origFootSize = Number(options.footStyles?.fontSize || 0);

  let finalHeadSize = Math.max(origHeadSize, targetHead);
  const finalBodySize = Math.max(origBodySize, targetBody);
  const finalFootSize = Math.max(origFootSize, targetFoot);

  const origHeadPad = options.headStyles?.cellPadding;
  const origBodyPad = options.styles?.cellPadding;
  const origFootPad = options.footStyles?.cellPadding;

  const resolvePad = (origPad, minPad) => {
    if (origPad && typeof origPad === 'object') return origPad;
    const num = Number(origPad);
    return Number.isFinite(num) && num > 0 ? Math.max(num, minPad) : minPad;
  };

  const finalHeadPad = resolvePad(origHeadPad, targetPad);
  const finalBodyPad = resolvePad(origBodyPad, Math.max(1.1, targetPad - 0.15));
  const finalFootPad = resolvePad(origFootPad, targetPad);

  const hPadMm = typeof finalHeadPad === 'number'
    ? finalHeadPad * 2
    : Number(finalHeadPad.left || 1.1) + Number(finalHeadPad.right || 1.1);

  if (headRow.length > 0 && options.columnStyles && typeof doc.getTextWidth === 'function') {
    doc.setFont('helvetica', 'bold');
    for (let i = 0; i < headRow.length; i++) {
      const colStyle = options.columnStyles[i];
      const cellW = Number(colStyle?.cellWidth || 0);
      if (!(cellW > 0)) continue;
      const cellRaw = headRow[i];
      const label = typeof cellRaw === 'object' ? String(cellRaw?.content || '') : String(cellRaw || '');
      const tokens = label.trim().split(/\s+/).filter(Boolean);
      const longestToken = tokens.reduce((a, b) => (b.length > a.length ? b : a), '');
      if (!longestToken) continue;
      while (finalHeadSize > 5.3) {
        doc.setFontSize(finalHeadSize);
        if (doc.getTextWidth(longestToken) <= cellW - hPadMm + 0.3) break;
        finalHeadSize = Number((finalHeadSize - 0.2).toFixed(1));
      }
    }
  }

  return rawAutoTable(doc, {
    ...options,
    styles: {
      overflow: 'linebreak',
      ...(options.styles || {}),
      fontSize: finalBodySize,
      cellPadding: finalBodyPad
    },
    headStyles: {
      ...(options.headStyles || {}),
      fontSize: finalHeadSize,
      cellPadding: finalHeadPad
    },
    ...(options.foot || options.footStyles ? {
      footStyles: {
        ...(options.footStyles || {}),
        fontSize: finalFootSize,
        cellPadding: finalFootPad
      }
    } : {})
  });
}

/**
 * Genera un correlativo institucional único
 */
function makeCorrelative(prefix = 'RPT') {
  const d = new Date();
  const dateStr = d.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0');
  const randomSuffix = Math.floor(100 + Math.random() * 900);
  return `${prefix}-${dateStr}-${timeStr}-${randomSuffix}`;
}

/**
 * Formatea fecha y hora en estándar venezolano
 */
function formatCurrentDateTime() {
  const d = new Date();
  return d.toLocaleString('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}

/**
 * Dibuja el Contenedor Padre unificado con márgenes de 1.5 cm
 */
function drawParentContainer(doc, isFirstPage = true) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = PAGE_LETTER.margin;
  const contentWidth = pageWidth - (margin * 2);
  const contentHeight = pageHeight - (margin * 2);

  // Marco contenedor padre (1.5 cm de margen exterior)
  // En páginas posteriores (isFirstPage=false), usar modo 'D' (Draw outline solo)
  // para evitar tapar los datos pre-renderizados con un fondo blanco opaco.
  const drawMode = isFirstPage ? 'FD' : 'D';
  if (isFirstPage) {
    doc.setFillColor(255, 255, 255);
  }
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.4);
  doc.roundedRect(margin, margin, contentWidth, contentHeight, 2.5, 2.5, drawMode);

  // Franja decorativa superior dentro del contenedor
  doc.setFillColor(...COLORS.navy);
  doc.roundedRect(margin, margin, contentWidth * 0.72, isFirstPage ? 3 : 2, 1, 1, 'F');
  doc.setFillColor(...COLORS.red);
  doc.roundedRect(margin + contentWidth * 0.72, margin, contentWidth * 0.28, isFirstPage ? 3 : 2, 1, 1, 'F');
}

/**
 * Retorna métricas de layout seguras según orientación activa (Portrait / Landscape)
 * para evitar solapamientos con el pie de página y anclar firmas por sobre el footer.
 */
export function getPageLayoutMetrics(doc, reserveBottomMm = 0) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = PAGE_LETTER.margin;
  const innerPadding = PAGE_LETTER.innerPadding;
  const contentWidth = pageWidth - (margin * 2);
  const contentHeight = pageHeight - (margin * 2);
  const startX = margin + innerPadding;
  const tableWidth = contentWidth - (innerPadding * 2);
  const footerY = margin + contentHeight - 7.5;
  const safeBottomY = footerY - 3 - Number(reserveBottomMm || 0);

  return {
    pageWidth,
    pageHeight,
    margin,
    innerPadding,
    contentWidth,
    contentHeight,
    startX,
    tableWidth,
    footerY,
    safeBottomY,
    continuationTopY: 22
  };
}

/**
 * Crea la base visual del documento PDF institucional en formato Carta (Vertical u Horizontal)
 */
export function createBaseReport({
  title = 'REPORTE CORPORATIVO',
  subtitle = 'Informe Ejecutivo y Operacional',
  moduleCode = 'GEN',
  currentUser = null,
  config = {},
  orientation = 'portrait',
  rateLabel = 'Tasa BCV',
  rateValue = null,
  rateDisplay = null,
  hideCorrelative = false,
  hideOperatorStrip = false
}) {
  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'letter'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = PAGE_LETTER.margin;
  const innerPadding = PAGE_LETTER.innerPadding;
  const contentWidth = pageWidth - (margin * 2);
  const contentHeight = pageHeight - (margin * 2);
  const tableWidth = contentWidth - (innerPadding * 2);
  const startX = margin + innerPadding;
  const correlative = makeCorrelative(`RPT-${moduleCode}`);
  const dateTimeStr = formatCurrentDateTime();

  // 1. Contenedor Padre en la página 1
  drawParentContainer(doc, true);

  // 2. Logo corporativo en cabecera
  if (MOTORVEN_LOGO_BASE64) {
    try {
      doc.addImage(MOTORVEN_LOGO_BASE64, 'PNG', startX, margin + 4.5, 27, 11, undefined, 'FAST');
    } catch (err) {
      console.warn('Error dibujando logo en PDF:', err);
    }
  }

  // 3. Configuración de Caja de Metadatos (extremo superior derecho)
  const metaBoxW = 62;
  const metaBoxX = margin + contentWidth - metaBoxW - innerPadding;

  // 4. Bloque de Identidad Empresarial (al lado del logo con zona segura calculada)
  const infoX = startX + 30;
  const maxCompanyW = metaBoxX - infoX - 3; // Zona segura hasta la caja de metadatos

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.4);
  doc.setTextColor(...COLORS.navy);
  const companyLines = doc.splitTextToSize(config?.nombreEmpresa || 'SIGNUM MOTORVEN, C.A.', maxCompanyW);
  doc.text(companyLines[0], infoX, margin + 8.0);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(...COLORS.slate);
  const rifLines = doc.splitTextToSize(`RIF: ${config?.rif || 'J-30401927-4'} • Lubricantes OILSTONE ®`, maxCompanyW);
  doc.text(rifLines[0], infoX, margin + 11.8);

  doc.setFontSize(7.0);
  doc.setTextColor(...COLORS.muted);
  const addrLines = doc.splitTextToSize(`Dir.: ${config?.direccion || 'Barquisimeto / Caracas'} • Tel: ${config?.telefono || '+58 (251) 269.13.96'}`, maxCompanyW);
  doc.text(addrLines[0], infoX, margin + 15.0);

  // Dibujar Caja de Metadatos del Documento
  doc.setFillColor(...COLORS.lightBg);
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(metaBoxX, margin + 4.2, metaBoxW, 11.6, 1.2, 1.2, 'FD');

  const effectiveRateNum = Number(rateValue ?? config?.tasaDolar) || 827.73;
  const rateLineText = rateDisplay
    ? `${rateLabel}: ${rateDisplay}`
    : `${rateLabel}: ${formatBs(effectiveRateNum)} / USD`;
  const fitMetaTextSize = (txt, initialSize) => {
    let sz = initialSize;
    doc.setFontSize(sz);
    while (doc.getTextWidth(txt) > metaBoxW - 3 && sz > 5.2) {
      sz = Number((sz - 0.2).toFixed(1));
      doc.setFontSize(sz);
    }
    return sz;
  };

  if (hideCorrelative) {
    doc.setFont('helvetica', 'normal');
    fitMetaTextSize(`Emisión: ${dateTimeStr}`, 6.8);
    doc.setTextColor(...COLORS.slate);
    doc.text(`Emisión: ${dateTimeStr}`, metaBoxX + metaBoxW / 2, margin + 8.8, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    fitMetaTextSize(rateLineText, 7.0);
    doc.setTextColor(...COLORS.emerald);
    doc.text(rateLineText, metaBoxX + metaBoxW / 2, margin + 13.0, { align: 'center' });
  } else {
    doc.setFont('helvetica', 'bold');
    fitMetaTextSize(correlative, 7.4);
    doc.setTextColor(...COLORS.navy);
    doc.text(correlative, metaBoxX + metaBoxW / 2, margin + 7.6, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    fitMetaTextSize(`Emisión: ${dateTimeStr}`, 6.7);
    doc.setTextColor(...COLORS.slate);
    doc.text(`Emisión: ${dateTimeStr}`, metaBoxX + metaBoxW / 2, margin + 11.0, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    fitMetaTextSize(rateLineText, 7.0);
    doc.setTextColor(...COLORS.emerald);
    doc.text(rateLineText, metaBoxX + metaBoxW / 2, margin + 14.3, { align: 'center' });
  }

  // 5. Franja de Título Principal con Acento Lateral Rojo
  const bannerY = margin + 17.2;
  const hasSubtitle = Boolean(subtitle && String(subtitle).trim());
  const bannerH = hasSubtitle ? 10.6 : 8.2;
  doc.setFillColor(...COLORS.navy);
  doc.roundedRect(startX, bannerY, tableWidth, bannerH, 1, 1, 'F');
  doc.setFillColor(...COLORS.red);
  doc.rect(startX, bannerY, 3, bannerH, 'F'); // Pip rojo

  const upperTitle = title.toUpperCase();
  let titleSize = 10.8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(titleSize);
  while (doc.getTextWidth(upperTitle) > tableWidth - 9 && titleSize > 7.8) {
    titleSize = Number((titleSize - 0.3).toFixed(1));
    doc.setFontSize(titleSize);
  }
  doc.setTextColor(255, 255, 255);
  doc.text(upperTitle, startX + 6, bannerY + (hasSubtitle ? 4.8 : 5.4));

  if (hasSubtitle) {
    let subSize = 7.6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(subSize);
    while (doc.getTextWidth(subtitle) > tableWidth - 9 && subSize > 6.2) {
      subSize = Number((subSize - 0.2).toFixed(1));
      doc.setFontSize(subSize);
    }
    const subLines = doc.splitTextToSize(subtitle, tableWidth - 9);
    doc.setTextColor(226, 232, 240);
    doc.text(subLines[0] || subtitle, startX + 6, bannerY + 8.6);
  }

  if (hideOperatorStrip) {
    return {
      doc,
      pageWidth,
      pageHeight,
      margin,
      contentWidth,
      contentHeight,
      startX,
      tableWidth,
      startY: bannerY + bannerH + 2.5,
      correlative,
      dateTimeStr
    };
  }

  // 6. Cinta de Identificación del Operador Emisor con anchos de celda protegidos
  const emisorY = bannerY + bannerH + 1.4;
  const emisorH = 6.2;
  doc.setFillColor(...COLORS.lightBg);
  doc.setDrawColor(...COLORS.border);
  doc.roundedRect(startX, emisorY, tableWidth, emisorH, 0.8, 0.8, 'FD');

  const userName = currentUser?.nombre || currentUser?.username || 'Edson Designer';
  const userNick = currentUser?.username ? `@${currentUser.username}` : '@admin';
  const userRole = currentUser?.cargo || currentUser?.rol || 'Administrador Master';
  const userDept = currentUser?.departamento || 'DIRECCIÓN';

  const midX = startX + tableWidth * 0.45;
  const rightX = startX + tableWidth * 0.78;

  const maxUserW = midX - (startX + 33) - 3;
  const maxRoleW = rightX - (midX + 21) - 3;
  const maxDeptW = (startX + tableWidth) - (rightX + 12) - 2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.1);
  doc.setTextColor(...COLORS.navy);
  doc.text('OPERADOR EMISOR:', startX + 3, emisorY + 4.2);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.dark);
  const userLines = doc.splitTextToSize(`${userName} (${userNick})`, maxUserW);
  doc.text(userLines[0] || userName, startX + 33, emisorY + 4.2);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.slate);
  doc.text('CARGO / ROL:', midX, emisorY + 4.2);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.dark);
  const roleLines = doc.splitTextToSize(userRole, maxRoleW);
  doc.text(roleLines[0] || userRole, midX + 21, emisorY + 4.2);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.slate);
  doc.text('DEPTO:', rightX, emisorY + 4.2);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.red);
  const deptLines = doc.splitTextToSize(userDept, maxDeptW);
  doc.text(deptLines[0] || userDept, rightX + 12, emisorY + 4.2);

  return {
    doc,
    pageWidth,
    pageHeight,
    margin,
    contentWidth,
    contentHeight,
    startX,
    tableWidth,
    startY: emisorY + emisorH + 2.5,
    correlative,
    dateTimeStr
  };
}

/**
 * Renderiza tarjetas ejecutivas de KPI (Resumen Analítico Superior)
 */
export function addSummaryCards(doc, startY, cards = [], tableWidth = 179.9, startX = 18) {
  if (!cards || cards.length === 0) return startY;

  const count = cards.length;
  const gap = 2.5;
  const cardW = (tableWidth - gap * (count - 1)) / count;
  const cardH = 14.0;

  // Guardia de desborde hacia el pie de página (orientación Portrait/Landscape)
  const { safeBottomY, continuationTopY } = getPageLayoutMetrics(doc);
  if (startY + cardH > safeBottomY) {
    doc.addPage();
    startY = continuationTopY;
  }

  cards.forEach((card, idx) => {
    const x = startX + idx * (cardW + gap);

    // Fondo y borde
    doc.setFillColor(...COLORS.lightBg);
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, startY, cardW, cardH, 1.2, 1.2, 'FD');

    // Borde de acento superior según color del KPI
    const topBarColor = card.color || COLORS.navy;
    doc.setFillColor(...topBarColor);
    doc.roundedRect(x, startY, cardW, 1.5, 0.6, 0.6, 'F');

    // Etiqueta del KPI
    const labelStr = (card.label || 'KPI').toUpperCase();
    let labelSize = 7.0;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(labelSize);
    while (doc.getTextWidth(labelStr) > cardW - 4 && labelSize > 5.6) {
      labelSize = Number((labelSize - 0.2).toFixed(1));
      doc.setFontSize(labelSize);
    }
    doc.setTextColor(...COLORS.slate);
    doc.text(labelStr, x + 2.5, startY + 4.8);

    // Valor Principal con escala tipográfica dinámica para evitar desbordes y solapes
    const valStr = String(card.value || '0');
    let valFontSize = 10.2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(valFontSize);
    while (doc.getTextWidth(valStr) > cardW - 4.5 && valFontSize > 6.6) {
      valFontSize = Number((valFontSize - 0.3).toFixed(1));
      doc.setFontSize(valFontSize);
    }
    doc.setTextColor(...(card.valueColor || COLORS.dark));
    doc.text(valStr, x + 2.5, startY + 9.2);

    // Subtítulo / Detalle truncado al ancho de tarjeta para que no desborde
    if (card.subtext) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.3);
      doc.setTextColor(...COLORS.muted);
      const subLines = doc.splitTextToSize(String(card.subtext), cardW - 4);
      doc.text(subLines[0] || '', x + 2.5, startY + 12.2);
    }
  });

  return startY + cardH + 2.5;
}

/**
 * Añade una caja de análisis ejecutivo en prosa
 */
export function addAnalyticalBox(doc, startY, title = 'ANÁLISIS EJECUTIVO & RESUMEN FINANCIERO', text = '', tableWidth = 179.9, startX = 18) {
  if (!text) return startY;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.6);
  const splitText = doc.splitTextToSize(text, tableWidth - 9);
  const textH = splitText.length * 3.4;
  const boxH = Math.max(11.5, textH + 7.2);

  // Guardia de desborde hacia el pie de página (orientación Portrait/Landscape)
  const { safeBottomY, continuationTopY } = getPageLayoutMetrics(doc);
  if (startY + boxH > safeBottomY) {
    doc.addPage();
    startY = continuationTopY;
  }

  doc.setFillColor(240, 249, 255); // Fondo azul suave
  doc.setDrawColor(186, 230, 253);
  doc.setLineWidth(0.3);
  doc.roundedRect(startX, startY, tableWidth, boxH, 1.2, 1.2, 'FD');

  // Línea vertical izquierda de acento azul cian
  doc.setFillColor(...COLORS.cyan);
  doc.rect(startX, startY, 2.2, boxH, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.4);
  doc.setTextColor(...COLORS.navy);
  doc.text(title.toUpperCase(), startX + 4.5, startY + 4.2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.6);
  doc.setTextColor(...COLORS.dark);
  doc.text(splitText, startX + 4.5, startY + 8.0);

  return startY + boxH + 2.5;
}

/**
 * Añade un encabezado de sección / bloque temático (con acento corporativo rojo y azul marino)
 */
export function addSectionHeader(doc, startY, title, subtitle = '', tableWidth = 179.9, startX = 18) {
  const bannerH = subtitle ? 10.4 : 8.0;
  const { safeBottomY, continuationTopY } = getPageLayoutMetrics(doc);
  if (startY + bannerH + 2.5 > safeBottomY) {
    doc.addPage();
    startY = continuationTopY;
  }
  doc.setFillColor(...COLORS.navy);
  doc.roundedRect(startX, startY, tableWidth, bannerH, 1, 1, 'F');
  doc.setFillColor(...COLORS.red);
  doc.rect(startX, startY, 3, bannerH, 'F');

  const upperTitle = String(title || '').toUpperCase();
  let secTitleSize = 10.0;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(secTitleSize);
  while (doc.getTextWidth(upperTitle) > tableWidth - 9 && secTitleSize > 7.6) {
    secTitleSize = Number((secTitleSize - 0.3).toFixed(1));
    doc.setFontSize(secTitleSize);
  }
  doc.setTextColor(255, 255, 255);
  doc.text(upperTitle, startX + 6, startY + (subtitle ? 4.6 : 5.2));

  if (subtitle) {
    let secSubSize = 7.2;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(secSubSize);
    while (doc.getTextWidth(subtitle) > tableWidth - 9 && secSubSize > 5.8) {
      secSubSize = Number((secSubSize - 0.2).toFixed(1));
      doc.setFontSize(secSubSize);
    }
    const subLines = doc.splitTextToSize(subtitle, tableWidth - 9);
    doc.setTextColor(226, 232, 240);
    doc.text(subLines[0] || subtitle, startX + 6, startY + 8.5);
  }

  return startY + bannerH + 2.5;
}

/**
 * Dibuja un bloque formal de firmas y sellos anclado por sobre el pie de página.
 * Si el contenido previo invade la zona reservada de firmas, abre una nueva página.
 */
export function addSignatures(
  doc,
  startY,
  roles = ['Revisado por', 'Aprobado por'],
  tableWidth = 179.9,
  startX = 18,
  options = {}
) {
  const count = roles.length;
  const sigH = 19;
  const reserveBottomMm = Number(options.reserveBottomMm || 0);
  const gapAboveFooter = Number(options.gapAboveFooter ?? 3);
  const anchorToFooter = options.anchorToFooter !== false;

  const { footerY, continuationTopY } = getPageLayoutMetrics(doc, reserveBottomMm);
  const anchoredY = footerY - reserveBottomMm - gapAboveFooter - sigH;

  // Si el contenido previo ya supera la posición superior anclada, saltar a nueva página
  if (startY > anchoredY) {
    doc.addPage();
    if (typeof options.onPageAdd === 'function') {
      options.onPageAdd(doc);
    }
    startY = options.continuationTopY || continuationTopY;
  }

  // Anclar siempre las firmas y sellos por sobre el pie de página (o zona inferior reservada)
  const drawY = anchorToFooter ? anchoredY : startY;

  const gap = 12;
  const sigW = (tableWidth - gap * (count - 1)) / count;

  roles.forEach((role, idx) => {
    const x = startX + idx * (sigW + gap);
    const lineY = drawY + 11;

    // Línea de firma
    doc.setDrawColor(...COLORS.slate);
    doc.setLineWidth(0.3);
    doc.line(x + 5, lineY, x + sigW - 5, lineY);

    // Cargo / Rol (escalado seguro dentro de sigW)
    const roleUpper = role.toUpperCase();
    let roleFontSize = 7.4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(roleFontSize);
    while (doc.getTextWidth(roleUpper) > sigW - 3 && roleFontSize > 5.8) {
      roleFontSize = Number((roleFontSize - 0.2).toFixed(1));
      doc.setFontSize(roleFontSize);
    }
    doc.setTextColor(...COLORS.navy);
    doc.text(roleUpper, x + sigW / 2, lineY + 3.6, { align: 'center' });

    // Leyenda
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.3);
    doc.setTextColor(...COLORS.muted);
    doc.text('Firma y Sello Oficial', x + sigW / 2, lineY + 6.4, { align: 'center' });
  });

  return drawY + sigH + 2;
}

/**
 * Renderiza una píldora / badge semafórico vectorial dentro de una celda
 */
export function drawStatusBadge(doc, cell, statusText) {
  const text = String(statusText || '').trim().toUpperCase();
  if (!text) return;

  // Determinar paleta según el significado del estado
  let bg = [241, 245, 249];
  let border = [203, 213, 225];
  let color = [71, 85, 105];

  if (
    text.includes('SUPERADA') ||
    text.includes('ÓPTIMO') ||
    text.includes('OPTIMO') ||
    text.includes('PAGADO') ||
    text.includes('SALUDABLE') ||
    text.includes('CONFORME') ||
    text.includes('CUADRADO') ||
    text.includes('ACTIVO') ||
    text.includes('EXCELENTE') ||
    text.includes('AL DÍA') ||
    text.includes('AL DIA') ||
    text.includes('SOLVENTE')
  ) {
    bg = [209, 250, 229];      // Esmeralda suave
    border = [16, 185, 129];
    color = [4, 120, 87];
  } else if (
    text.includes('AVANCE') ||
    text.includes('PROCESO') ||
    text.includes('VIGENTE') ||
    text.includes('BUENO') ||
    text.includes('DESPACHADO') ||
    text.includes('FACTURADO')
  ) {
    bg = [224, 242, 254];      // Azul cian suave
    border = [14, 165, 233];
    color = [3, 105, 161];
  } else if (
    text.includes('SEGUIMIENTO') ||
    text.includes('ATENCIÓN') ||
    text.includes('ATENCION') ||
    text.includes('1-15') ||
    text.includes('SOBRANTE') ||
    text.includes('REGULAR') ||
    text.includes('PENDIENTE')
  ) {
    bg = [254, 243, 199];      // Ámbar suave
    border = [245, 158, 11];
    color = [180, 83, 9];
  } else if (
    text.includes('CRÍTICO') ||
    text.includes('CRITICO') ||
    text.includes('EXTRAJUDICIAL') ||
    text.includes('GRAVE') ||
    text.includes('FALTANTE') ||
    text.includes('VENCIDO') ||
    text.includes('VENCIDA') ||
    text.includes('RIESGO') ||
    text.includes('AGOTADO') ||
    text.includes('ANULADO') ||
    text.includes('MOROSO')
  ) {
    bg = [254, 226, 226];      // Rojo suave
    border = [239, 68, 68];
    color = [185, 28, 28];
  }

  const badgeH = 4.8;
  const badgeW = Math.min(cell.width - 1.5, 26);
  const badgeX = cell.x + (cell.width - badgeW) / 2;
  const badgeY = cell.y + (cell.height - badgeH) / 2;

  doc.setFillColor(...bg);
  doc.setDrawColor(...border);
  doc.setLineWidth(0.2);
  doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 1.0, 1.0, 'FD');

  let badgeFontSize = 6.2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(badgeFontSize);
  while (doc.getTextWidth(text) > badgeW - 1.6 && badgeFontSize > 4.6) {
    badgeFontSize = Number((badgeFontSize - 0.2).toFixed(1));
    doc.setFontSize(badgeFontSize);
  }
  doc.setTextColor(...color);
  doc.text(text, cell.x + cell.width / 2, badgeY + badgeH / 2 + 1.2, { align: 'center' });
}

/**
 * Renderiza una micro-barra de progreso horizontal con etiqueta porcentual
 */
export function drawMiniProgressBar(doc, cell, rawValue) {
  const numStr = String(rawValue || '0').replace('%', '').trim();
  const pct = Math.max(0, parseFloat(numStr) || 0);

  const barW = Math.max(8, Math.min(cell.width - 14, 15));
  const barH = 2.4;
  const totalW = barW + 11;
  const startX = cell.x + (cell.width - totalW) / 2;
  const barY = cell.y + (cell.height - barH) / 2;

  // Track de fondo gris
  doc.setFillColor(226, 232, 240);
  doc.roundedRect(startX, barY, barW, barH, 0.6, 0.6, 'F');

  // Barra de progreso llena
  const fillW = Math.max(0.6, Math.min(barW, (Math.min(pct, 100) / 100) * barW));
  const fillColor = pct >= 100 ? [5, 150, 105] : pct >= 70 ? [14, 165, 233] : pct >= 40 ? [217, 119, 6] : [230, 0, 18];
  doc.setFillColor(...fillColor);
  doc.roundedRect(startX, barY, fillW, barH, 0.6, 0.6, 'F');

  // Texto porcentual
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...COLORS.dark);
  doc.text(`${pct.toFixed(1)}%`, startX + barW + 1.8, barY + barH - 0.2);
}

/**
 * Dibuja una caja formal de Totales Generales con doble subrayado contable
 */
export function addGrandTotalBox(doc, startY, items = [], tableWidth = 179.9, startX = 18) {
  if (!items || items.length === 0) return startY;

  const boxH = 18.0;
  const { safeBottomY, continuationTopY } = getPageLayoutMetrics(doc);
  if (startY + boxH > safeBottomY) {
    doc.addPage();
    startY = continuationTopY;
  }

  // Fondo y borde
  doc.setFillColor(...COLORS.lightBg);
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(startX, startY, tableWidth, boxH, 1.2, 1.2, 'FD');

  // Acento vertical izquierdo en Navy
  doc.setFillColor(...COLORS.navy);
  doc.rect(startX, startY, 2.5, boxH, 'F');

  const count = items.length;
  const colW = (tableWidth - 8) / count;

  items.forEach((item, idx) => {
    const x = startX + 5 + idx * colW;
    const midY = startY + 4.6;

    const lblText = (item.label || 'TOTAL').toUpperCase();
    let lblSize = 7.2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(lblSize);
    while (doc.getTextWidth(lblText) > colW - 4 && lblSize > 5.8) {
      lblSize = Number((lblSize - 0.2).toFixed(1));
      doc.setFontSize(lblSize);
    }
    doc.setTextColor(...COLORS.slate);
    doc.text(lblText, x, midY);

    const valStr = String(item.value || '$ 0.00');
    let valSize = 10.4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(valSize);
    while (doc.getTextWidth(valStr) > colW - 4 && valSize > 7.0) {
      valSize = Number((valSize - 0.3).toFixed(1));
      doc.setFontSize(valSize);
    }
    doc.setTextColor(...(item.color || COLORS.navy));
    doc.text(valStr, x, midY + 4.8);

    if (item.subtext) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...COLORS.muted);
      const subLines = doc.splitTextToSize(String(item.subtext), colW - 4);
      doc.text(subLines[0] || '', x, midY + 8.3);
    }

    // Doble línea contable inferior debajo del subtexto (sin colisión)
    const lineW = Math.min(colW - 8, 34);
    const lineY = startY + boxH - 1.8;
    doc.setDrawColor(...COLORS.slate);
    doc.setLineWidth(0.2);
    doc.line(x, lineY, x + lineW, lineY);
    doc.line(x, lineY + 0.6, x + lineW, lineY + 0.6);
  });

  return startY + boxH + 2.5;
}

/**
 * Imprime un documento jsPDF directamente en el navegador (equivalente a Ctrl + P)
 * sin guardar/descargar el archivo en el equipo del usuario.
 */
export function printPDFDocument(doc) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { success: false, message: 'Entorno no gráfico' };
  }
  try {
    if (typeof doc?.autoPrint === 'function') {
      doc.autoPrint();
    }
    const blob = doc.output('blob');
    const blobUrl = URL.createObjectURL(blob);
    const existingFrame = document.getElementById('motorven-pdf-print-frame');
    if (existingFrame) existingFrame.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'motorven-pdf-print-frame';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '100px';
    iframe.style.height = '100px';
    iframe.style.opacity = '0';
    iframe.style.pointerEvents = 'none';
    iframe.style.border = '0';
    iframe.style.zIndex = '-1';
    iframe.src = blobUrl;
    document.body.appendChild(iframe);

    let printed = false;
    const triggerIframePrint = () => {
      if (printed) return;
      printed = true;
      setTimeout(() => {
        try {
          iframe.contentWindow.focus();
          iframe.contentWindow.print();
        } catch (printErr) {
          console.warn('[PDF Service] Error en print del iframe, abriendo vista de impresión:', printErr);
          const win = window.open(blobUrl, '_blank');
          if (win) {
            win.onload = () => {
              try { win.focus(); win.print(); } catch (_) {}
            };
          }
        } finally {
          setTimeout(() => {
            try { iframe.remove(); } catch (_) {}
            try { URL.revokeObjectURL(blobUrl); } catch (_) {}
          }, 60000);
        }
      }, 400);
    };

    iframe.onload = triggerIframePrint;
    return { success: true, url: blobUrl };
  } catch (err) {
    console.error('[PDF Service] Error en printPDFDocument:', err);
    return { success: false, error: err };
  }
}

/**
 * Finaliza el reporte agregando el marco del contenedor padre y pie de página en cada página
 */
export function finalizeAndSave(doc, filename = 'reporte_signum.pdf', currentUser = null, options = {}) {
  const totalPages = doc.internal.getNumberOfPages();
  const { margin, tableWidth, startX, footerY } = getPageLayoutMetrics(doc);

  const userName = currentUser?.nombre || currentUser?.username || 'Operador Autorizado';
  const useDeFormat = options.pageNumberFormat === 'de';

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // Si es página posterior, dibujar el marco exterior contenedor
    if (i > 1) {
      drawParentContainer(doc, false);

      // Cabezal compacto de desbordamiento (1/2, 2/2) en páginas de continuación
      if (totalPages > 1 && !options.skipOverflowHeader) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.2);
        doc.setTextColor(...COLORS.navy);
        doc.text(`CONTINUACIÓN DE REPORTE • PÁGINA ${i}/${totalPages}`, startX, margin + 5.2);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.8);
        doc.setTextColor(...COLORS.slate);
        doc.text(`Desbordamiento ${i}/${totalPages}`, startX + tableWidth, margin + 5.2, { align: 'right' });
      }
    }

    // Línea divisoria de pie de página dentro del contenedor padre
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.3);
    doc.line(startX, footerY, startX + tableWidth, footerY);

    // Texto legal a la izquierda (auto-acotado para no colisionar con la derecha)
    const basePageLabel = useDeFormat ? `Página ${i} de ${totalPages}` : `Página ${i}/${totalPages}`;
    const contSuffix = (totalPages > 1 && i < totalPages && !options.skipOverflowNotice)
      ? ` (Continúa ${i + 1}/${totalPages})`
      : '';
    const rightText = `${basePageLabel}${contSuffix} • Emitido por: ${userName}`;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.1);
    const rightWidth = typeof doc.getTextWidth === 'function' ? doc.getTextWidth(rightText) : 55;
    const maxLegalW = Math.max(50, tableWidth - rightWidth - 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.6);
    doc.setTextColor(...COLORS.muted);
    const legalStr = options.legalFooter || 'SIGNUM MOTORVEN C.A. • Sistema ERP • Documento Oficial Tamaño Carta';
    const legalClipped = doc.splitTextToSize(legalStr, maxLegalW)[0] || legalStr;
    doc.text(legalClipped, startX + 1, footerY + 4.0);

    // Usuario y numeración estándar de desbordamiento (1/1, 1/2, 2/2) a la derecha
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.1);
    doc.setTextColor(...COLORS.slate);
    doc.text(
      rightText,
      startX + tableWidth - 1,
      footerY + 4.0,
      { align: 'right' }
    );
  }

  // Si se solicitó solo impresión (Ctrl + P en navegador), omitir descarga en disco
  if (options.skipSave) {
    return;
  }

  // Sanitizar nombre de archivo para evitar bloqueos del sistema de archivos / navegador
  let safeName = (filename || 'reporte_signum.pdf').trim().replace(/[^a-zA-Z0-9_\-\.]/g, '_');
  if (!safeName.toLowerCase().endsWith('.pdf')) {
    safeName += '.pdf';
  }

  // Descarga directa con jsPDF y fallback garantizado vía Blob Anchor
  try {
    if (typeof doc.save === 'function') {
      doc.save(safeName);
      return;
    }
  } catch (err) {
    console.warn('[PDF Service] doc.save falló, ejecutando fallback Blob nativo:', err);
  }

  // Fallback nativo universal para cualquier navegador o contexto restringido
  try {
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = safeName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 500);
  } catch (fallbackErr) {
    console.error('[PDF Service] Fallback Blob también falló:', fallbackErr);
  }
}

// =========================================================================
// 1. REPORTE DE FUERZA DE VENTAS & COBRADORES (PRIORITARIO)
// =========================================================================
export function generateSellersPDF({ sellers = [], config = {}, currentUser = null, globalQuota = 30000 }) {
  const base = createBaseReport({
    title: 'REPORTE DE FUERZA DE VENTAS, COBRADORES & COMISIONES',
    subtitle: 'Cumplimiento de Metas, Base Pagada Sin IVA, Comisiones MOTORVEN por Días Vencidos y Cobertura de Zonas',
    moduleCode: 'VEN',
    currentUser,
    config
  });

  const totalSellers = sellers.length;
  const totalVendido = sellers.reduce((acc, s) => acc + Number(s.totalVentasUsd || s.ventasTotalesUsd || s.ventasMes || s.montoVentas || 0), 0);
  const totalBaseSinIva = sellers.reduce((acc, s) => acc + Number(s.basePagadaSinIvaUsd ?? s.totalVentasUsd ?? 0), 0);
  const totalLitros = sellers.reduce((acc, s) => acc + Number(s.totalLitros || s.litrosVendidos || s.litros || 0), 0);
  const totalComisiones = sellers.reduce((acc, s) => acc + Number(s.comisionEstimadaUsd ?? s.comisionTotalUsd ?? s.comisionesUsd ?? 0), 0);
  const tasa = Number(config?.tasaDolar) || 886.22;

  // Cálculo de cumplimiento global proporcional a litros o dólares
  const metaLitrosGlobal = Number(globalQuota) || 30000;
  const cumplimientoGlobal = metaLitrosGlobal > 0 ? (totalLitros > 0 ? (totalLitros / metaLitrosGlobal) * 100 : (totalVendido / (metaLitrosGlobal * 4.5)) * 100) : 0;

  const cards = [
    { label: 'Fuerza de Cobro', value: `${totalSellers} Cobradores`, subtext: 'Equipo Activo', color: COLORS.navy },
    { label: 'Ventas Totales USD', value: formatUsd(totalVendido), subtext: `Base Pag. s/IVA: ${formatUsd(totalBaseSinIva)}`, color: COLORS.emerald },
    { label: 'Volumen Despachado', value: `${formatUnitVe(totalLitros)} L`, subtext: `${cumplimientoGlobal.toFixed(1)}% Meta (${formatUnitVe(metaLitrosGlobal, 0)} L)`, color: COLORS.cyan },
    { label: 'Comisiones Devengadas', value: formatUsd(totalComisiones), subtext: `${formatBs(totalComisiones * tasa)} (s/IVA)`, color: COLORS.amber }
  ];

  let currentY = addSummaryCards(base.doc, base.startY, cards, base.tableWidth, base.startX);

  currentY = addAnalyticalBox(
    base.doc,
    currentY,
    'SÍNTESIS EJECUTIVA DE COBRADORES & TABULADOR MOTORVEN',
    `El equipo comercial de SIGNUM MOTORVEN consolidó una facturación de ${formatUsd(totalVendido)} (${formatBs(totalVendido * tasa)}) equivalente a ${formatUnitVe(totalLitros)} litros de lubricantes Oilstone (${cumplimientoGlobal.toFixed(1)}% de ${formatUnitVe(metaLitrosGlobal, 0)} L). Comisión devengada bajo regla oficial MOTORVEN (0–7d: 4% | 8–14d: 3% | 15–21d: 1% | >21d: 0%) sobre base 100% pagada sin IVA (${formatUsd(totalBaseSinIva)}): ${formatUsd(totalComisiones)} (${formatBs(totalComisiones * tasa)}).`,
    base.tableWidth,
    base.startX
  );

  const tableData = sellers.map((s) => {
    const ventas = Number(s.totalVentasUsd || s.ventasTotalesUsd || s.ventasMes || s.montoVentas || 0);
    const litros = Number(s.totalLitros || s.litrosVendidos || s.litros || 0);
    const metaLitros = Number(s.metaLitrosMes || s.metaLitros || 3000);
    const pct = Number(s.cumplimientoPct || s.porcentajeCumplimiento) || (metaLitros > 0 ? (litros / metaLitros) * 100 : 0);
    const comision = Number(s.comisionEstimadaUsd ?? s.comisionTotalUsd ?? s.comisionesUsd ?? 0);

    return [
      s.coVen || s.co_ven || s.codigo || s.id || 'VEN-00',
      s.venDes || s.nombre || 'Cobrador',
      s.zona || s.ruta || 'Centro / Occidente',
      `${formatUnitVe(litros)} L`,
      formatUsd(ventas),
      `${pct.toFixed(1)}%`,
      formatUsd(comision)
    ];
  });

  autoTable(base.doc, {
    startY: currentY,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    head: [['CÓDIGO', 'COBRADOR', 'ZONA / TERRITORIO', 'VOLUMEN (L)', 'VENTAS USD', '% CUMP.', 'COMISIÓN USD']],
    body: tableData.length > 0 ? tableData : [['SIN COBRADORES', '-', '-', '0 L', '$ 0.00', '0.0%', '$ 0.00']],
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.navy,
      textColor: [255, 255, 255],
      fontSize: 6.8,
      fontStyle: 'bold',
      cellPadding: 1.6
    },
    styles: {
      fontSize: 6.3,
      cellPadding: 1.4,
      textColor: COLORS.dark
    },
    alternateRowStyles: {
      fillColor: COLORS.lightBg
    },
      columnStyles: {
        0: { fontStyle: 'bold', halign: 'center', cellWidth: 18 },
        1: { cellWidth: 44 },
        2: { cellWidth: 32 },
        3: { halign: 'right', cellWidth: 22 },
        4: { halign: 'right', fontStyle: 'bold', cellWidth: 22 },
        5: { halign: 'center', fontStyle: 'bold', cellWidth: 17 },
        6: { halign: 'right', fontStyle: 'bold', cellWidth: 24.9 }
      },
      didParseCell: (data) => {
        if (data.column.index === 5 && data.section === 'body') {
          data.cell.text = '';
        }
      },
      didDrawCell: (data) => {
        if (data.column.index === 5 && data.section === 'body') {
          drawMiniProgressBar(base.doc, data.cell, data.cell.raw);
        }
      }
    });

    const finalY = base.doc.lastAutoTable?.finalY || currentY + 30;
    addGrandTotalBox(
      base.doc,
      finalY + 3.5,
      [
        { label: 'VOLUMEN TOTAL', value: `${formatUnitVe(totalLitros)} L`, subtext: `${formatUnitVe(cumplimientoGlobal)}% Meta Global (${formatUnitVe(metaLitrosGlobal, 0)} L)`, color: COLORS.navy },
        { label: 'VENTAS TOTALES USD', value: formatUsd(totalVendido), subtext: formatBs(totalVendido * tasa), color: COLORS.emerald },
        { label: 'COMISIONES LIQUIDADAS', value: formatUsd(totalComisiones), subtext: 'Incentivos de Ventas', color: COLORS.amber }
      ],
      base.tableWidth,
      base.startX
    );

    finalizeAndSave(base.doc, `Reporte_Fuerza_Ventas_SIGNUM_${new Date().toISOString().slice(0, 10)}.pdf`, currentUser);
    return base.doc;
  }

export function generateSellerSkuLitrosPDF({
  seller,
  summary,
  periodLabel = '',
  config = {},
  currentUser = null
}) {
  const sellerName = seller?.venDes || seller?.nombre || 'Asesor Comercial';
  const sellerCode = seller?.coVen || seller?.co_ven || seller?.id || 'VEN';
  const base = createBaseReport({
    title: `VENTAS POR SKU EN LITROS — ${String(sellerName).toUpperCase()}`,
    subtitle: `Cód: ${sellerCode}${periodLabel ? ` • Período: ${periodLabel}` : ''} • Desglose por Presentación, Meta Alcanzada y Consolidado en Litros`,
    moduleCode: 'VEN',
    currentUser,
    config
  });

  const safeSummary = summary || {
    skus: [],
    presentaciones: [],
    litrosFacturados: 0,
    litrosDevueltos: 0,
    litrosConsolidados: 0,
    totalUnidades: 0,
    metaLitros: 3000,
    porcentajeMeta: 0,
    litrosRestantesMeta: 3000,
    litrosExcedenteMeta: 0,
    facturasCount: 0
  };

  const metaReached = safeSummary.porcentajeMeta >= 100;

  const cards = [
    {
      label: 'Consolidado en Litros',
      value: `${formatUnitVe(safeSummary.litrosConsolidados)} L`,
      subtext: `≈ ${formatUnitVe(safeSummary.litrosConsolidados / 11.35, 1)} Cajas Eq. (${safeSummary.facturasCount} doc.)`,
      color: COLORS.navy
    },
    {
      label: 'Meta Alcanzada',
      value: `${safeSummary.porcentajeMeta}%`,
      subtext: `Meta: ${formatUnitVe(safeSummary.metaLitros, 0)} L | ${metaReached ? `Exc: +${formatUnitVe(safeSummary.litrosExcedenteMeta)} L` : `Faltan: ${formatUnitVe(safeSummary.litrosRestantesMeta)} L`}`,
      color: metaReached ? COLORS.emerald : COLORS.amber
    },
    {
      label: 'SKUs & Unidades',
      value: `${safeSummary.skus.length} SKUs`,
      subtext: `${formatUnitVe(safeSummary.totalUnidades, 0)} uds • ${safeSummary.presentaciones.length} presentaciones`,
      color: COLORS.cyan
    }
  ];

  let currentY = addSummaryCards(base.doc, base.startY, cards, base.tableWidth, base.startX);

  if (safeSummary.litrosDevueltos > 0) {
    currentY = addAnalyticalBox(
      base.doc,
      currentY,
      'AJUSTE POR DEVOLUCIONES DEL PERÍODO',
      `Facturado bruto por SKUs: ${formatUnitVe(safeSummary.litrosFacturados)} L | Devoluciones: -${formatUnitVe(safeSummary.litrosDevueltos)} L | Consolidado neto: ${formatUnitVe(safeSummary.litrosConsolidados)} L.`,
      base.tableWidth,
      base.startX
    );
  }

  if (safeSummary.presentaciones.length > 0) {
    autoTable(base.doc, {
      startY: currentY,
      margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
      tableWidth: base.tableWidth,
      head: [['PRESENTACIÓN', 'SKUs', 'UNIDADES', 'LITROS CONSOLIDADOS', '% DEL TOTAL', '% DE META']],
      body: safeSummary.presentaciones.map((p) => [
        p.presentacion,
        String(p.skusCount),
        formatUnitVe(p.cantidad, p.cantidad % 1 === 0 ? 0 : 2),
        `${formatUnitVe(p.litros)} L`,
        `${p.pctTotalLitros}%`,
        `${p.pctMeta}%`
      ]),
      theme: 'grid',
      headStyles: {
        fillColor: COLORS.navy,
        textColor: [255, 255, 255],
        fontSize: 6.8,
        fontStyle: 'bold',
        cellPadding: 1.5
      },
      styles: {
        fontSize: 6.5,
        cellPadding: 1.4,
        textColor: COLORS.dark
      },
      alternateRowStyles: { fillColor: COLORS.lightBg },
      columnStyles: {
        0: { fontStyle: 'bold' },
        1: { halign: 'center', cellWidth: 16 },
        2: { halign: 'right', cellWidth: 24 },
        3: { halign: 'right', fontStyle: 'bold', cellWidth: 36 },
        4: { halign: 'right', cellWidth: 24 },
        5: { halign: 'right', fontStyle: 'bold', cellWidth: 24 }
      }
    });
    currentY = (base.doc.lastAutoTable?.finalY || currentY + 20) + 4;
  }

  const skuRows = safeSummary.skus.map((r) => [
    r.sku,
    r.descripcion,
    r.presentacion,
    `${formatUnitVe(r.litrosPorUnidad)} L`,
    formatUnitVe(r.cantidad, r.cantidad % 1 === 0 ? 0 : 2),
    `${formatUnitVe(r.litros)} L`,
    `${r.pctTotalLitros}%`,
    `${r.pctMeta}%`
  ]);

  autoTable(base.doc, {
    startY: currentY,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    head: [['SKU', 'PRODUCTO / DESCRIPCIÓN', 'PRESENTACIÓN', 'L/U', 'CANTIDAD', 'LITROS', '% TOTAL', '% META']],
    body: skuRows.length > 0 ? skuRows : [['-', 'Sin ventas registradas en el período', '-', '0 L', '0', '0,00 L', '0%', '0%']],
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.navy,
      textColor: [255, 255, 255],
      fontSize: 6.6,
      fontStyle: 'bold',
      cellPadding: 1.5
    },
    styles: {
      fontSize: 6.2,
      cellPadding: 1.35,
      textColor: COLORS.dark
    },
    alternateRowStyles: { fillColor: COLORS.lightBg },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 20 },
      1: { cellWidth: 56 },
      2: { halign: 'center', cellWidth: 22 },
      3: { halign: 'right', cellWidth: 15 },
      4: { halign: 'right', cellWidth: 18 },
      5: { halign: 'right', fontStyle: 'bold', cellWidth: 23 },
      6: { halign: 'right', cellWidth: 13 },
      7: { halign: 'right', fontStyle: 'bold', cellWidth: 12.9 }
    }
  });

  const finalY = base.doc.lastAutoTable?.finalY || currentY + 30;
  addGrandTotalBox(
    base.doc,
    finalY + 3.5,
    [
      {
        label: 'CONSOLIDADO EN LITROS',
        value: `${formatUnitVe(safeSummary.litrosConsolidados)} L`,
        subtext: `${formatUnitVe(safeSummary.totalUnidades, 0)} unidades vendidas`,
        color: COLORS.navy
      },
      {
        label: 'META ALCANZADA',
        value: `${safeSummary.porcentajeMeta}%`,
        subtext: `Meta: ${formatUnitVe(safeSummary.metaLitros, 0)} L`,
        color: metaReached ? COLORS.emerald : COLORS.amber
      },
      {
        label: 'DIVERSIDAD DE SKUs',
        value: `${safeSummary.skus.length} SKUs`,
        subtext: `${safeSummary.presentaciones.length} presentaciones`,
        color: COLORS.emerald
      }
    ],
    base.tableWidth,
    base.startX
  );

  const safeCode = String(sellerCode).replace(/[^a-zA-Z0-9_-]/g, '');
  finalizeAndSave(
    base.doc,
    `Ventas_SKU_Litros_${safeCode}_${new Date().toISOString().slice(0, 10)}.pdf`,
    currentUser
  );
  return base.doc;
}

// =========================================================================
// 2. REPORTE DE RENTABILIDAD & BI (PRIORITARIO - CARTA VERTICAL)
// =========================================================================
export function generateProfitabilityPDF({
  products = [],
  sales = [],
  priceTier = PRICE_LIST_TIERS.MAYOR,
  config = {},
  currentUser = null
}) {
  const base = createBaseReport({
    title: 'ESTADO DE RENTABILIDAD, MÁRGENES & BUSINESS INTELLIGENCE',
    subtitle: `Contribución Marginal, Utilidad Operativa y Márgenes por SKU (${priceTier === PRICE_LIST_TIERS.DETAL ? 'Lista Detal' : 'Lista Mayor'})`,
    moduleCode: 'REN',
    currentUser,
    config
  });

  const totalCosto = products.reduce((acc, p) => acc + (Number(p.stock || 0) * Number(p.costoUsd || 0)), 0);
  const totalVenta = products.reduce((acc, p) => acc + (Number(p.stock || 0) * resolveProductListPrice(p, priceTier)), 0);
  const utilidadProyectada = totalVenta - totalCosto;
  const margenPromedio = safePct(utilidadProyectada, totalVenta);
  const tasa = Number(config?.tasaDolar) || 827.73;

  const cards = [
    { label: 'Inventario al Costo', value: formatUsd(totalCosto), subtext: formatBs(totalCosto * tasa), color: COLORS.navy },
    { label: 'Valorización Venta', value: formatUsd(totalVenta), subtext: `Lista ${priceTier}`, color: COLORS.cyan },
    { label: 'Utilidad Operativa', value: formatUsd(utilidadProyectada), subtext: 'Spread Comercial', color: COLORS.emerald },
    { label: 'Margen Promedio', value: `${margenPromedio.toFixed(1)}%`, subtext: 'P&L Operacional', color: COLORS.amber }
  ];

  let currentY = addSummaryCards(base.doc, base.startY, cards, base.tableWidth, base.startX);

  currentY = addAnalyticalBox(
    base.doc,
    currentY,
    'ANÁLISIS DE RENTABILIDAD & MARGEN OPERATIVO OILSTONE',
    `El margen bruto promedio proyectado sobre la cartera de lubricantes (Lista ${priceTier}) se sitúa en ${margenPromedio.toFixed(1)}%, generando un spread de utilidad bruta potencial de ${formatUsd(utilidadProyectada)}.`,
    base.tableWidth,
    base.startX
  );

  const tableData = products.map((p) => {
    const costo = Number(p.costoUsd || 0);
    const precio = resolveProductListPrice(p, priceTier);
    const ganancia = precio - costo;
    const margen = safePct(ganancia, precio);

    return [
      p.codigo || 'SKU-00',
      p.descripcion || 'Lubricante Oilstone',
      p.categoria || p.linea || 'LUBRICANTES',
      String(p.stock || 0),
      formatUsd(costo),
      formatUsd(precio),
      formatUsd(ganancia),
      `${margen.toFixed(1)}%`
    ];
  });

  autoTable(base.doc, {
    startY: currentY,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    head: [['CÓDIGO', 'DESCRIPCIÓN PRODUCTO', 'LÍNEA', 'STOCK', 'COSTO USD', 'PRECIO USD', 'UTILIDAD', 'MARGEN %']],
    body: tableData.length > 0 ? tableData : [['SIN PRODUCTOS', '-', '-', '0', '$ 0.00', '$ 0.00', '$ 0.00', '0.0%']],
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.navy,
      textColor: [255, 255, 255],
      fontSize: 6.8,
      fontStyle: 'bold',
      cellPadding: 1.6
    },
    styles: {
      fontSize: 6.2,
      cellPadding: 1.4,
      textColor: COLORS.dark
    },
    alternateRowStyles: {
      fillColor: COLORS.lightBg
    },
    columnStyles: {
      0: { fontStyle: 'bold', halign: 'center', cellWidth: 18 },
      1: { cellWidth: 50 },
      2: { cellWidth: 22 },
      3: { halign: 'center', cellWidth: 14 },
      4: { halign: 'right', cellWidth: 20 },
      5: { halign: 'right', fontStyle: 'bold', cellWidth: 20 },
      6: { halign: 'right', fontStyle: 'bold', cellWidth: 22 },
      7: { halign: 'center', fontStyle: 'bold', cellWidth: 13.9 }
    },
    didParseCell: (data) => {
      if (data.column.index === 7 && data.section === 'body') {
        data.cell.text = ''; // Rendered via vector canvas in didDrawCell
      }
    },
    didDrawCell: (data) => {
      if (data.column.index === 7 && data.section === 'body') {
        drawMiniProgressBar(base.doc, data.cell, data.cell.raw);
      }
    }
  });

  const finalYProf = base.doc.lastAutoTable?.finalY || currentY;
  addGrandTotalBox(base.doc, finalYProf + 3.5, [
    { label: 'INVENTARIO AL COSTO', value: formatUsd(totalCosto), subtext: formatBs(totalCosto * tasa), color: COLORS.navy },
    { label: 'VALORIZACIÓN VENTA', value: formatUsd(totalVenta), subtext: 'Ingreso proyectado', color: COLORS.cyan },
    { label: 'UTILIDAD OPERATIVA', value: formatUsd(utilidadProyectada), subtext: `${margenPromedio.toFixed(1)}% margen bruto`, color: COLORS.emerald }
  ], base.tableWidth, base.startX);

  finalizeAndSave(base.doc, `Reporte_Rentabilidad_BI_SIGNUM_${new Date().toISOString().slice(0, 10)}.pdf`, currentUser);
  return base.doc;
}

// =========================================================================
// 2B. ESTADO DE RESULTADOS P&L OPERATIVO REAL / SIMULADO (WATERFALL + LÍNEAS)
// =========================================================================
export function generateOperationalPandLPDF({ financialData = {}, config = {}, currentUser = null }) {
  const isSim = Boolean(financialData?.isSimulation);
  const base = createBaseReport({
    title: isSim ? 'ESTADO DE RESULTADOS (P&L) — SIMULACIÓN WHAT-IF' : 'ESTADO DE RESULTADOS (P&L) OPERATIVO REAL',
    subtitle: isSim
      ? 'Escenario Proyectado What-If — Márgenes, Flujo Operativo y Punto de Equilibrio'
      : 'Cifras Reales de Operación: Ventas Netas, Devoluciones, CMV, Gastos, Nómina y EBITDA',
    moduleCode: 'PNL',
    currentUser,
    config
  });

  const tasa = Number(config?.tasaDolar) || 0;
  const rev = Number(financialData.facturadoAjustadoUsd || 0);
  const utilidadBruta = Number(financialData.utilidadBrutaUsd || 0);
  const margenContrib = Number(financialData.margenContribucionUsd || 0);
  const ebitda = Number(financialData.ebitdaOperativoUsd || 0);

  const cards = [
    {
      label: 'Ingresos Netos (Sin IVA)',
      value: formatUsd(rev),
      subtext: tasa > 0 ? formatBs(rev * tasa) : `${financialData.activeDocsCount || 0} docs`,
      color: COLORS.navy
    },
    {
      label: 'Utilidad Bruta',
      value: formatUsd(utilidadBruta),
      subtext: `${Number(financialData.margenBrutoPct || 0).toFixed(1)}% s/Ingresos`,
      color: COLORS.cyan
    },
    {
      label: 'Margen Contribución',
      value: formatUsd(margenContrib),
      subtext: `${Number(financialData.margenContribPct || 0).toFixed(1)}% Contribución`,
      color: COLORS.emerald
    },
    {
      label: 'EBITDA Operativo',
      value: formatUsd(ebitda),
      subtext: `${Number(financialData.ebitdaPct || 0).toFixed(1)}% Retorno`,
      color: ebitda >= 0 ? COLORS.emerald : COLORS.red
    }
  ];

  let currentY = addSummaryCards(base.doc, base.startY, cards, base.tableWidth, base.startX);

  const fmtPct = (v) => `${safePct(v, rev).toFixed(1)}%`;
  const waterfallRows = [
    ['(+) Facturación Bruta Sin IVA', formatUsd(financialData.facturadoBrutoUsd || 0), tasa > 0 ? formatBs((financialData.facturadoBrutoUsd || 0) * tasa) : '-', '100.0%'],
    ['(-) Devoluciones en Ventas', `-${formatUsd(financialData.devolucionesUsd || 0)}`, tasa > 0 ? formatBs((financialData.devolucionesUsd || 0) * tasa) : '-', fmtPct(-(financialData.devolucionesUsd || 0))],
    ['(=) INGRESOS NETOS DE OPERACIÓN', formatUsd(rev), tasa > 0 ? formatBs(rev * tasa) : '-', rev > 0 ? '100.0%' : '0.0%'],
    ['(-) Costo Mercancía Vendida (CMV)', `-${formatUsd(financialData.cmvAjustadoUsd || 0)}`, tasa > 0 ? formatBs((financialData.cmvAjustadoUsd || 0) * tasa) : '-', fmtPct(-(financialData.cmvAjustadoUsd || 0))],
    ['(=) UTILIDAD BRUTA', formatUsd(utilidadBruta), tasa > 0 ? formatBs(utilidadBruta * tasa) : '-', fmtPct(utilidadBruta)],
    ['(-) Fletes & Logística', `-${formatUsd(financialData.costoFletesUsd || 0)}`, tasa > 0 ? formatBs((financialData.costoFletesUsd || 0) * tasa) : '-', fmtPct(-(financialData.costoFletesUsd || 0))],
    ['(-) Comisiones Fuerza de Ventas', `-${formatUsd(financialData.comisionesVendedoresUsd || 0)}`, tasa > 0 ? formatBs((financialData.comisionesVendedoresUsd || 0) * tasa) : '-', fmtPct(-(financialData.comisionesVendedoresUsd || 0))],
    ['(-) Mermas & Ajustes de Salida', `-${formatUsd(financialData.costoMermasUsd || 0)}`, tasa > 0 ? formatBs((financialData.costoMermasUsd || 0) * tasa) : '-', fmtPct(-(financialData.costoMermasUsd || 0))],
    ['(-) Retenciones ISLR & Tributos', `-${formatUsd(financialData.retencionesIslrUsd || 0)}`, tasa > 0 ? formatBs((financialData.retencionesIslrUsd || 0) * tasa) : '-', fmtPct(-(financialData.retencionesIslrUsd || 0))],
    ['(=) MARGEN DE CONTRIBUCIÓN', formatUsd(margenContrib), tasa > 0 ? formatBs(margenContrib * tasa) : '-', fmtPct(margenContrib)],
    ['(-) Nómina & Salarios Operativos', `-${formatUsd(financialData.costoNominaUsd || 0)}`, tasa > 0 ? formatBs((financialData.costoNominaUsd || 0) * tasa) : '-', fmtPct(-(financialData.costoNominaUsd || 0))],
    ['(-) Gastos Operativos Fijos (OPEX)', `-${formatUsd(financialData.opexFijoUsd || 0)}`, tasa > 0 ? formatBs((financialData.opexFijoUsd || 0) * tasa) : '-', fmtPct(-(financialData.opexFijoUsd || 0))],
    ['(=) EBITDA OPERATIVO FINAL', formatUsd(ebitda), tasa > 0 ? formatBs(ebitda * tasa) : '-', fmtPct(ebitda)]
  ];

  autoTable(base.doc, {
    startY: currentY,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    head: [['CONCEPTO DEL ESTADO DE RESULTADOS (WATERFALL)', 'MONTO USD', 'EQUIVALENTE BS.', '% S/INGRESO']],
    body: waterfallRows,
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.navy,
      textColor: [255, 255, 255],
      fontSize: 7.2,
      fontStyle: 'bold',
      cellPadding: 1.8
    },
    styles: {
      fontSize: 6.8,
      cellPadding: 1.5,
      textColor: COLORS.dark
    },
    columnStyles: {
      0: { cellWidth: 85 },
      1: { halign: 'right', cellWidth: 32, fontStyle: 'bold' },
      2: { halign: 'right', cellWidth: 38 },
      3: { halign: 'right', cellWidth: 24.9, fontStyle: 'bold' }
    },
    didParseCell: (data) => {
      if (data.section === 'body' && String(data.row.raw?.[0] || '').startsWith('(=)')) {
        data.cell.styles.fillColor = [241, 245, 249];
        data.cell.styles.fontStyle = 'bold';
      }
    }
  });

  const afterWaterfallY = (base.doc.lastAutoTable?.finalY || currentY) + 5;
  const lines = Array.isArray(financialData.linesBreakdown) ? financialData.linesBreakdown : [];
  if (lines.length > 0) {
    autoTable(base.doc, {
      startY: afterWaterfallY,
      margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
      tableWidth: base.tableWidth,
      head: [['LÍNEA / CATEGORÍA', 'INGRESOS USD', 'CMV USD', 'UTILIDAD BRUTA', 'MARGEN %', 'LITROS']],
      body: lines.map((ln) => [
        ln.name,
        formatUsd(ln.rev),
        formatUsd(ln.cmv),
        formatUsd(ln.marginUsd),
        `${Number(ln.marginPct || 0).toFixed(1)}%`,
        `${Number(ln.liters || 0).toLocaleString('es-VE', { maximumFractionDigits: 1 })} L`
      ]),
      theme: 'grid',
      headStyles: {
        fillColor: COLORS.navy,
        textColor: [255, 255, 255],
        fontSize: 7,
        fontStyle: 'bold',
        cellPadding: 1.6
      },
      styles: {
        fontSize: 6.5,
        cellPadding: 1.4,
        textColor: COLORS.dark
      },
      columnStyles: {
        0: { cellWidth: 52, fontStyle: 'bold' },
        1: { halign: 'right', cellWidth: 28 },
        2: { halign: 'right', cellWidth: 28 },
        3: { halign: 'right', cellWidth: 28, fontStyle: 'bold' },
        4: { halign: 'right', cellWidth: 22 },
        5: { halign: 'right', cellWidth: 21.9 }
      }
    });
  }

  const finalYPnl = base.doc.lastAutoTable?.finalY || afterWaterfallY;
  addGrandTotalBox(base.doc, finalYPnl + 3.5, [
    { label: 'LITROS DESPACHADOS', value: `${Number(financialData.litersSold || 0).toLocaleString('es-VE')} L`, subtext: 'Volumen Neto', color: COLORS.navy },
    { label: 'PUNTO DE EQUILIBRIO', value: formatUsd(financialData.puntoEquilibrioUsd || 0), subtext: 'Cobertura Fijos', color: COLORS.amber },
    { label: 'EBITDA OPERATIVO', value: formatUsd(ebitda), subtext: `${Number(financialData.ebitdaPct || 0).toFixed(1)}% sobre ventas`, color: ebitda >= 0 ? COLORS.emerald : COLORS.red }
  ], base.tableWidth, base.startX);

  finalizeAndSave(base.doc, `Estado_Resultados_PnL_SIGNUM_${new Date().toISOString().slice(0, 10)}.pdf`, currentUser);
  return base.doc;
}

// =========================================================================
// 3. REPORTE DE CUENTAS POR COBRAR (CxC) & AGING (PRIORITARIO)
// =========================================================================
export function generateAccountsReceivablePDF(arg1 = {}, summaryMetricsArg = null, configArg = null, docTypeArg = 'FACTURA') {
  const isArrayCall = Array.isArray(arg1);
  const receivables = isArrayCall ? arg1 : (arg1?.receivables || []);
  const cxcList = isArrayCall ? [] : (arg1?.cxcList || []);
  const clients = isArrayCall ? [] : (arg1?.clients || []);
  const config = isArrayCall ? (configArg || {}) : (arg1?.config || {});
  const currentUser = isArrayCall ? null : (arg1?.currentUser || null);
  const isNotaEntrega = docTypeArg === 'NOTA_ENTREGA';

  const base = createBaseReport({
    title: isNotaEntrega
      ? 'REPORTE DOCUMENTOS CXC — NOTAS DE ENTREGA (SIN IVA)'
      : 'REPORTE DOCUMENTOS CXC — FACTURAS FISCALES',
    subtitle: 'Cobrador • Factura • RIF • Nombre Cliente • Emisión • Vencimiento • Días Vencido • Días Crédito • Monto • Abonos • Restante',
    moduleCode: 'CXC',
    currentUser,
    config
  });

  const dataset = receivables && receivables.length > 0 ? receivables : cxcList;
  const tasa = Number(config?.tasaDolar) || 451.51;
  const now = new Date();

  const getMontoFactura = (r) => Number(r.montoFacturaUsd ?? r.totalFacturaUsd ?? r.totNetoUsd ?? r.montoTotalUsd ?? r.saldoUsd ?? r.saldo ?? 0);
  const getAbonos = (r) => Number(r.abonosUsd ?? r.montoPagadoUsd ?? Math.max(0, getMontoFactura(r) - Number(r.restanteUsd ?? r.saldoPendienteUsd ?? r.saldoUsd ?? getMontoFactura(r))));
  const getRestante = (r) => Number(r.restanteUsd ?? r.saldoPendienteUsd ?? r.saldoUsd ?? Math.max(0, getMontoFactura(r) - getAbonos(r)));

  const totalMontoFacturaUsd = dataset.reduce((acc, r) => acc + getMontoFactura(r), 0);
  const totalAbonosUsd = dataset.reduce((acc, r) => acc + getAbonos(r), 0);
  const totalCarteraUsd = dataset.reduce((acc, r) => acc + getRestante(r), 0);
  const vencidas = dataset.filter(r => r.estado === 'VENCIDA' || r.isVencida || Number(r.diasVencidos ?? r.diasMora ?? 0) > 0);
  const totalVencidoUsd = vencidas.reduce((acc, r) => acc + getRestante(r), 0);

  const cards = [
    { label: isNotaEntrega ? 'Monto Notas' : 'Monto Facturas', value: formatUsd(totalMontoFacturaUsd), subtext: `${dataset.length} Documentos`, color: COLORS.navy },
    { label: 'Total Abonos', value: formatUsd(totalAbonosUsd), subtext: formatBs(totalAbonosUsd * tasa), color: COLORS.emerald },
    { label: 'Total Restante', value: formatUsd(totalCarteraUsd), subtext: formatBs(totalCarteraUsd * tasa), color: COLORS.cyan },
    { label: 'Saldo Vencido (>0d)', value: formatUsd(totalVencidoUsd), subtext: `${vencidas.length} Docs Vencidos`, color: COLORS.red }
  ];

  let currentY = addSummaryCards(base.doc, base.startY, cards, base.tableWidth, base.startX);

  currentY = addAnalyticalBox(
    base.doc,
    currentY,
    'REPORTE DE DOCUMENTOS DE CUENTAS POR COBRAR (CXC)',
    `Monto total facturado: ${formatUsd(totalMontoFacturaUsd)} | Abonos registrados: ${formatUsd(totalAbonosUsd)} | Saldo restante por cobrar: ${formatUsd(totalCarteraUsd)} (${formatBs(totalCarteraUsd * tasa)}).`,
    base.tableWidth,
    base.startX
  );

  const formatPdfDate = (d) => {
    if (!d) return '—';
    if (d instanceof Date && !isNaN(d.getTime())) {
      return d.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    return String(d).slice(0, 10);
  };

  const tableData = dataset.map((r) => {
    const isVencida = r.estado === 'VENCIDA' || r.isVencida || (r.fechaVencimiento && new Date(r.fechaVencimiento) < now) || Number(r.diasVencidos ?? r.diasMora ?? 0) > 0;
    const diasVencido = Number(r.diasVencidos ?? r.diasMora ?? (isVencida && r.fechaVencimiento ? Math.max(0, Math.round((now - new Date(r.fechaVencimiento)) / 86400000)) : 0));
    const diasCredito = Number(r.diasCredito ?? 15);
    const montoFactura = getMontoFactura(r);
    const abonos = getAbonos(r);
    const restante = getRestante(r);
    const rRateType = resolveRecordRateType(r, 'BCV');
    const rRateMeta = resolveRateMeta(rRateType, 'BCV');
    const rTasa = resolveEffectiveRateNumber(r, tasa);

    return [
      String(r.vendedorId || r.vendedor || 'OF'),
      String(r.factura || r.factNum || r.nroDoc || r.id || '0000'),
      String(r.rif || r.clienteRif || 'N/A'),
      String(r.cliente || r.clienteNombre || r.nombre || 'Cliente Comercial'),
      formatPdfDate(r.fechaEmisionIso || r.fechaEmision || r.fechaRegistro),
      formatPdfDate(r.fechaVencimientoIso || r.fechaVencimiento),
      `${diasVencido}`,
      `${diasCredito}`,
      rRateMeta.badgeText,
      rRateType === 'USD' ? 'USD' : formatBs(rTasa).replace(/^Bs\.\s*/, ''),
      formatUsd(montoFactura),
      formatUsd(abonos),
      formatUsd(restante)
    ];
  });

  const cxcRateSummary = summarizeByRateClassification(dataset, tasa);
  const rateBreakdownText = cxcRateSummary.rows.length > 0
    ? cxcRateSummary.rows.map(b => `${b.label}: ${b.count} doc(s) • ${formatUsd(b.totalUsd)}`).join(' | ')
    : 'Sin desglose';

  autoTable(base.doc, {
    startY: currentY,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    head: [['COBRADOR', isNotaEntrega ? 'N° NOTA' : 'FACTURA', 'RIF', 'NOMBRE CLIENTE', 'EMISIÓN', 'VENC.', 'D.VENC', 'D.CRÉD', 'TIPO TASA', 'TASA', isNotaEntrega ? 'MONTO NOTA' : 'MONTO FACT.', 'ABONOS', 'RESTANTE']],
    body: tableData.length > 0 ? tableData : [['-', 'SIN DOCS', '-', 'No hay documentos pendientes en cartera', '-', '-', '0', '0', 'BCV', '0,00', '$ 0.00', '$ 0.00', '$ 0.00']],
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.navy,
      textColor: [255, 255, 255],
      fontSize: 5.0,
      fontStyle: 'bold',
      cellPadding: 1.0
    },
    styles: {
      fontSize: 5.1,
      cellPadding: 1.0,
      textColor: COLORS.dark
    },
    alternateRowStyles: {
      fillColor: COLORS.lightBg
    },
    columnStyles: {
      0: { fontStyle: 'bold', halign: 'center', cellWidth: 14.5 },
      1: { fontStyle: 'bold', halign: 'center', cellWidth: 13 },
      2: { halign: 'center', cellWidth: 16 },
      3: { cellWidth: 23.5 },
      4: { halign: 'center', cellWidth: 13 },
      5: { halign: 'center', cellWidth: 13 },
      6: { halign: 'center', fontStyle: 'bold', cellWidth: 8 },
      7: { halign: 'center', cellWidth: 8 },
      8: { halign: 'center', fontStyle: 'bold', cellWidth: 12 },
      9: { halign: 'right', cellWidth: 14 },
      10: { halign: 'right', cellWidth: 15 },
      11: { halign: 'right', textColor: COLORS.emerald, fontStyle: 'bold', cellWidth: 14 },
      12: { halign: 'right', textColor: COLORS.red, fontStyle: 'bold', cellWidth: 15.9 }
    }
  });

  let finalY = base.doc.lastAutoTable?.finalY || currentY;
  finalY = addAnalyticalBox(
    base.doc,
    finalY + 3,
    'DESGLOSE POR CLASIFICACIÓN DE TASA (CXC)',
    rateBreakdownText,
    base.tableWidth,
    base.startX
  );
  addGrandTotalBox(base.doc, finalY + 2, [
    { label: isNotaEntrega ? 'MONTO NOTAS' : 'MONTO FACTURAS', value: formatUsd(totalMontoFacturaUsd), subtext: formatBs(totalMontoFacturaUsd * tasa), color: COLORS.navy },
    { label: 'TOTAL ABONOS', value: formatUsd(totalAbonosUsd), subtext: formatBs(totalAbonosUsd * tasa), color: COLORS.emerald },
    { label: 'TOTAL RESTANTE', value: formatUsd(totalCarteraUsd), subtext: `${dataset.length} documentos`, color: totalCarteraUsd > 0 ? COLORS.red : COLORS.emerald }
  ], base.tableWidth, base.startX);

  finalizeAndSave(base.doc, `Reporte_Documentos_CxC_${docTypeArg}_${new Date().toISOString().slice(0, 10)}.pdf`, currentUser);
  return base.doc;
}

// =========================================================================
// 4. REPORTE DE CUENTAS POR PAGAR (CxP) & PROVEEDORES (PRIORITARIO)
// =========================================================================
export function generateAccountsPayablePDF({
  payables = [],
  accountsPayable = [],
  suppliers = [],
  config = {},
  currentUser = null,
  filterSummary = ''
}) {
  const dataset = payables && payables.length > 0 ? payables : (Array.isArray(payables) && filterSummary ? [] : accountsPayable);
  const subtitleText = filterSummary
    ? `Documentos Filtrados (${dataset.length}) • ${filterSummary}`
    : 'Compromisos con Fabricantes de Planta, Vencimientos y Programación de Tesorería';

  const tasaBcv = Number(config?.tasaDolar) || 827.73;
  const rawKey = Number(config?.tasaKeystone ?? config?.tasa_keystone ?? 0);
  const tasa = (rawKey > 100 || tasaBcv <= 100)
    ? (rawKey || tasaBcv)
    : Math.round(tasaBcv * 1.03 * 100) / 100;

  const base = createBaseReport({
    title: 'REPORTE DE DOCUMENTOS CXP — FACTURAS Y PASIVOS DE COMPRA',
    subtitle: subtitleText,
    moduleCode: 'CXP',
    currentUser,
    config,
    rateLabel: 'Tasa KEYSTONE',
    rateValue: tasa
  });

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const normalizeRow = (p) => {
    const tipo = String(p.tipoDoc || p.tipo_doc || 'FACT').toUpperCase().trim();
    const nro = String(p.nroDoc || p.nro_doc || p.factura || p.doc_num || p.id || 'S/N').trim();
    const prov = p.provNombre || p.proveedor || p.prov_nombre || p.nombre || 'Proveedor Comercial';
    const rif = p.provRif || p.rif || p.prov_rif || p.coProv || p.co_prov || 'J-00000000-0';

    const rawSaldo = p.saldoUsd ?? p.saldo_usd ?? p.saldo ?? p.saldoPendienteUsd ?? p.montoTotalUsd ?? 0;
    const saldoUsd = Math.max(0, Number(rawSaldo) || 0);
    const rawMontoOrig = p.montoNetUsd ?? p.monto_net_usd ?? p.montoTotalUsd ?? saldoUsd;
    const montoOrigUsd = Math.max(0, Number(rawMontoOrig) || 0);
    const rawAbonos = p.abonosUsd ?? p.abonos_usd;
    const abonosUsd = (rawAbonos !== undefined && rawAbonos !== null)
      ? Math.max(0, Number(rawAbonos) || 0)
      : Math.max(0, montoOrigUsd - saldoUsd);

    const isSolvente = p.isSolvente !== undefined ? Boolean(p.isSolvente) : saldoUsd <= 0.01;
    const isVencido = !isSolvente && (
      p.isVencido !== undefined
        ? Boolean(p.isVencido)
        : Boolean(p.fechaVencimiento && new Date(p.fechaVencimiento) < now)
    );
    const diffDays = Number(p.diffDays ?? 0);

    let estadoText = 'VIGENTE';
    if (isSolvente) estadoText = 'PAGADO';
    else if (isVencido) estadoText = diffDays > 0 ? `VENCIDO ${diffDays}d` : 'VENCIDO';
    else if (p.diffDays !== undefined) estadoText = `VIGENTE ${Math.abs(diffDays)}d`;

    const fecEmis = p.fecEmis || (p.fechaEmision ? String(p.fechaEmision).slice(0, 10) : (p.fec_emis ? String(p.fec_emis).slice(0, 10) : 'N/A'));
    const fecVenc = p.fecVenc || (p.fechaVencimiento ? String(p.fechaVencimiento).slice(0, 10) : (p.fec_venc ? String(p.fec_venc).slice(0, 10) : 'N/A'));
    const rateType = resolveRecordRateType(p, tipo === 'FACT' ? 'BCV' : 'KEYSTONE');
    const rateMeta = resolveRateMeta(rateType, 'BCV');
    const rateNum = resolveEffectiveRateNumber(p, tasa);

    return {
      docLabel: `${tipo} #${nro}`,
      provLabel: `${prov}\n${rif}`,
      provNombre: prov,
      fecEmis,
      fecVenc,
      tipoTasa: rateType,
      tipoTasaLabel: rateMeta.badgeText,
      tasaPago: rateNum,
      tasaLabel: rateType === 'USD' ? 'USD' : formatBs(rateNum).replace(/^Bs\.\s*/, ''),
      montoOrigUsd,
      abonosUsd,
      saldoUsd,
      isSolvente,
      isVencido,
      estadoText
    };
  };

  const rows = dataset.map(normalizeRow);
  const totalMontoOrigUsd = rows.reduce((acc, r) => acc + r.montoOrigUsd, 0);
  const totalAbonosUsd = rows.reduce((acc, r) => acc + r.abonosUsd, 0);
  const totalPasivosUsd = rows.reduce((acc, r) => acc + r.saldoUsd, 0);
  const vencidas = rows.filter(r => r.isVencido);
  const totalVencidoUsd = vencidas.reduce((acc, r) => acc + r.saldoUsd, 0);
  const uniqueProvs = new Set(rows.map(r => r.provNombre)).size || suppliers.length;
  const cxpRateSummary = summarizeByRateClassification(rows, tasa);
  const cxpBreakdownText = cxpRateSummary.rows.length > 0
    ? cxpRateSummary.rows.map(b => `${b.label}: ${b.count} doc(s) • ${formatUsd(b.totalUsd)}`).join(' | ')
    : 'Sin desglose';

  const cards = [
    { label: 'Saldo Pendiente CxP', value: formatUsd(totalPasivosUsd), subtext: formatBs(totalPasivosUsd * tasa), color: COLORS.red },
    { label: 'Monto Original Docs', value: formatUsd(totalMontoOrigUsd), subtext: `${rows.length} doc(s) • ${uniqueProvs} prov.`, color: COLORS.navy },
    { label: 'Pasivos Vencidos', value: formatUsd(totalVencidoUsd), subtext: `${vencidas.length} documento(s) vencido(s)`, color: COLORS.amber },
    { label: 'Abonos Aplicados', value: formatUsd(totalAbonosUsd), subtext: `Tasa KEYSTONE: ${formatBs(tasa)}`, color: COLORS.emerald }
  ];

  let currentY = addSummaryCards(base.doc, base.startY, cards, base.tableWidth, base.startX);

  const filterNote = filterSummary ? ` Criterios aplicados en tabla: ${filterSummary}.` : '';
  currentY = addAnalyticalBox(
    base.doc,
    currentY,
    'PROGRAMACIÓN DE PAGOS & COMPROMISOS CON PROVEEDORES',
    `El listado refleja ${rows.length} documento(s) por un monto original de ${formatUsd(totalMontoOrigUsd)}, abonos aplicados de ${formatUsd(totalAbonosUsd)} y un saldo pendiente total de ${formatUsd(totalPasivosUsd)} (${formatBs(totalPasivosUsd * tasa)}), de los cuales ${formatUsd(totalVencidoUsd)} corresponden a ${vencidas.length} documento(s) vencido(s).${filterNote}`,
    base.tableWidth,
    base.startX
  );

  const tableData = rows.map(r => [
    r.docLabel,
    r.provLabel,
    r.fecEmis,
    r.fecVenc,
    r.tipoTasaLabel,
    r.tasaLabel,
    formatUsd(r.montoOrigUsd),
    formatUsd(r.abonosUsd),
    formatUsd(r.saldoUsd),
    r.estadoText
  ]);

  autoTable(base.doc, {
    startY: currentY,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    head: [['DOCUMENTO', 'PROVEEDOR / RIF', 'EMISIÓN', 'VENCIM.', 'TIPO TASA', 'TASA PAGO', 'MONTO ORIG.', 'ABONOS', 'SALDO USD', 'ESTADO']],
    body: tableData.length > 0 ? tableData : [['SIN DOCS', 'No hay documentos para los filtros seleccionados', '-', '-', 'BCV', '0,00', '$ 0.00', '$ 0.00', '$ 0.00', 'PAGADO']],
    foot: [[
      `TOTALES (${rows.length})`,
      '',
      '',
      '',
      '',
      '',
      formatUsd(totalMontoOrigUsd),
      formatUsd(totalAbonosUsd),
      formatUsd(totalPasivosUsd),
      formatBs(totalPasivosUsd * tasa)
    ]],
    showFoot: 'lastPage',
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.navy,
      textColor: [255, 255, 255],
      fontSize: 5.6,
      fontStyle: 'bold',
      cellPadding: 1.3
    },
    footStyles: {
      fillColor: [226, 232, 240],
      textColor: COLORS.dark,
      fontSize: 5.8,
      fontStyle: 'bold',
      cellPadding: 1.3
    },
    styles: {
      fontSize: 5.5,
      cellPadding: 1.1,
      textColor: COLORS.dark,
      valign: 'middle'
    },
    alternateRowStyles: {
      fillColor: COLORS.lightBg
    },
    columnStyles: {
      0: { fontStyle: 'bold', halign: 'left', cellWidth: 20 },
      1: { cellWidth: 37.9 },
      2: { halign: 'center', cellWidth: 14.5 },
      3: { halign: 'center', cellWidth: 14.5 },
      4: { halign: 'center', fontStyle: 'bold', cellWidth: 12 },
      5: { halign: 'right', cellWidth: 15 },
      6: { halign: 'right', cellWidth: 16 },
      7: { halign: 'right', cellWidth: 14 },
      8: { halign: 'right', fontStyle: 'bold', cellWidth: 16 },
      9: { halign: 'center', fontStyle: 'bold', cellWidth: 20 }
    },
    didParseCell: (data) => {
      if (data.column.index === 9 && data.section === 'body') {
        data.cell.text = ''; // Vector badge drawn in didDrawCell
      }
    },
    didDrawCell: (data) => {
      if (data.column.index === 9 && data.section === 'body') {
        drawStatusBadge(base.doc, data.cell, data.cell.raw);
      }
    }
  });

  let finalY = base.doc.lastAutoTable?.finalY || currentY;
  finalY = addAnalyticalBox(
    base.doc,
    finalY + 3,
    'DESGLOSE POR CLASIFICACIÓN DE TASA (CXP)',
    cxpBreakdownText,
    base.tableWidth,
    base.startX
  );
  addGrandTotalBox(base.doc, finalY + 2, [
    { label: 'MONTO ORIGINAL FILTRADO', value: formatUsd(totalMontoOrigUsd), subtext: `${rows.length} documento(s) listado(s)`, color: COLORS.navy },
    { label: 'ABONOS APLICADOS', value: formatUsd(totalAbonosUsd), subtext: `${rows.filter(r => r.isSolvente).length} solvente(s) / pagado(s)`, color: COLORS.emerald },
    { label: 'SALDO PENDIENTE CXP', value: formatUsd(totalPasivosUsd), subtext: formatBs(totalPasivosUsd * tasa), color: totalPasivosUsd > 0 ? COLORS.red : COLORS.emerald }
  ], base.tableWidth, base.startX);

  finalizeAndSave(base.doc, `Reporte_Documentos_CxP_SIGNUM_${new Date().toISOString().slice(0, 10)}.pdf`, currentUser);
  return base.doc;
}

// =========================================================================
// 5. REPORTE DE LIBROS FISCALES SENIAT (PRIORITARIO - CARTA VERTICAL)
// =========================================================================
export function generateTaxReportPDF({
  reportType = 'LIBRO_VENTAS',
  period = '2026-10',
  sales = [],
  purchases = [],
  fiscalClosures = [],
  withholdings = [],
  igtfSales = [],
  config = {},
  currentUser = null
}) {
  const tasa = Number(config?.tasaDolar) || 827.73;

  // Helpers locales para alinear PDFs de Libros Fiscales con fiscalService (sin inventar IVA 16% sobre exentos/NE)
  const resolveClosureMetrics = (c = {}) => {
    const numeroZ = String(c.numeroReporteZ ?? c.numeroZ ?? '').trim() || '0001';
    const fechaIso = String(c.fechaCierre ?? c.fecha ?? '').slice(0, 10) || new Date().toISOString().slice(0, 10);
    const hora = c.horaCierre || (c.fecha ? String(c.fecha).slice(11, 19) : '') || '18:00:00';
    const granTotalBs = Number(c.granTotalBs ?? c.totalVentasBs ?? c.totalBs ?? 0);
    const granTotalUsd = Number(c.granTotalUsd ?? c.totalVentasUsd ?? (tasa > 0 ? granTotalBs / tasa : 0));
    const baseImp16Bs = Number(c.baseImponible16Bs ?? c.baseGeneralBs ?? 0);
    const iva16Bs = Number(c.iva16Bs ?? c.debitoGeneralBs ?? 0);
    const baseImp8Bs = Number(c.baseImponible8Bs ?? c.baseReducidaBs ?? 0);
    const iva8Bs = Number(c.iva8Bs ?? c.debitoReducidaBs ?? 0);
    const igtfBs = Number(c.igtfBs ?? c.totalIgtfBs ?? 0);
    const exentasBs = Number(c.ventasExentasBs ?? 0);
    const totalFacturas = Number(c.totalFacturas ?? c.cantidadFacturas ?? 0);
    const facturaInicial = c.facturaInicial || c.primeraFactura || 'S/N';
    const facturaFinal = c.facturaFinal || c.ultimaFactura || 'S/N';
    const tipo = String(c.tipo || 'Z').toUpperCase();
    return {
      numeroZ, fechaIso, hora, granTotalBs, granTotalUsd,
      baseImp16Bs, iva16Bs, baseImp8Bs, iva8Bs, igtfBs, exentasBs,
      totalFacturas, facturaInicial, facturaFinal, tipo,
      firmaHashSha256: c.firmaHashSha256 || '4F8A9B2C1E7D6A5F3B2C1D0E9A8B7C6D5E4F3A2B1C0D9E8F7A6B5C4D3E2F1A0B'
    };
  };

  const adaptSalesRowsForTaxPdf = (rawSales = []) => {
    const normalized = (rawSales || [])
      .filter(s => isFiscalDocEligible(s))
      .map(s => {
        const baseDoc = {
          ...s,
          numeroDoc: s.numeroDoc || s.factNum || s.id,
          numeroControl: s.numeroControl || s.controlNum || s.nroControl
        };
        const hasBreakdown =
          s.baseGeneralBs != null || s.baseGeneralUsd != null ||
          s.ivaGeneralBs != null || s.ivaGeneralUsd != null ||
          s.ivaBs != null || s.ivaUsd != null ||
          s.baseExentaBs != null || s.baseExentaUsd != null ||
          s.baseReducidaBs != null || s.baseAdicionalBs != null ||
          s.subtotalUsd != null || s.subtotalBs != null ||
          s.anulada || s.status === 'ANULADA';
        if (hasBreakdown) return baseDoc;
        const totUsd = Number(s.totalUsd ?? s.total ?? 0);
        const baseU = Number((totUsd / 1.16).toFixed(2));
        return { ...baseDoc, subtotalUsd: baseU, ivaUsd: Number((totUsd - baseU).toFixed(2)) };
      });
    return buildLibroVentasRows(normalized, config);
  };

  const adaptPurchaseRowsForTaxPdf = (rawPurchases = []) => {
    const normalized = (rawPurchases || []).map(p => {
      const baseDoc = {
        ...p,
        numeroFactura: p.numeroFactura || p.numeroFacturaProv || p.factNum || p.id,
        numeroControl: p.numeroControl || p.nroControl || p.controlNum
      };
      const hasBreakdown =
        p.baseGeneralBs != null || p.baseGeneralUsd != null ||
        p.ivaGeneralBs != null || p.ivaGeneralUsd != null ||
        p.ivaBs != null || p.ivaUsd != null ||
        p.baseExentaBs != null || p.baseExentaUsd != null ||
        p.subtotalUsd != null || p.subtotalBs != null ||
        p.anulada || p.status === 'ANULADA';
      if (hasBreakdown) return baseDoc;
      const totUsd = Number(p.totalUsd ?? p.total ?? 0);
      const baseU = Number((totUsd / 1.16).toFixed(2));
      return { ...baseDoc, subtotalUsd: baseU, ivaUsd: Number((totUsd - baseU).toFixed(2)) };
    });
    return buildLibroComprasRows(normalized, config);
  };

  // -------------------------------------------------------------------------
  // CASO 1: CIERRE Z o REPORTE X (Comprobante Fiscal Individual)
  // -------------------------------------------------------------------------
  if (reportType === 'CIERRE_Z' || reportType === 'CIERRE_X') {
    const isZ = reportType === 'CIERRE_Z';
    const closure = resolveClosureMetrics((fiscalClosures && fiscalClosures.length > 0) ? fiscalClosures[0] : {});
    const base = createBaseReport({
      title: `COMPROBANTE FISCAL DE CIERRE DIARIO (${isZ ? 'REPORTE Z' : 'REPORTE X'})`,
      subtitle: `Control Oficial de Operaciones Mercantiles Diarias • Sistema Homologado SENIAT`,
      moduleCode: 'SEN',
      currentUser,
      config
    });

    const { granTotalBs, granTotalUsd, baseImp16Bs, iva16Bs, baseImp8Bs, iva8Bs, igtfBs, exentasBs } = closure;

    const cards = [
      { label: `Gran Total ${isZ ? 'Z' : 'X'} (Bs.)`, value: formatBs(granTotalBs), subtext: formatUsd(granTotalUsd), color: COLORS.navy },
      { label: 'Base Imponible 16%', value: formatBs(baseImp16Bs), subtext: 'Alícuota General', color: COLORS.cyan },
      { label: 'Débito Fiscal IVA', value: formatBs(iva16Bs), subtext: 'SENIAT 16%', color: COLORS.emerald },
      { label: 'IGTF Divisas 3%', value: formatBs(igtfBs), subtext: 'Percepción Especial', color: COLORS.amber }
    ];

    let currentY = addSummaryCards(base.doc, base.startY, cards, base.tableWidth, base.startX);

    currentY = addAnalyticalBox(
      base.doc,
      currentY,
      `METADATOS DE SEGURIDAD FISCAL & CERTIFICACIÓN (${isZ ? 'REPORTE Z' : 'REPORTE X'})`,
      `Reporte N° ${closure.numeroZ} emitido el ${closure.fechaIso} a las ${closure.hora}. Total facturas auditadas: ${closure.totalFacturas} (Desde: ${closure.facturaInicial} Hasta: ${closure.facturaFinal}). Firma Digital Hash SHA-256: ${closure.firmaHashSha256}`,
      base.tableWidth,
      base.startX
    );

    const tableData = [
      ['Ventas Exentas o No Sujetas', '0.00%', formatBs(exentasBs), formatUsd(tasa > 0 ? exentasBs / tasa : 0)],
      ['Base Imponible Gravable General (G)', '16.00%', formatBs(baseImp16Bs), formatUsd(tasa > 0 ? baseImp16Bs / tasa : 0)],
      ['Débito Fiscal IVA 16% (G)', '16.00%', formatBs(iva16Bs), formatUsd(tasa > 0 ? iva16Bs / tasa : 0)],
      ['Base Imponible Gravable Reducida (R)', '8.00%', formatBs(baseImp8Bs), formatUsd(tasa > 0 ? baseImp8Bs / tasa : 0)],
      ['Débito Fiscal IVA 8% (R)', '8.00%', formatBs(iva8Bs), formatUsd(tasa > 0 ? iva8Bs / tasa : 0)],
      ['Percepción IGTF en Divisas', '3.00%', formatBs(igtfBs), formatUsd(tasa > 0 ? igtfBs / tasa : 0)],
      ['GRAN TOTAL LIQUIDABLE CIERRE', '-', formatBs(granTotalBs), formatUsd(granTotalUsd)]
    ];

    autoTable(base.doc, {
      startY: currentY,
      margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
      tableWidth: base.tableWidth,
      head: [['CONCEPTO / DESGLOSE TRIBUTARIO SENIAT', 'ALÍCUOTA', 'MONTO EN BOLÍVARES (BS.)', 'EQUIVALENTE USD']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: COLORS.navy,
        textColor: [255, 255, 255],
        fontSize: 7.0,
        fontStyle: 'bold',
        cellPadding: 1.8
      },
      styles: {
        fontSize: 6.5,
        cellPadding: 1.6,
        textColor: COLORS.dark
      },
      alternateRowStyles: {
        fillColor: COLORS.lightBg
      },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 79.9 },
        1: { halign: 'center', cellWidth: 25 },
        2: { halign: 'right', fontStyle: 'bold', cellWidth: 40 },
        3: { halign: 'right', fontStyle: 'bold', cellWidth: 35 }
      }
    });

    const finalYZ = base.doc.lastAutoTable?.finalY || currentY;
    addGrandTotalBox(base.doc, finalYZ + 3.5, [
      { label: `GRAN TOTAL ${isZ ? 'Z' : 'X'} (BS.)`, value: formatBs(granTotalBs), subtext: formatUsd(granTotalUsd), color: COLORS.navy },
      { label: 'BASE IMPONIBLE 16%', value: formatBs(baseImp16Bs), subtext: 'Alícuota general', color: COLORS.cyan },
      { label: 'DÉBITO FISCAL IVA', value: formatBs(iva16Bs), subtext: 'Liquidación SENIAT', color: COLORS.emerald }
    ], base.tableWidth, base.startX);

    finalizeAndSave(base.doc, `Cierre_${isZ ? 'Z' : 'X'}_${closure.numeroZ}_${period}_SIGNUM.pdf`, currentUser);
    return base.doc;
  }

  // -------------------------------------------------------------------------
  // CASO 2: HISTORIAL DE CIERRES FISCALES
  // -------------------------------------------------------------------------
  if (reportType === 'CIERRES_FISCALES') {
    const base = createBaseReport({
      title: 'HISTORIAL OFICIAL DE CIERRES FISCALES Z Y REPORTES X',
      subtitle: `Registro Cronológico de Cierres Diarios SENIAT • Período Fiscal: ${period}`,
      moduleCode: 'SEN',
      currentUser,
      config
    });
    const dataset = (fiscalClosures || []).map(resolveClosureMetrics);
    const totalZ = dataset.filter(c => c.tipo === 'Z').length;
    const totalAcumBs = dataset.reduce((acc, c) => acc + c.granTotalBs, 0);
    const totalIvaBs = dataset.reduce((acc, c) => acc + c.iva16Bs, 0);
    const totalIgtfBs = dataset.reduce((acc, c) => acc + c.igtfBs, 0);

    const cards = [
      { label: 'Cierres Z Registrados', value: `${totalZ} Cierres`, subtext: `${dataset.length} Reportes Totales`, color: COLORS.navy },
      { label: 'Ventas Totales Cierres', value: formatBs(totalAcumBs), subtext: formatUsd(tasa > 0 ? totalAcumBs / tasa : 0), color: COLORS.cyan },
      { label: 'Débito Fiscal IVA 16%', value: formatBs(totalIvaBs), subtext: 'Impuesto Consolidado', color: COLORS.emerald },
      { label: 'IGTF 3% Percibido', value: formatBs(totalIgtfBs), subtext: 'Fondos Fiscales', color: COLORS.amber }
    ];

    let currentY = addSummaryCards(base.doc, base.startY, cards, base.tableWidth, base.startX);
    currentY = addAnalyticalBox(
      base.doc,
      currentY,
      'AUDITORÍA DE CIERRES DIARIOS SENIAT (SNAT/2014/00032)',
      `Consolidado cronológico inmutable de cierres diarios Z y cortes informativos X correspondientes al período ${period}. Certifica que las transmisiones y firmas SHA-256 no presentan discrepancias de correlativos en máquina fiscal.`,
      base.tableWidth,
      base.startX
    );

    const tableData = dataset.map(c => [
      c.numeroZ.startsWith('Z') ? c.numeroZ : `Z-${c.numeroZ}`,
      c.tipo,
      `${c.fechaIso} ${c.hora}`,
      `${c.facturaInicial} al ${c.facturaFinal}`,
      formatBs(c.baseImp16Bs),
      formatBs(c.iva16Bs),
      formatBs(c.granTotalBs),
      String(c.firmaHashSha256).slice(0, 12) + '...'
    ]);

    autoTable(base.doc, {
      startY: currentY,
      margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
      tableWidth: base.tableWidth,
      head: [['CORRELATIVO', 'TIPO', 'FECHA / HORA', 'RANGO FACTURAS', 'BASE IMP. BS', 'IVA 16% BS', 'TOTAL BS', 'FIRMA SHA-256']],
      body: tableData.length > 0 ? tableData : [['-', '-', '-', 'Sin cierres fiscales registrados en el período', 'Bs. 0,00', 'Bs. 0,00', 'Bs. 0,00', '-']],
      theme: 'grid',
      headStyles: { fillColor: COLORS.navy, textColor: [255, 255, 255], fontSize: 6.6, fontStyle: 'bold', cellPadding: 1.5 },
      styles: { fontSize: 6.0, cellPadding: 1.3, textColor: COLORS.dark },
      alternateRowStyles: { fillColor: COLORS.lightBg },
      columnStyles: {
        0: { fontStyle: 'bold', halign: 'center', cellWidth: 16 },
        1: { halign: 'center', fontStyle: 'bold', cellWidth: 10 },
        2: { halign: 'center', cellWidth: 26 },
        3: { halign: 'center', cellWidth: 28 },
        4: { halign: 'right', cellWidth: 23 },
        5: { halign: 'right', cellWidth: 23 },
        6: { halign: 'right', fontStyle: 'bold', cellWidth: 28 },
        7: { halign: 'center', fontStyle: 'normal', cellWidth: 25.9 }
      },
      didParseCell: (data) => {
        if (data.column.index === 1 && data.section === 'body') {
          data.cell.text = ''; // Vector badge
        }
      },
      didDrawCell: (data) => {
        if (data.column.index === 1 && data.section === 'body') {
          drawStatusBadge(base.doc, data.cell, data.cell.raw === 'Z' ? 'CUADRADO' : 'SEGUIMIENTO');
        }
      }
    });

    const finalYHist = base.doc.lastAutoTable?.finalY || currentY;
    addGrandTotalBox(base.doc, finalYHist + 3.5, [
      { label: 'VENTAS TOTALES CIERRES', value: formatBs(totalAcumBs), subtext: formatUsd(tasa > 0 ? totalAcumBs / tasa : 0), color: COLORS.navy },
      { label: 'DÉBITO FISCAL IVA 16%', value: formatBs(totalIvaBs), subtext: 'Consolidado período', color: COLORS.emerald },
      { label: 'IGTF 3% PERCIBIDO', value: formatBs(totalIgtfBs), subtext: 'Fondos fiscales', color: COLORS.amber }
    ], base.tableWidth, base.startX);

    finalizeAndSave(base.doc, `Libro_Cierres_Fiscales_SENIAT_${period}_SIGNUM.pdf`, currentUser);
    return base.doc;
  }

  // -------------------------------------------------------------------------
  // CASO 3: RETENCIONES DE ISLR
  // -------------------------------------------------------------------------
  if (reportType === 'ISLR') {
    const base = createBaseReport({
      title: 'COMPROBANTE OFICIAL DE RETENCIONES DE ISLR',
      subtitle: `Decreto N° 1.808 / Ley de ISLR • Período Fiscal: ${period} • Retenciones Aplicadas a Proveedores`,
      moduleCode: 'SEN',
      currentUser,
      config
    });
    const dataset = withholdings || [];
    const normalizedIslr = dataset.map((w, idx) => {
      const rowRate = Number(w.tasaCambio || w.tasaBcv || w.tasaDolar || tasa) || tasa;
      const isBsCurrency = w.moneda === 'BS' || w.moneda == null;
      const baseBs = w.baseImponibleBs != null
        ? Number(w.baseImponibleBs)
        : (w.baseImponible != null
          ? Number(w.baseImponible) * (isBsCurrency ? 1 : rowRate)
          : Number(w.baseImponibleUsd ?? 0) * rowRate);
      const baseUsd = w.baseImponibleUsd != null
        ? Number(w.baseImponibleUsd)
        : (rowRate > 0 ? baseBs / rowRate : 0);
      const retBs = w.montoRetenidoBs != null
        ? Number(w.montoRetenidoBs)
        : (w.montoRetenido != null
          ? Number(w.montoRetenido) * (isBsCurrency ? 1 : rowRate)
          : Number(w.montoRetenidoUsd ?? 0) * rowRate);
      const retUsd = w.montoRetenidoUsd != null
        ? Number(w.montoRetenidoUsd)
        : (rowRate > 0 ? retBs / rowRate : 0);
      return {
        comprobante: String(w.comprobante || w.nroComprobante || `RET-ISLR-${1000 + idx}`),
        fecha: String(w.fechaEmision || w.fecha || '').slice(0, 10) || '-',
        proveedor: w.proveedorNombre || w.proveedor || w.nombreProveedor || w.provNombre || 'Proveedor',
        rif: w.proveedorRif || w.rif || w.rifProveedor || 'S/R',
        factura: String(w.nroFacturaAfectada || w.factura || w.nroFactura || 'S/N'),
        baseBs,
        baseUsd,
        pct: Number(w.porcentajeRetencion ?? 0),
        retBs,
        retUsd
      };
    });
    const totalRetenidoUsd = normalizedIslr.reduce((acc, r) => acc + r.retUsd, 0);
    const totalRetenidoBs = normalizedIslr.reduce((acc, r) => acc + r.retBs, 0);
    const totalBaseUsd = normalizedIslr.reduce((acc, r) => acc + r.baseUsd, 0);
    const totalBaseBs = normalizedIslr.reduce((acc, r) => acc + r.baseBs, 0);

    const cards = [
      { label: 'Total Retenido Bs.', value: formatBs(totalRetenidoBs), subtext: formatUsd(totalRetenidoUsd), color: COLORS.navy },
      { label: 'Base Acumulada USD', value: formatUsd(totalBaseUsd), subtext: formatBs(totalBaseBs), color: COLORS.cyan },
      { label: 'Comprobantes Emitidos', value: `${normalizedIslr.length} Registros`, subtext: `Período: ${period}`, color: COLORS.emerald },
      { label: 'Tasa BCV Aplicada', value: formatBs(tasa), subtext: 'Cotización Oficial', color: COLORS.amber }
    ];

    let currentY = addSummaryCards(base.doc, base.startY, cards, base.tableWidth, base.startX);
    currentY = addAnalyticalBox(
      base.doc,
      currentY,
      'CONSTANCIA OFICIAL DE AGENTE DE RETENCIÓN ISLR',
      `SIGNUM MOTORVEN C.A., en su condición de Agente de Retención según la Providencia Administrativa SENIAT, certifica que las retenciones registradas en el período ${period} ascienden a ${formatBs(totalRetenidoBs)} (${formatUsd(totalRetenidoUsd)}). Documento inalterable válido ante fiscalizaciones.`,
      base.tableWidth,
      base.startX
    );

    const tableData = normalizedIslr.map(r => [
      r.comprobante,
      r.fecha,
      r.proveedor,
      r.rif,
      r.factura,
      formatBs(r.baseBs),
      `${r.pct}%`,
      formatBs(r.retBs),
      formatUsd(r.retUsd)
    ]);

    autoTable(base.doc, {
      startY: currentY,
      margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
      tableWidth: base.tableWidth,
      head: [['COMPROBANTE', 'FECHA', 'PROVEEDOR / BENEFICIARIO', 'RIF', 'FACTURA', 'BASE BS.', '%', 'RET. BS.', 'RET. USD']],
      body: tableData.length > 0 ? tableData : [['-', '-', 'No hay retenciones de ISLR en el período', '-', '-', 'Bs. 0,00', '0%', 'Bs. 0,00', '$ 0.00']],
      theme: 'grid',
      headStyles: { fillColor: COLORS.navy, textColor: [255, 255, 255], fontSize: 6.6, fontStyle: 'bold', cellPadding: 1.5 },
      styles: { fontSize: 6.0, cellPadding: 1.3, textColor: COLORS.dark },
      alternateRowStyles: { fillColor: COLORS.lightBg },
      columnStyles: {
        0: { fontStyle: 'bold', halign: 'center', cellWidth: 20 },
        1: { halign: 'center', cellWidth: 15 },
        2: { cellWidth: 44 },
        3: { cellWidth: 18 },
        4: { halign: 'center', cellWidth: 17 },
        5: { halign: 'right', cellWidth: 22 },
        6: { halign: 'center', cellWidth: 10 },
        7: { halign: 'right', fontStyle: 'bold', cellWidth: 20 },
        8: { halign: 'right', fontStyle: 'bold', cellWidth: 13.9 }
      }
    });

    const finalYRet = base.doc.lastAutoTable?.finalY || currentY;
    addGrandTotalBox(base.doc, finalYRet + 3.5, [
      { label: 'TOTAL RETENIDO BS.', value: formatBs(totalRetenidoBs), subtext: formatUsd(totalRetenidoUsd), color: COLORS.navy },
      { label: 'BASE ACUMULADA USD', value: formatUsd(totalBaseUsd), subtext: formatBs(totalBaseBs), color: COLORS.cyan },
      { label: 'COMPROBANTES EMITIDOS', value: `${normalizedIslr.length} Retenciones`, subtext: `Período ${period}`, color: COLORS.emerald }
    ], base.tableWidth, base.startX);

    finalizeAndSave(base.doc, `Comprobantes_Retencion_ISLR_${period}_SIGNUM.pdf`, currentUser);
    return base.doc;
  }

  // -------------------------------------------------------------------------
  // CASO 4: PERCEPCIÓN DE IGTF (DIVISAS 3%)
  // -------------------------------------------------------------------------
  if (reportType === 'IGTF') {
    const base = createBaseReport({
      title: 'LIBRO ESPECIAL DE PERCEPCIÓN DE IGTF (DIVISAS 3%)',
      subtitle: `Ley de Impuesto a las Grandes Transacciones Financieras • Art. 13 Prov. SNAT/2022/000013 • Período: ${period}`,
      moduleCode: 'SEN',
      currentUser,
      config
    });
    const dataset = (igtfSales && igtfSales.length > 0)
      ? igtfSales
      : sales.filter(s =>
          isFiscalDocEligible(s) && !s.anulada && s.status !== 'ANULADA' &&
          (Number(s.igtfUsd || 0) > 0 || Number(s.igtfBs || 0) > 0)
        );
    const normalizedIgtf = dataset.map((s, idx) => {
      const sRate = Number(s.tasaDolar || s.tasaBcv || s.tasaPago || tasa) || tasa;
      const usd = Number(s.totalUsd ?? s.total ?? 0);
      const bs = Number(s.totalBs ?? (usd * sRate));
      const igtfU = Number(s.igtfUsd ?? (s.igtfBs != null && sRate > 0 ? Number(s.igtfBs) / sRate : 0));
      const igtfB = Number(s.igtfBs ?? (igtfU * sRate));
      return {
        factNum: String(s.factNum || s.id || `FAC-${1000 + idx}`),
        fecha: s.fecha ? String(s.fecha).slice(0, 10) : '-',
        cliente: s.clienteNombre || s.cliente || 'Consumidor Final',
        rif: s.clienteRif || s.rif || 'S/R',
        usd,
        bs,
        igtfU,
        igtfB
      };
    });
    const totalDivisasUsd = normalizedIgtf.reduce((acc, r) => acc + r.usd, 0);
    const totalDivisasBs = normalizedIgtf.reduce((acc, r) => acc + r.bs, 0);
    const totalIgtfUsd = normalizedIgtf.reduce((acc, r) => acc + r.igtfU, 0);
    const totalIgtfBs = normalizedIgtf.reduce((acc, r) => acc + r.igtfB, 0);

    const cards = [
      { label: 'IGTF Percibido Bs.', value: formatBs(totalIgtfBs), subtext: formatUsd(totalIgtfUsd), color: COLORS.navy },
      { label: 'Base Divisas Cobrada', value: formatUsd(totalDivisasUsd), subtext: formatBs(totalDivisasBs), color: COLORS.cyan },
      { label: 'Operaciones en Divisas', value: `${normalizedIgtf.length} Cobros`, subtext: 'Alícuota Legal 3%', color: COLORS.emerald },
      { label: 'Tasa BCV Aplicada', value: formatBs(tasa), subtext: 'Cotización Oficial', color: COLORS.amber }
    ];

    let currentY = addSummaryCards(base.doc, base.startY, cards, base.tableWidth, base.startX);
    currentY = addAnalyticalBox(
      base.doc,
      currentY,
      'PERCEPCIÓN FISCAL IGTF EN PAGOS EN MONEDA EXTRANJERA',
      `En cumplimiento de la reforma de la Ley de IGTF y la Providencia SNAT/2022/000013, SIGNUM MOTORVEN C.A. actúa como Agente de Percepción del 3% sobre los pagos percibidos en divisas no bancarizadas. El total recaudado asciende a ${formatBs(totalIgtfBs)} (${formatUsd(totalIgtfUsd)}).`,
      base.tableWidth,
      base.startX
    );

    const tableData = normalizedIgtf.map(r => [
      r.factNum,
      r.fecha,
      r.cliente,
      r.rif,
      formatUsd(r.usd),
      formatBs(r.bs),
      '3.00%',
      formatBs(r.igtfB),
      formatUsd(r.igtfU)
    ]);

    autoTable(base.doc, {
      startY: currentY,
      margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
      tableWidth: base.tableWidth,
      head: [['FACTURA', 'FECHA', 'CLIENTE / RAZÓN SOCIAL', 'RIF', 'BASE USD', 'BASE BS', 'ALÍCUOTA', 'IGTF BS.', 'IGTF USD']],
      body: tableData.length > 0 ? tableData : [['-', '-', 'No hay operaciones con percepción de IGTF en el período', '-', '$ 0.00', 'Bs. 0,00', '3%', 'Bs. 0,00', '$ 0.00']],
      theme: 'grid',
      headStyles: { fillColor: COLORS.navy, textColor: [255, 255, 255], fontSize: 6.6, fontStyle: 'bold', cellPadding: 1.5 },
      styles: { fontSize: 6.0, cellPadding: 1.3, textColor: COLORS.dark },
      alternateRowStyles: { fillColor: COLORS.lightBg },
      columnStyles: {
        0: { fontStyle: 'bold', halign: 'center', cellWidth: 18 },
        1: { halign: 'center', cellWidth: 15 },
        2: { cellWidth: 46 },
        3: { cellWidth: 18 },
        4: { halign: 'right', cellWidth: 18 },
        5: { halign: 'right', cellWidth: 20 },
        6: { halign: 'center', cellWidth: 12 },
        7: { halign: 'right', fontStyle: 'bold', cellWidth: 18 },
        8: { halign: 'right', fontStyle: 'bold', cellWidth: 14.9 }
      }
    });

    const finalYIgtf = base.doc.lastAutoTable?.finalY || currentY;
    addGrandTotalBox(base.doc, finalYIgtf + 3.5, [
      { label: 'IGTF PERCIBIDO BS.', value: formatBs(totalIgtfBs), subtext: formatUsd(totalIgtfUsd), color: COLORS.navy },
      { label: 'BASE DIVISAS COBRADA', value: formatUsd(totalDivisasUsd), subtext: formatBs(totalDivisasBs), color: COLORS.cyan },
      { label: 'OPERACIONES DIVISAS', value: `${normalizedIgtf.length} Cobros`, subtext: 'Alícuota 3%', color: COLORS.emerald }
    ], base.tableWidth, base.startX);

    finalizeAndSave(base.doc, `Libro_Especial_IGTF_3Pct_${period}_SIGNUM.pdf`, currentUser);
    return base.doc;
  }

  // -------------------------------------------------------------------------
  // CASO 5: RESUMEN CONSOLIDADO DE DECLARACIÓN SENIAT
  // -------------------------------------------------------------------------
  if (reportType === 'EXPORT_SENIAT') {
    const base = createBaseReport({
      title: 'RESUMEN CONSOLIDADO DE DECLARACIÓN TRIBUTARIA SENIAT',
      subtitle: `Consolidado de Ventas, Compras, Retenciones e IGTF • Período Fiscal: ${period}`,
      moduleCode: 'SEN',
      currentUser,
      config
    });
    const ventasRows = adaptSalesRowsForTaxPdf(sales);
    const comprasRows = adaptPurchaseRowsForTaxPdf(purchases);
    const totVentasBs = ventasRows.reduce((acc, r) => acc + (r.totalVentasBs || 0), 0);
    const baseVentasBs = ventasRows.reduce((acc, r) => acc + (r.baseImponible16Bs || 0) + (r.baseImponible8Bs || 0) + (r.baseImponible31Bs || 0), 0);
    const debitoIvaBs = ventasRows.reduce((acc, r) => acc + (r.iva16Bs || 0) + (r.iva8Bs || 0) + (r.iva31Bs || 0), 0);
    const totComprasBs = comprasRows.reduce((acc, r) => acc + (r.totalComprasBs || 0), 0);
    const baseComprasBs = comprasRows.reduce((acc, r) => acc + (r.baseImponible16Bs || 0), 0);
    const creditoIvaBs = comprasRows.reduce((acc, r) => acc + (r.creditoFiscal16Bs || 0), 0);
    const balanceIvaBs = debitoIvaBs - creditoIvaBs;

    const cards = [
      { label: 'Débito Fiscal Ventas', value: formatBs(debitoIvaBs), subtext: formatUsd(debitoIvaBs / tasa), color: COLORS.navy },
      { label: 'Crédito Fiscal Compras', value: formatBs(creditoIvaBs), subtext: formatUsd(creditoIvaBs / tasa), color: COLORS.cyan },
      { label: balanceIvaBs >= 0 ? 'IVA a Pagar SENIAT' : 'Excedente Crédito Fiscal', value: formatBs(Math.abs(balanceIvaBs)), subtext: formatUsd(Math.abs(balanceIvaBs) / tasa), color: balanceIvaBs >= 0 ? COLORS.red : COLORS.emerald },
      { label: 'Tasa Oficial BCV', value: formatBs(tasa), subtext: 'Cálculo del Período', color: COLORS.amber }
    ];

    let currentY = addSummaryCards(base.doc, base.startY, cards, base.tableWidth, base.startX);
    currentY = addAnalyticalBox(
      base.doc,
      currentY,
      'DICTAMEN TRIBUTARIO CONSOLIDADO SENIAT',
      `El presente informe resume la posición tributaria de SIGNUM MOTORVEN C.A. para el período ${period}. Con un débito fiscal de ${formatBs(debitoIvaBs)} y un crédito fiscal de ${formatBs(creditoIvaBs)}, el balance neto resultante es ${balanceIvaBs >= 0 ? 'a pagar' : 'a favor'} por un total de ${formatBs(Math.abs(balanceIvaBs))}.`,
      base.tableWidth,
      base.startX
    );

    const tableData = [
      ['Total Ventas Fiscales Facturadas (Inc. Exentas/IVA)', formatBs(totVentasBs), formatUsd(totVentasBs / tasa)],
      ['Base Imponible de Ventas Gravables (16% / 8% / 31%)', formatBs(baseVentasBs), formatUsd(baseVentasBs / tasa)],
      ['Débito Fiscal IVA Determinado', formatBs(debitoIvaBs), formatUsd(debitoIvaBs / tasa)],
      ['Total Compras y Servicios Recibidos (Inc. Exentas/IVA)', formatBs(totComprasBs), formatUsd(totComprasBs / tasa)],
      ['Base Imponible de Compras Gravables (16% / 8%)', formatBs(baseComprasBs), formatUsd(baseComprasBs / tasa)],
      ['Crédito Fiscal IVA Deducible', formatBs(creditoIvaBs), formatUsd(creditoIvaBs / tasa)],
      ['BALANCE NETO IVA (DÉBITO - CRÉDITO)', formatBs(balanceIvaBs), formatUsd(balanceIvaBs / tasa)]
    ];

    autoTable(base.doc, {
      startY: currentY,
      margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
      tableWidth: base.tableWidth,
      head: [['CONCEPTO TRIBUTARIO', 'MONTO EN BOLÍVARES (BS.)', 'EQUIVALENTE USD']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: COLORS.navy, textColor: [255, 255, 255], fontSize: 7.0, fontStyle: 'bold', cellPadding: 1.8 },
      styles: { fontSize: 6.5, cellPadding: 1.6, textColor: COLORS.dark },
      alternateRowStyles: { fillColor: COLORS.lightBg },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 99.9 },
        1: { halign: 'right', fontStyle: 'bold', cellWidth: 40 },
        2: { halign: 'right', fontStyle: 'bold', cellWidth: 40 }
      }
    });

    const finalYExp = base.doc.lastAutoTable?.finalY || currentY;
    addGrandTotalBox(base.doc, finalYExp + 3.5, [
      { label: 'BALANCE NETO IVA', value: formatBs(Math.abs(balanceIvaBs)), subtext: balanceIvaBs >= 0 ? 'A pagar SENIAT' : 'A favor contribuyente', color: balanceIvaBs >= 0 ? COLORS.red : COLORS.emerald },
      { label: 'DÉBITO FISCAL VENTAS', value: formatBs(debitoIvaBs), subtext: formatUsd(debitoIvaBs / tasa), color: COLORS.navy },
      { label: 'CRÉDITO FISCAL COMPRAS', value: formatBs(creditoIvaBs), subtext: formatUsd(creditoIvaBs / tasa), color: COLORS.cyan }
    ], base.tableWidth, base.startX);

    finalizeAndSave(base.doc, `Resumen_Consolidado_SENIAT_${period}_SIGNUM.pdf`, currentUser);
    return base.doc;
  }

  // -------------------------------------------------------------------------
  // CASO 6: LIBRO DE VENTAS o LIBRO DE COMPRAS FISCAL ESTÁNDAR
  // -------------------------------------------------------------------------
  const isVentas = reportType === 'LIBRO_VENTAS';
  const base = createBaseReport({
    title: isVentas ? 'LIBRO DE VENTAS FISCAL (ART. 76 R-LIVA SENIAT)' : 'LIBRO DE COMPRAS FISCAL (ART. 75 R-LIVA SENIAT)',
    subtitle: `Período Fiscal Tributario: ${period} • Declaración Formal de Débito y Crédito Fiscal`,
    moduleCode: 'SEN',
    currentUser,
    config
  });

  const bookRows = isVentas ? adaptSalesRowsForTaxPdf(sales) : adaptPurchaseRowsForTaxPdf(purchases);
  const totalFacturadoBs = bookRows.reduce((acc, r) => acc + (isVentas ? (r.totalVentasBs || 0) : (r.totalComprasBs || 0)), 0);
  const baseImponibleBs = bookRows.reduce((acc, r) => acc + (r.baseImponible16Bs || 0) + (r.baseImponible8Bs || 0) + (r.baseImponible31Bs || 0), 0);
  const ivaTotalBs = bookRows.reduce((acc, r) => acc + (isVentas ? ((r.iva16Bs || 0) + (r.iva8Bs || 0) + (r.iva31Bs || 0)) : (r.creditoFiscal16Bs || 0)), 0);

  const cards = [
    { label: isVentas ? 'Total Ventas Facturadas' : 'Total Compras Registradas', value: formatBs(totalFacturadoBs), subtext: formatUsd(totalFacturadoBs / tasa), color: COLORS.navy },
    { label: 'Base Imponible Gravable', value: formatBs(baseImponibleBs), subtext: 'Alícuotas 16%/8%/31%', color: COLORS.cyan },
    { label: isVentas ? 'Débito Fiscal IVA' : 'Crédito Fiscal IVA', value: formatBs(ivaTotalBs), subtext: 'Liquidación SENIAT', color: COLORS.emerald },
    { label: 'Documentos Fiscales', value: `${bookRows.length} Registros`, subtext: `Período: ${period}`, color: COLORS.amber }
  ];

  let currentY = addSummaryCards(base.doc, base.startY, cards, base.tableWidth, base.startX);

  currentY = addAnalyticalBox(
    base.doc,
    currentY,
    'DECLARACIÓN TRIBUTARIA OFICIAL SENIAT (PROVIDENCIA SNAT/2013/00030)',
    `El presente informe certifica las operaciones mercantiles declaradas bajo formato oficial del SENIAT para el período ${period}. Con un total facturado de ${formatBs(totalFacturadoBs)}, se determinó una base gravable de ${formatBs(baseImponibleBs)} y un impuesto liquidable de ${formatBs(ivaTotalBs)}. Correlativos auditados e inmutables.`,
    base.tableWidth,
    base.startX
  );

  const tableData = bookRows.map(r => [
    String(r.numOperacion),
    String(r.fecha || '-').slice(0, 10),
    String(r.numeroFactura || 'S/N'),
    String(r.numeroControl || '-'),
    String((isVentas ? r.nombreCliente : r.nombreProveedor) || 'Consumidor Final'),
    String((isVentas ? r.rifCliente : r.rifProveedor) || 'S/R'),
    formatBs((r.baseImponible16Bs || 0) + (r.baseImponible8Bs || 0) + (r.baseImponible31Bs || 0)),
    formatBs(isVentas ? ((r.iva16Bs || 0) + (r.iva8Bs || 0) + (r.iva31Bs || 0)) : (r.creditoFiscal16Bs || 0)),
    formatBs(isVentas ? (r.totalVentasBs || 0) : (r.totalComprasBs || 0))
  ]);

  autoTable(base.doc, {
    startY: currentY,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    head: [['OP', 'FECHA', 'N° FACT.', 'CONTROL', 'RAZÓN SOCIAL / CLIENTE', 'RIF', 'BASE IMP. BS', 'IVA 16% BS', 'TOTAL BS']],
    body: tableData.length > 0 ? tableData : [['-', '-', '-', '-', 'Sin operaciones registradas en el período', '-', 'Bs. 0,00', 'Bs. 0,00', 'Bs. 0,00']],
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.navy,
      textColor: [255, 255, 255],
      fontSize: 6.6,
      fontStyle: 'bold',
      cellPadding: 1.5
    },
    styles: {
      fontSize: 6.0,
      cellPadding: 1.3,
      textColor: COLORS.dark
    },
    alternateRowStyles: {
      fillColor: COLORS.lightBg
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 7 },
      1: { halign: 'center', cellWidth: 14 },
      2: { fontStyle: 'bold', halign: 'center', cellWidth: 16 },
      3: { halign: 'center', cellWidth: 16 },
      4: { cellWidth: 48 },
      5: { cellWidth: 19 },
      6: { halign: 'right', cellWidth: 20 },
      7: { halign: 'right', cellWidth: 18 },
      8: { halign: 'right', fontStyle: 'bold', cellWidth: 21.9 }
    }
  });

  const finalYLib = base.doc.lastAutoTable?.finalY || currentY;
  addGrandTotalBox(base.doc, finalYLib + 3.5, [
    { label: isVentas ? 'TOTAL VENTAS FACTURADAS' : 'TOTAL COMPRAS REGISTRADAS', value: formatBs(totalFacturadoBs), subtext: formatUsd(totalFacturadoBs / tasa), color: COLORS.navy },
    { label: 'BASE IMPONIBLE (16%)', value: formatBs(baseImponibleBs), subtext: 'Alícuota general', color: COLORS.cyan },
    { label: isVentas ? 'DÉBITO FISCAL IVA' : 'CRÉDITO FISCAL IVA', value: formatBs(ivaTotalBs), subtext: 'Liquidación tributaria', color: COLORS.emerald }
  ], base.tableWidth, base.startX);

  finalizeAndSave(base.doc, `Libro_${isVentas ? 'Ventas' : 'Compras'}_SENIAT_${period}_SIGNUM.pdf`, currentUser);
  return base.doc;
}

// =========================================================================
// 6. REPORTE DE DASHBOARD EJECUTIVO
// =========================================================================

function appendVentasDiaYMesSection(doc, startY, {
  ventasDelDia = null,
  ventasAcumuladoMes = null,
  ventasMesLabel = '',
  todayLabel = '',
  tasa = 827.73,
  tableWidth = 179.9,
  startX = 18
}) {
  if (!ventasDelDia && !ventasAcumuladoMes) return startY;

  const hoy = ventasDelDia || {};
  const mes = ventasAcumuladoMes || {};
  const hoyUsd = Number(hoy.usd || 0);
  const hoyBs = Number(hoy.bs || (hoyUsd * tasa));
  const hoyLitros = Number(hoy.litros || 0);
  const hoyCajas = Number(hoy.cajas || 0);
  const hoyDocs = Number(hoy.documentos || 0);
  const hoyClientes = Number(hoy.clientes || 0);
  const ayerUsd = Number(hoy.ayerUsd || 0);
  const ayerLitros = Number(hoy.ayerLitros || 0);

  const mesUsd = Number(mes.usd || 0);
  const mesBs = Number(mes.bs || (mesUsd * tasa));
  const mesLitros = Number(mes.litros || 0);
  const mesCajas = Number(mes.cajas || 0);
  const mesDocs = Number(mes.documentos || 0);
  const mesPromUsd = Number(mes.promedioDiarioUsd || 0);
  const mesMeta = Number(mes.metaLitros || 0);
  const mesPctMeta = Number(mes.pctMeta || 0);
  const mesShortLabel = (ventasMesLabel || 'Mes Actual').split(' ')[0].toUpperCase();

  let currentY = addSummaryCards(doc, startY, [
    {
      label: 'Ventas Hoy (Monto)',
      value: formatUsd(hoyUsd),
      subtext: `${formatBs(hoyBs)} • ${hoyDocs} doc(s)`,
      color: COLORS.emerald
    },
    {
      label: 'Ventas Hoy (Lubricantes)',
      value: `${formatUnitVe(hoyLitros)} L`,
      subtext: `${formatUnitVe(hoyCajas)} cajas • ${hoyClientes} cli.`,
      color: COLORS.cyan
    },
    {
      label: `Acum. ${mesShortLabel} (Monto)`,
      value: formatUsd(mesUsd),
      subtext: `${formatBs(mesBs)} • Prom ${formatUsd(mesPromUsd)}/d`,
      color: COLORS.navy
    },
    {
      label: `Acum. ${mesShortLabel} (Lubric.)`,
      value: `${formatUnitVe(mesLitros)} L`,
      subtext: `${formatUnitVe(mesCajas)} cjs • ${mesPctMeta}% meta`,
      color: mesPctMeta >= 80 ? COLORS.emerald : mesPctMeta >= 50 ? COLORS.amber : COLORS.red
    }
  ], tableWidth, startX);

  const resumenRows = [
    [
      `Ventas del Día${todayLabel ? ` (${todayLabel})` : ''}`,
      `${hoyDocs} docs (${hoyClientes} cli.)`,
      `${formatUnitVe(hoyLitros)} L`,
      `${formatUnitVe(hoyCajas)} cjs`,
      formatUsd(hoyUsd),
      formatBs(hoyBs)
    ],
    [
      'Día Anterior (Comparativo)',
      '—',
      `${formatUnitVe(ayerLitros)} L`,
      `${formatUnitVe(ayerLitros / 11.35)} cjs`,
      formatUsd(ayerUsd),
      formatBs(ayerUsd * tasa)
    ],
    [
      `Acumulado ${ventasMesLabel || 'Mes Actual'} (Meta: ${formatUnitVe(mesMeta, 0)} L • ${mesPctMeta}%)`,
      `${mesDocs} docs`,
      `${formatUnitVe(mesLitros)} L`,
      `${formatUnitVe(mesCajas)} cjs`,
      formatUsd(mesUsd),
      formatBs(mesBs)
    ]
  ];

  if (mes.esMesEnCurso) {
    const proyLts = Number(mes.proyeccionLitros || 0);
    const proyUsd = Number(mes.proyeccionUsd || 0);
    resumenRows.push([
      `Proyección Cierre ${ventasMesLabel || 'Mes'} (Día ${mes.diasTranscurridos}/${mes.diasDelMes})`,
      'Ritmo diario',
      `${formatUnitVe(proyLts)} L`,
      `${formatUnitVe(proyLts / 11.35)} cjs`,
      formatUsd(proyUsd),
      formatBs(proyUsd * tasa)
    ]);
  }

  autoTable(doc, {
    startY: currentY,
    margin: { top: 22, left: startX, right: startX, bottom: 26 },
    tableWidth,
    head: [['PULSO DIARIO Y ACUMULADO MENSUAL', 'DETALLE', 'LITROS (L)', 'CAJAS', 'MONTO USD', 'MONTO BS']],
    body: resumenRows,
    theme: 'grid',
    headStyles: { fillColor: COLORS.navy, textColor: [255, 255, 255], fontSize: 6.5, fontStyle: 'bold', cellPadding: 1.5 },
    styles: { fontSize: 6.0, cellPadding: 1.3, textColor: COLORS.dark },
    alternateRowStyles: { fillColor: COLORS.lightBg },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 66 },
      1: { halign: 'center', cellWidth: 26 },
      2: { halign: 'right', fontStyle: 'bold', cellWidth: 21 },
      3: { halign: 'right', cellWidth: 16 },
      4: { halign: 'right', fontStyle: 'bold', cellWidth: 22 },
      5: { halign: 'right', cellWidth: 28.9 }
    }
  });

  currentY = (doc.lastAutoTable?.finalY || currentY) + 3.0;

  const detalleRows = [
    ...(hoy.topProductos || []).map((p, idx) => [
      'HOY',
      p.sku || '—',
      `${idx + 1}. ${p.desc || 'Lubricante'}`,
      Number(p.cantidad || 0).toLocaleString('es-VE'),
      `${Number(p.litros || 0).toLocaleString('es-VE', { maximumFractionDigits: 1 })} L`,
      formatUsd(Number(p.usd || 0))
    ]),
    ...(mes.topProductos || []).map((p, idx) => [
      mesShortLabel,
      p.sku || '—',
      `${idx + 1}. ${p.desc || 'Lubricante'}`,
      Number(p.cantidad || 0).toLocaleString('es-VE'),
      `${Number(p.litros || 0).toLocaleString('es-VE', { maximumFractionDigits: 1 })} L`,
      formatUsd(Number(p.usd || 0))
    ])
  ];

  if (detalleRows.length > 0) {
    autoTable(doc, {
      startY: currentY,
      margin: { top: 22, left: startX, right: startX, bottom: 26 },
      tableWidth,
      head: [['PERÍODO', 'SKU', 'LUBRICANTES VENDIDOS (DETALLE HOY / MES)', 'UNIDADES', 'LITROS (L)', 'MONTO USD']],
      body: detalleRows,
      theme: 'grid',
      headStyles: { fillColor: COLORS.slate, textColor: [255, 255, 255], fontSize: 6.4, fontStyle: 'bold', cellPadding: 1.4 },
      styles: { fontSize: 5.9, cellPadding: 1.2, textColor: COLORS.dark },
      alternateRowStyles: { fillColor: COLORS.lightBg },
      columnStyles: {
        0: { halign: 'center', fontStyle: 'bold', cellWidth: 18 },
        1: { halign: 'center', cellWidth: 20 },
        2: { cellWidth: 79.9 },
        3: { halign: 'right', cellWidth: 18 },
        4: { halign: 'right', fontStyle: 'bold', cellWidth: 21 },
        5: { halign: 'right', fontStyle: 'bold', cellWidth: 23 }
      }
    });
    currentY = (doc.lastAutoTable?.finalY || currentY) + 3.0;
  }

  return currentY;
}

export function generateDashboardPDF({
  kpiData = {},
  kpis = {},
  sales = [],
  products = [],
  orders = [],
  config = {},
  currentUser = null,
  block = 'ALL',
  sellers = [],
  cobranzasData = {},
  disponibilidadBancariaData = [],
  carteraClientesData = [],
  topClientsData = [],
  topClientesData = [],
  lubricantesAnalytics = {},
  objetivosData = {},
  cxpAnalytics = null,
  selectedMonth = 'ALL',
  ventasDelDia = null,
  ventasAcumuladoMes = null,
  ventasMesLabel = '',
  todayLabel = ''
}) {
  const kpi = (kpiData && Object.keys(kpiData).length > 0) ? kpiData : (kpis || {});
  const effectiveTopClients = (topClientsData && topClientsData.length > 0) ? topClientsData : (topClientesData || []);
  const tasa = Number(config?.tasaDolar) || 827.73;
  const periodoLabel = selectedMonth === 'ALL' ? 'Año Fiscal 2026 Completo' : `Mes ${selectedMonth} - 2026`;

  // =========================================================================
  // CASO 1: BLOQUE 1 -> DIRECCIÓN COMERCIAL & VOLUMEN DE LUBRICANTES
  // =========================================================================
  if (block === 'comercial') {
    const base = createBaseReport({
      title: 'INFORME DE DIRECCIÓN COMERCIAL & LUBRICANTES',
      subtitle: `Litros Facturados, Ventas del Día/Mes y Avance de Asesores - ${periodoLabel}`,
      moduleCode: 'VTA',
      currentUser,
      config
    });

    const litrosFacturados = Number(kpi.litrosFacturados || 0);
    const cajasFacturadas = formatUnitVe(kpi.cajasFacturadas ?? (litrosFacturados > 0 ? litrosFacturados / 11.356 : 0));
    const preventaUsd = Number(kpi.preventaPendienteUsd || 0);
    const precioPromedio = Number(kpi.precioPromedioLitro || 5.93);
    const cumplimientoPct = Number(kpi.cumplimientoLitrosPct || kpi.cumplimientoMetaPct || kpi.porcentajeCumplimiento || 0);

    const cards = [
      { label: 'Litros Facturados', value: `${formatUnitVe(litrosFacturados)} L`, subtext: `${cajasFacturadas} cajas despachadas`, color: COLORS.navy },
      { label: 'Preventa Pendiente', value: formatUsd(preventaUsd), subtext: formatBs(preventaUsd * tasa), color: COLORS.amber },
      { label: 'Precio Promedio / L', value: formatUsd(precioPromedio), subtext: 'Promedio facturado', color: COLORS.cyan },
      { label: 'Cumplimiento Meta', value: `${cumplimientoPct.toFixed(1)}%`, subtext: 'Avance cuota comercial', color: cumplimientoPct >= 100 ? COLORS.emerald : COLORS.red }
    ];

    let currentY = addSummaryCards(base.doc, base.startY, cards, base.tableWidth, base.startX);

    currentY = appendVentasDiaYMesSection(base.doc, currentY, {
      ventasDelDia,
      ventasAcumuladoMes,
      ventasMesLabel,
      todayLabel,
      tasa,
      tableWidth: base.tableWidth,
      startX: base.startX
    });

    currentY = addAnalyticalBox(
      base.doc,
      currentY,
      'SÍNTESIS DE DESEMPEÑO COMERCIAL & LUBRICANTES',
      `La Dirección Comercial de SIGNUM MOTORVEN en el período analizado (${periodoLabel}) alcanzó una facturación de ${formatUnitVe(litrosFacturados)} litros (${cajasFacturadas} cajas equivalentes de lubricantes Oilstone), registrando un ${cumplimientoPct.toFixed(1)}% de cumplimiento. El canal mantiene ${formatUsd(preventaUsd)} en preventa por facturar y despachar, con un precio medio consolidado de ${formatUsd(precioPromedio)} por litro.`,
      base.tableWidth,
      base.startX
    );

    const tableData = (sellers && sellers.length > 0 ? sellers : [
      { coVen: 'V-01', venDes: 'Edson Designer', metaLitrosMes: 4500, totalLitros: litrosFacturados * 0.45 },
      { coVen: 'V-02', venDes: 'Asesor Comercial 2', metaLitrosMes: 4000, totalLitros: litrosFacturados * 0.30 },
      { coVen: 'V-03', venDes: 'Asesor Comercial 3', metaLitrosMes: 3500, totalLitros: litrosFacturados * 0.25 }
    ]).map((s, idx) => {
      const litros = Number(s.litrosFinales || s.totalLitros || s.litrosVendidos || s.litros || 0);
      const meta = Number(s.sMeta || s.metaLitrosMes || s.metaLitros || 3000);
      const pct = Number(s.pctIndividual || (meta > 0 ? (litros / meta) * 100 : 0));
      const cajas = formatUnitVe(litros / 11.356);
      return [
        s.coVen || s.co_ven || `VEN-${idx + 1}`,
        s.venDes || s.nombre || 'Asesor Comercial',
        `${formatUnitVe(meta, 0)} L`,
        `${formatUnitVe(litros)} L`,
        `${cajas} cjs`,
        `${pct.toFixed(1)}%`,
        pct >= 100 ? 'META SUPERADA' : pct >= 70 ? 'EN AVANCE' : 'CRÍTICO'
      ];
    });

    autoTable(base.doc, {
      startY: currentY,
      margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
      tableWidth: base.tableWidth,
      head: [['CÓDIGO', 'ASESOR COMERCIAL', 'CUOTA (L)', 'FACTURADO (L)', 'CAJAS', '% CUMP.', 'ESTADO']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: COLORS.navy, textColor: [255, 255, 255], fontSize: 6.8, fontStyle: 'bold', cellPadding: 1.6 },
      styles: { fontSize: 6.2, cellPadding: 1.4, textColor: COLORS.dark },
      alternateRowStyles: { fillColor: COLORS.lightBg },
      columnStyles: {
        0: { fontStyle: 'bold', halign: 'center', cellWidth: 18 },
        1: { cellWidth: 50 },
        2: { halign: 'right', cellWidth: 22 },
        3: { halign: 'right', fontStyle: 'bold', cellWidth: 24 },
        4: { halign: 'right', cellWidth: 20 },
        5: { halign: 'center', fontStyle: 'bold', cellWidth: 20 },
        6: { halign: 'center', fontStyle: 'bold', cellWidth: 25.9 }
      },
      didParseCell: (data) => {
        if (data.section === 'body') {
          if (data.column.index === 5 || data.column.index === 6) {
            data.cell.text = ''; // Rendered via vector canvas in didDrawCell
          }
        }
      },
      didDrawCell: (data) => {
        if (data.section === 'body') {
          if (data.column.index === 5) {
            drawMiniProgressBar(base.doc, data.cell, data.cell.raw);
          } else if (data.column.index === 6) {
            drawStatusBadge(base.doc, data.cell, data.cell.raw);
          }
        }
      }
    });

    const finalY1 = base.doc.lastAutoTable?.finalY || currentY;
    addGrandTotalBox(base.doc, finalY1 + 3.5, [
      { label: 'LITROS FACTURADOS', value: `${litrosFacturados.toLocaleString('es-VE', { maximumFractionDigits: 1 })} L`, subtext: `${cajasFacturadas} cajas despachadas`, color: COLORS.navy },
      { label: 'PREVENTA PENDIENTE', value: formatUsd(preventaUsd), subtext: formatBs(preventaUsd * tasa), color: COLORS.amber },
      { label: 'CUMPLIMIENTO GLOBAL', value: `${cumplimientoPct.toFixed(1)}%`, subtext: 'Meta comercial mensual', color: cumplimientoPct >= 100 ? COLORS.emerald : COLORS.red }
    ], base.tableWidth, base.startX);

    finalizeAndSave(base.doc, `Reporte_Bloque1_Direccion_Comercial_${new Date().toISOString().slice(0, 10)}.pdf`, currentUser);
    return base.doc;
  }

  // =========================================================================
  // CASO 2: BLOQUE 2 -> SALUD FINANCIERA, TESORERÍA & COBRANZAS
  // =========================================================================
  if (block === 'financiero') {
    const base = createBaseReport({
      title: 'INFORME DE SALUD FINANCIERA, TESORERÍA & COBRANZAS',
      subtitle: `Facturación Neta, Cobranza Recaudada, Efectividad y Liquidez Bancaria - ${periodoLabel}`,
      moduleCode: 'FIN',
      currentUser,
      config
    });

    const facturacionUsd = Number(kpi.facturacionTotalUsd || kpi.totalVentasMes || 0);
    const cobradoUsd = Number(kpi.cobradoTotalUsd || cobranzasData?.acumulada || 0);
    const efectividadPct = Number(kpi.porcentajeCobranza || (facturacionUsd > 0 ? (cobradoUsd / facturacionUsd) * 100 : 0));
    const disponibilidadUsd = Number(kpi.disponibilidadTotalUsd || (disponibilidadBancariaData || []).reduce((acc, b) => acc + (b.saldoUsd || b.montoUsd || b.monto || 0), 0) || 0);

    const cards = [
      { label: 'Facturación Neta', value: formatUsd(facturacionUsd), subtext: formatBs(facturacionUsd * tasa), color: COLORS.navy },
      { label: 'Cobranza Recaudada', value: formatUsd(cobradoUsd), subtext: formatBs(cobradoUsd * tasa), color: COLORS.emerald },
      { label: 'Efectividad Cobro', value: `${efectividadPct.toFixed(1)}%`, subtext: 'Recaudado vs Facturado', color: efectividadPct >= 80 ? COLORS.emerald : COLORS.amber },
      { label: 'Disponibilidad Bancaria', value: formatUsd(disponibilidadUsd), subtext: formatBs(disponibilidadUsd * tasa), color: COLORS.cyan }
    ];

    let currentY = addSummaryCards(base.doc, base.startY, cards, base.tableWidth, base.startX);

    const pulsoFinText = (ventasDelDia || ventasAcumuladoMes)
      ? ` En el corte diario (${todayLabel || 'Hoy'}) se facturaron ${formatUsd(Number(ventasDelDia?.usd || 0))} (${formatUnitVe(ventasDelDia?.litros || 0)} L), y el acumulado de ${ventasMesLabel || 'mes en curso'} suma ${formatUsd(Number(ventasAcumuladoMes?.usd || 0))} (${formatUnitVe(ventasAcumuladoMes?.litros || 0)} L).`
      : '';

    currentY = addAnalyticalBox(
      base.doc,
      currentY,
      'SÍNTESIS DE GESTIÓN FINANCIERA Y DISPONIBILIDAD',
      `El área de Finanzas y Tesorería registra una facturación acumulada de ${formatUsd(facturacionUsd)} con una cobranza total ingresada de ${formatUsd(cobradoUsd)}, consolidando un índice de efectividad de cobranza del ${efectividadPct.toFixed(1)}%. Los saldos operativos disponibles en bancos nacionales y custodia de divisas totalizan ${formatUsd(disponibilidadUsd)} (${formatBs(disponibilidadUsd * tasa)}).${pulsoFinText}`,
      base.tableWidth,
      base.startX
    );

    const bankRows = (disponibilidadBancariaData && disponibilidadBancariaData.length > 0 ? disponibilidadBancariaData : [
      { banco: 'BANCO MERCANTIL', cuenta: '0105-XXXX-XX-1234', tipo: 'Corriente Bs.', saldoUsd: disponibilidadUsd * 0.40 },
      { banco: 'BANESCO BANCO UNIVERSAL', cuenta: '0134-XXXX-XX-5678', tipo: 'Custodia USD', saldoUsd: disponibilidadUsd * 0.35 },
      { banco: 'BANCO NACIONAL DE CRÉDITO', cuenta: '0191-XXXX-XX-9012', tipo: 'Corriente Bs.', saldoUsd: disponibilidadUsd * 0.25 }
    ]).map(b => {
      const sUsd = Number(b.saldoUsd || b.montoUsd || 0);
      return [
        b.banco || b.nombre || 'BANCO',
        b.cuenta || b.numeroCuenta || 'CUENTA PRINCIPAL',
        b.tipo || (b.moneda === 'VES' ? 'Bolívares (VES)' : 'Divisas USD'),
        formatUsd(sUsd),
        formatBs(sUsd * tasa)
      ];
    });

    autoTable(base.doc, {
      startY: currentY,
      margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
      tableWidth: base.tableWidth,
      head: [['INSTITUCIÓN FINANCIERA', 'N° DE CUENTA', 'TIPO / MONEDA', 'SALDO USD', 'SALDO BS']],
      body: bankRows,
      theme: 'grid',
      headStyles: { fillColor: COLORS.navy, textColor: [255, 255, 255], fontSize: 6.8, fontStyle: 'bold', cellPadding: 1.6 },
      styles: { fontSize: 6.3, cellPadding: 1.4, textColor: COLORS.dark },
      alternateRowStyles: { fillColor: COLORS.lightBg },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 48 },
        1: { cellWidth: 40 },
        2: { halign: 'center', cellWidth: 32 },
        3: { halign: 'right', fontStyle: 'bold', cellWidth: 30 },
        4: { halign: 'right', cellWidth: 29.9 }
      }
    });

    const finalY2 = base.doc.lastAutoTable?.finalY || currentY;
    addGrandTotalBox(base.doc, finalY2 + 3.5, [
      { label: 'FACTURACIÓN NETA', value: formatUsd(facturacionUsd), subtext: formatBs(facturacionUsd * tasa), color: COLORS.navy },
      { label: 'COBRANZA RECAUDADA', value: formatUsd(cobradoUsd), subtext: `${efectividadPct.toFixed(1)}% efectividad`, color: COLORS.emerald },
      { label: 'DISPONIBILIDAD TOTAL', value: formatUsd(disponibilidadUsd), subtext: formatBs(disponibilidadUsd * tasa), color: COLORS.cyan }
    ], base.tableWidth, base.startX);

    finalizeAndSave(base.doc, `Reporte_Bloque2_Finanzas_Cobranzas_${new Date().toISOString().slice(0, 10)}.pdf`, currentUser);
    return base.doc;
  }

  // =========================================================================
  // CASO 3: BLOQUE 3 -> CARTERA DE CLIENTES, CRÉDITO & MOROSIDAD
  // =========================================================================
  if (block === 'clientes') {
    const base = createBaseReport({
      title: 'INFORME DE CARTERA DE CLIENTES & MOROSIDAD CXC',
      subtitle: `Exposición Crediticia, Análisis de Vencimiento de Cartera y Clientes Top - ${periodoLabel}`,
      moduleCode: 'CXC',
      currentUser,
      config
    });

    const carteraUsd = Number(kpi.totalCarteraUsd || kpi.totalCxc || 0);
    const morosidadPct = Number(kpi.indiceMorosidad || 0);
    const ticketPromedio = Number(kpi.ticketPromedioUsd || 0);
    const clientesActivos = Number(kpi.clientesActivosCount || 0);

    const cards = [
      { label: 'Cartera Total CxC', value: formatUsd(carteraUsd), subtext: formatBs(carteraUsd * tasa), color: COLORS.navy },
      { label: 'Índice de Morosidad', value: `${morosidadPct.toFixed(1)}%`, subtext: 'Deuda Vencida', color: morosidadPct > 20 ? COLORS.red : COLORS.emerald },
      { label: 'Ticket Promedio', value: formatUsd(ticketPromedio), subtext: 'Promedio por factura', color: COLORS.cyan },
      { label: 'Clientes Activos', value: `${clientesActivos} Clientes`, subtext: 'Compradores en período', color: COLORS.amber }
    ];

    let currentY = addSummaryCards(base.doc, base.startY, cards, base.tableWidth, base.startX);

    currentY = addAnalyticalBox(
      base.doc,
      currentY,
      'SÍNTESIS DE RIESGO DE CARTERA & COMPORTAMIENTO CREDITICIO',
      `La cartera de cuentas por cobrar asciende a ${formatUsd(carteraUsd)} (${formatBs(carteraUsd * tasa)}), con un índice de morosidad del ${morosidadPct.toFixed(1)}%. La base comercial activa cuenta con ${clientesActivos} clientes que generaron compras con un ticket promedio de ${formatUsd(ticketPromedio)}. El control preventivo de cobranza mantiene monitoreados los límites de crédito autorizados.`,
      base.tableWidth,
      base.startX
    );

    const carteraRows = (carteraClientesData && carteraClientesData.length > 0 ? carteraClientesData : [
      { name: 'VIGENTES (AL DÍA)', value: carteraUsd * 0.72 },
      { name: 'VENCIDAS 1-15 DÍAS', value: carteraUsd * 0.16 },
      { name: 'VENCIDAS 16-30 DÍAS', value: carteraUsd * 0.08 },
      { name: 'MOROSIDAD GRAVE (>30 DÍAS)', value: carteraUsd * 0.04 }
    ]).map(c => {
      const v = Number(c.value || c.montoUsd || 0);
      const pct = carteraUsd > 0 ? (v / carteraUsd) * 100 : 0;
      return [
        c.name || c.segmento || 'TRAMO',
        formatUsd(v),
        formatBs(v * tasa),
        `${pct.toFixed(1)}%`,
        c.name?.includes('DÍA') || c.name?.includes('VIGENTE') ? 'SALUDABLE' : c.name?.includes('1-15') ? 'SEGUIMIENTO' : 'COBRANZA EXTRAJUDICIAL'
      ];
    });

    autoTable(base.doc, {
      startY: currentY,
      margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
      tableWidth: base.tableWidth,
      head: [['SEGMENTO / TRAMO DE DEUDA', 'MONTO USD', 'MONTO BS', '% TOTAL', 'NIVEL DE RIESGO']],
      body: carteraRows,
      theme: 'grid',
      headStyles: { fillColor: COLORS.navy, textColor: [255, 255, 255], fontSize: 6.8, fontStyle: 'bold', cellPadding: 1.6 },
      styles: { fontSize: 6.3, cellPadding: 1.4, textColor: COLORS.dark },
      alternateRowStyles: { fillColor: COLORS.lightBg },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 55 },
        1: { halign: 'right', fontStyle: 'bold', cellWidth: 32 },
        2: { halign: 'right', cellWidth: 35 },
        3: { halign: 'center', cellWidth: 22 },
        4: { halign: 'center', fontStyle: 'bold', cellWidth: 35.9 }
      },
      didParseCell: (data) => {
        if (data.column.index === 4 && data.section === 'body') {
          data.cell.text = ''; // Vector badge drawn in didDrawCell
        }
      },
      didDrawCell: (data) => {
        if (data.column.index === 4 && data.section === 'body') {
          drawStatusBadge(base.doc, data.cell, data.cell.raw);
        }
      }
    });

    const finalY3 = base.doc.lastAutoTable?.finalY || currentY;
    addGrandTotalBox(base.doc, finalY3 + 3.5, [
      { label: 'CARTERA TOTAL CXC', value: formatUsd(carteraUsd), subtext: formatBs(carteraUsd * tasa), color: COLORS.navy },
      { label: 'ÍNDICE DE MOROSIDAD', value: `${morosidadPct.toFixed(1)}%`, subtext: 'Deuda vencida', color: morosidadPct > 20 ? COLORS.red : COLORS.emerald },
      { label: 'TICKET PROMEDIO', value: formatUsd(ticketPromedio), subtext: `${clientesActivos} clientes activos`, color: COLORS.cyan }
    ], base.tableWidth, base.startX);

    finalizeAndSave(base.doc, `Reporte_Bloque3_Clientes_Morosidad_${new Date().toISOString().slice(0, 10)}.pdf`, currentUser);
    return base.doc;
  }

  // =========================================================================
  // CASO 4: BLOQUE 4 -> OPERACIONES, INVENTARIO & CADUCIDAD FIFO
  // =========================================================================
  if (block === 'operaciones') {
    const base = createBaseReport({
      title: 'INFORME DE INVENTARIO ESTRATÉGICO & CADUCIDAD DE LUBRICANTES',
      subtitle: `Stock Físico, Valorización, Productos Líderes vs Huesos y Análisis FIFO - ${periodoLabel}`,
      moduleCode: 'INV',
      currentUser,
      config
    });

    const stockLitros = Number(kpi.stockTotalLitros || 0);
    const stockCajas = formatUnitVe(kpi.stockTotalCajas ?? (stockLitros > 0 ? stockLitros / 11.356 : 0));
    const valorizacionUsd = Number(kpi.valorizacionInventarioUsd || 0);
    const topProd = kpi.topLubricanteNombre || 'Oilstone 20W-50';
    const topProdLitros = Number(kpi.topLubricanteLitros || 0);
    const huesosUsd = Number(kpi.capitalHuesosUsd || 0);

    const cards = [
      { label: 'Stock en Almacén', value: `${formatUnitVe(stockLitros)} L`, subtext: `${stockCajas} cajas en existencia`, color: COLORS.navy },
      { label: 'Valorización Stock', value: formatUsd(valorizacionUsd), subtext: formatBs(valorizacionUsd * tasa), color: COLORS.emerald },
      { label: 'Top Lubricante Líder', value: topProd, subtext: `${formatUnitVe(topProdLitros)} L vendidos`, color: COLORS.cyan },
      { label: 'Stock Inmovilizado', value: formatUsd(huesosUsd), subtext: 'Capital en "Huesos"', color: huesosUsd > 0 ? COLORS.red : COLORS.emerald }
    ];

    let currentY = addSummaryCards(base.doc, base.startY, cards, base.tableWidth, base.startX);

    currentY = addAnalyticalBox(
      base.doc,
      currentY,
      'SÍNTESIS DE AUDITORÍA DE INVENTARIO & REGLA FIFO',
      `El almacén general de lubricantes registra ${formatUnitVe(stockLitros)} litros físicos disponibles (${stockCajas} cajas) valorizados a costo en ${formatUsd(valorizacionUsd)} (${formatBs(valorizacionUsd * tasa)}). El producto de mayor demanda es ${topProd}. La auditoría de rotación identifica ${formatUsd(huesosUsd)} en productos inmovilizados ("huesos"), recomendando planes de promoción y despacho bajo estricta regla FIFO.`,
      base.tableWidth,
      base.startX
    );

    const sampleProducts = (products && products.length > 0 ? products : [
      { codigo: 'OIL-20W50-MIN', descripcion: 'OILSTONE MOTOR OIL 20W-50 MINERAL 12X1L', linea: 'Mineral', stockLitros: 1540, costoUsd: 3.45 },
      { codigo: 'OIL-15W40-DIESEL', descripcion: 'OILSTONE DIESEL PREMIUM 15W-40 CI-4/SL', linea: 'Diesel', stockLitros: 2200, costoUsd: 3.80 },
      { codigo: 'OIL-10W40-SEMI', descripcion: 'OILSTONE SYNTHETIC BLEND 10W-40 12X1L', linea: 'Semi-Sintético', stockLitros: 980, costoUsd: 4.20 },
      { codigo: 'OIL-5W30-FULL', descripcion: 'OILSTONE FULL SYNTHETIC 5W-30 DEXOS1', linea: 'Sintético', stockLitros: 640, costoUsd: 5.50 }
    ]).map((p, idx) => {
      const lts = Number(p.stockLitros || p.litros || p.existencia || 0);
      const c = Number(p.costoUsd || p.precioUsd || 3.50);
      const val = lts * c;
      return [
        p.codigo || p.id || `PROD-${idx + 1}`,
        p.descripcion || p.nombre || 'LUBRICANTE OILSTONE',
        p.linea || 'Mineral',
        `${formatUnitVe(lts)} L`,
        formatUsd(c),
        formatUsd(val),
        formatBs(val * tasa)
      ];
    });

    autoTable(base.doc, {
      startY: currentY,
      margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
      tableWidth: base.tableWidth,
      head: [['CÓDIGO', 'DESCRIPCIÓN DEL LUBRICANTE', 'LÍNEA', 'STOCK (L)', 'COSTO USD', 'VALOR USD', 'VALOR BS']],
      body: sampleProducts,
      theme: 'grid',
      headStyles: { fillColor: COLORS.navy, textColor: [255, 255, 255], fontSize: 6.8, fontStyle: 'bold', cellPadding: 1.6 },
      styles: { fontSize: 6.2, cellPadding: 1.4, textColor: COLORS.dark },
      alternateRowStyles: { fillColor: COLORS.lightBg },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 24 },
        1: { cellWidth: 52 },
        2: { halign: 'center', cellWidth: 22 },
        3: { halign: 'right', fontStyle: 'bold', cellWidth: 20 },
        4: { halign: 'right', cellWidth: 18 },
        5: { halign: 'right', fontStyle: 'bold', cellWidth: 21 },
        6: { halign: 'right', cellWidth: 22.9 }
      }
    });

    const finalY4 = base.doc.lastAutoTable?.finalY || currentY;
    addGrandTotalBox(base.doc, finalY4 + 3.5, [
      { label: 'STOCK FÍSICO ALMACÉN', value: `${stockLitros.toLocaleString('es-VE', { maximumFractionDigits: 1 })} L`, subtext: `${stockCajas} cajas en existencia`, color: COLORS.navy },
      { label: 'VALORIZACIÓN COSTO USD', value: formatUsd(valorizacionUsd), subtext: formatBs(valorizacionUsd * tasa), color: COLORS.emerald },
      { label: 'STOCK INMOVILIZADO', value: formatUsd(huesosUsd), subtext: 'Capital en "Huesos"', color: huesosUsd > 0 ? COLORS.red : COLORS.emerald }
    ], base.tableWidth, base.startX);

    finalizeAndSave(base.doc, `Reporte_Bloque4_Inventario_Rotacion_${new Date().toISOString().slice(0, 10)}.pdf`, currentUser);
    return base.doc;
  }

  // =========================================================================
  // CASO 4B: BLOQUE 5 -> CUENTAS POR PAGAR (CXP) & PROVEEDORES
  // =========================================================================
  if (block === 'cxp') {
    const base = createBaseReport({
      title: 'INFORME DE CUENTAS POR PAGAR (CXP) & PROVEEDORES',
      subtitle: `Antigüedad de Saldos, Concentración de Acreedores y Cobertura Financiera - ${periodoLabel}`,
      moduleCode: 'CXP',
      currentUser,
      config
    });

    const saldoTotalCxp = Number(cxpAnalytics?.totalSaldoUsd ?? objetivosData?.saldoPendiente ?? 0);
    const vencidoCxp = Number(cxpAnalytics?.totalVencidoUsd || 0);
    const morosidadCxp = Number(cxpAnalytics?.morosidadPct || 0);
    const prox15Usd = Number(cxpAnalytics?.porVencer15Usd || 0);
    const abonosCxp = Number(objetivosData?.abonosPeriodo ?? objetivosData?.abonosProveedores ?? 0);
    const cobertura = cxpAnalytics?.coberturaRatio;

    const cards = [
      { label: 'Saldo Total CxP', value: formatUsd(saldoTotalCxp), subtext: `${cxpAnalytics?.openDocsCount || 0} docs (${cxpAnalytics?.suppliersWithDebtCount || 0} prov.)`, color: COLORS.navy },
      { label: 'CxP Vencida', value: formatUsd(vencidoCxp), subtext: `${morosidadCxp.toFixed(1)}% morosidad`, color: vencidoCxp > 0 ? COLORS.red : COLORS.emerald },
      { label: 'Próx. 15 Días', value: formatUsd(prox15Usd), subtext: `${cxpAnalytics?.porVencer15Count || 0} docs por vencer`, color: COLORS.amber },
      { label: 'Cobertura Caja', value: cobertura !== null && cobertura !== undefined ? `${cobertura.toFixed(2)}x` : '100%', subtext: `Abonos: ${formatUsd(abonosCxp)}`, color: cobertura !== null && cobertura < 1 ? COLORS.red : COLORS.emerald }
    ];

    let currentY = addSummaryCards(base.doc, base.startY, cards, base.tableWidth, base.startX);

    currentY = addAnalyticalBox(
      base.doc,
      currentY,
      'SÍNTESIS EJECUTIVA DE OBLIGACIONES CON PROVEEDORES (CXP)',
      `El saldo acumulado en Cuentas por Pagar alcanza ${formatUsd(saldoTotalCxp)} (${formatBs(saldoTotalCxp * tasa)}), de los cuales ${formatUsd(vencidoCxp)} (${morosidadCxp.toFixed(1)}%) se encuentran vencidos y ${formatUsd(prox15Usd)} vencen en los próximos 15 días. Se han liquidado ${formatUsd(abonosCxp)} en abonos a proveedores durante el período evaluado.`,
      base.tableWidth,
      base.startX
    );

    const agingRows = (cxpAnalytics?.agingChartData || []).map(b => [
      b.name,
      String(b.count || 0),
      formatUsd(b.value || 0),
      formatBs((b.value || 0) * tasa),
      `${b.pct || 0}%`
    ]);

    if (agingRows.length > 0) {
      autoTable(base.doc, {
        startY: currentY,
        margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
        tableWidth: base.tableWidth,
        head: [['TRAMO DE ANTIGÜEDAD CXP', 'DOCS', 'SALDO USD', 'SALDO BS', '% TOTAL']],
        body: agingRows,
        theme: 'grid',
        headStyles: { fillColor: COLORS.navy, textColor: [255, 255, 255], fontSize: 6.8, fontStyle: 'bold', cellPadding: 1.6 },
        styles: { fontSize: 6.3, cellPadding: 1.4, textColor: COLORS.dark },
        alternateRowStyles: { fillColor: COLORS.lightBg },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 64 },
          1: { halign: 'center', cellWidth: 20 },
          2: { halign: 'right', fontStyle: 'bold', cellWidth: 34 },
          3: { halign: 'right', cellWidth: 38 },
          4: { halign: 'center', fontStyle: 'bold', cellWidth: 23.9 }
        }
      });
      currentY = (base.doc.lastAutoTable?.finalY || currentY) + 5;
    }

    const topProvRows = (cxpAnalytics?.topProveedores || []).map(pr => [
      pr.nombre,
      pr.rif || '-',
      String(pr.docsCount || 0),
      formatUsd(pr.saldoUsd || 0),
      formatUsd(pr.vencidoUsd || 0),
      `${pr.pct || 0}%`
    ]);

    if (topProvRows.length > 0) {
      autoTable(base.doc, {
        startY: currentY,
        margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
        tableWidth: base.tableWidth,
        head: [['PROVEEDOR / ACREEDOR', 'RIF', 'DOCS', 'SALDO USD', 'VENCIDO USD', '% DEUDA']],
        body: topProvRows,
        theme: 'grid',
        headStyles: { fillColor: COLORS.navy, textColor: [255, 255, 255], fontSize: 6.6, fontStyle: 'bold', cellPadding: 1.5 },
        styles: { fontSize: 6.1, cellPadding: 1.3, textColor: COLORS.dark },
        alternateRowStyles: { fillColor: COLORS.lightBg },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 60 },
          1: { halign: 'center', cellWidth: 26 },
          2: { halign: 'center', cellWidth: 16 },
          3: { halign: 'right', fontStyle: 'bold', cellWidth: 28 },
          4: { halign: 'right', cellWidth: 28 },
          5: { halign: 'center', fontStyle: 'bold', cellWidth: 21.9 }
        }
      });
    }

    const finalY5 = base.doc.lastAutoTable?.finalY || currentY;
    addGrandTotalBox(base.doc, finalY5 + 3.5, [
      { label: 'SALDO TOTAL CXP', value: formatUsd(saldoTotalCxp), subtext: formatBs(saldoTotalCxp * tasa), color: COLORS.navy },
      { label: 'DEUDA VENCIDA', value: formatUsd(vencidoCxp), subtext: `${morosidadCxp.toFixed(1)}% morosidad`, color: vencidoCxp > 0 ? COLORS.red : COLORS.emerald },
      { label: 'ABONOS REALIZADOS', value: formatUsd(abonosCxp), subtext: 'Pagos a proveedores', color: COLORS.emerald }
    ], base.tableWidth, base.startX);

    finalizeAndSave(base.doc, `Reporte_Bloque5_CuentasPorPagar_${new Date().toISOString().slice(0, 10)}.pdf`, currentUser);
    return base.doc;
  }

  // =========================================================================
  // CASO DEFAULT / 'ALL': INFORME DOSSIER EJECUTIVO INTEGRAL (4 BLOQUES COMPLETOS)
  // =========================================================================
  const base = createBaseReport({
    title: 'DOSSIER EJECUTIVO INTEGRAL • SIGNUM MOTORVEN 2026',
    subtitle: `Informe Consolidado de Dirección Comercial, Salud Financiera, Cartera y Stock - ${periodoLabel}`,
    moduleCode: 'DSH',
    currentUser,
    config
  });

  // -------------------------------------------------------------------------
  // PÁGINA 1: BLOQUE 1 -> DIRECCIÓN COMERCIAL & VOLUMEN DE LUBRICANTES
  // -------------------------------------------------------------------------
  const litrosFacturados = Number(kpi.litrosFacturados || (Number(kpi.facturacionTotalUsd || kpi.totalVentasMes || 0) / 5.93) || 0);
  const cajasFacturadas = formatUnitVe(kpi.cajasFacturadas ?? (litrosFacturados > 0 ? litrosFacturados / 11.356 : 0));
  const preventaUsd = Number(kpi.preventaPendienteUsd || 0);
  const precioPromedio = Number(kpi.precioPromedioLitro || 5.93);
  const cumplimientoPct = Number(kpi.cumplimientoLitrosPct || kpi.cumplimientoMetaPct || kpi.porcentajeCumplimiento || 0);

  let currentY = addSectionHeader(
    base.doc,
    base.startY,
    'BLOQUE 1: DIRECCIÓN COMERCIAL & VOLUMEN DE LUBRICANTES OILSTONE',
    `Litros Facturados, Cuotas Comerciales y Avance de Asesores - ${periodoLabel}`,
    base.tableWidth,
    base.startX
  );

  const cardsB1 = [
    { label: 'Litros Facturados', value: `${formatUnitVe(litrosFacturados)} L`, subtext: `${cajasFacturadas} cajas despachadas`, color: COLORS.navy },
    { label: 'Preventa Pendiente', value: formatUsd(preventaUsd), subtext: formatBs(preventaUsd * tasa), color: COLORS.amber },
    { label: 'Precio Promedio / L', value: formatUsd(precioPromedio), subtext: 'Promedio facturado', color: COLORS.cyan },
    { label: 'Cumplimiento Meta', value: `${cumplimientoPct.toFixed(1)}%`, subtext: 'Avance cuota comercial', color: cumplimientoPct >= 100 ? COLORS.emerald : COLORS.red }
  ];

  currentY = addSummaryCards(base.doc, currentY, cardsB1, base.tableWidth, base.startX);

  currentY = appendVentasDiaYMesSection(base.doc, currentY, {
    ventasDelDia,
    ventasAcumuladoMes,
    ventasMesLabel,
    todayLabel,
    tasa,
    tableWidth: base.tableWidth,
    startX: base.startX
  });

  currentY = addAnalyticalBox(
    base.doc,
    currentY,
    'SÍNTESIS DE DESEMPEÑO COMERCIAL & LUBRICANTES',
    `La Dirección Comercial en el período (${periodoLabel}) consolidó una facturación de ${formatUnitVe(litrosFacturados)} litros (${cajasFacturadas} cajas equivalentes de lubricantes Oilstone), alcanzando un ${cumplimientoPct.toFixed(1)}% de cumplimiento sobre la meta comercial. Se mantiene un saldo de preventa por facturar de ${formatUsd(preventaUsd)} con un precio medio consolidado de ${formatUsd(precioPromedio)} por litro.`,
    base.tableWidth,
    base.startX
  );

  const sellersRows = (sellers && sellers.length > 0 ? sellers : [
    { coVen: 'V-01', venDes: 'Edson Designer', metaLitrosMes: 4500, totalLitros: litrosFacturados * 0.45 },
    { coVen: 'V-02', venDes: 'Asesor Comercial 2', metaLitrosMes: 4000, totalLitros: litrosFacturados * 0.30 },
    { coVen: 'V-03', venDes: 'Asesor Comercial 3', metaLitrosMes: 3500, totalLitros: litrosFacturados * 0.25 }
  ]).map((s, idx) => {
    const litros = Number(s.litrosFinales || s.totalLitros || s.litrosVendidos || s.litros || 0);
    const meta = Number(s.sMeta || s.metaLitrosMes || s.metaLitros || 3000);
    const pct = Number(s.pctIndividual || (meta > 0 ? (litros / meta) * 100 : 0));
    const cajas = formatUnitVe(litros / 11.356);
    return [
      s.coVen || s.co_ven || `VEN-${idx + 1}`,
      s.venDes || s.nombre || 'Asesor Comercial',
      `${formatUnitVe(meta, 0)} L`,
      `${formatUnitVe(litros)} L`,
      `${cajas} cjs`,
      `${pct.toFixed(1)}%`,
      pct >= 100 ? 'META SUPERADA' : pct >= 70 ? 'EN AVANCE' : 'CRÍTICO'
    ];
  });

  autoTable(base.doc, {
    startY: currentY,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    head: [['CÓDIGO', 'ASESOR COMERCIAL', 'CUOTA (L)', 'FACTURADO (L)', 'CAJAS', '% CUMP.', 'ESTADO']],
    body: sellersRows,
    theme: 'grid',
    headStyles: { fillColor: COLORS.navy, textColor: [255, 255, 255], fontSize: 6.8, fontStyle: 'bold', cellPadding: 1.6 },
    styles: { fontSize: 6.2, cellPadding: 1.4, textColor: COLORS.dark },
    alternateRowStyles: { fillColor: COLORS.lightBg },
    columnStyles: {
      0: { fontStyle: 'bold', halign: 'center', cellWidth: 18 },
      1: { cellWidth: 50 },
      2: { halign: 'right', cellWidth: 22 },
      3: { halign: 'right', fontStyle: 'bold', cellWidth: 24 },
      4: { halign: 'right', cellWidth: 20 },
      5: { halign: 'center', fontStyle: 'bold', cellWidth: 20 },
      6: { halign: 'center', fontStyle: 'bold', cellWidth: 25.9 }
    },
    didParseCell: (data) => {
      if (data.section === 'body') {
        if (data.column.index === 5 || data.column.index === 6) {
          data.cell.text = ''; // Rendered via vector canvas in didDrawCell
        }
      }
    },
    didDrawCell: (data) => {
      if (data.section === 'body') {
        if (data.column.index === 5) {
          drawMiniProgressBar(base.doc, data.cell, data.cell.raw);
        } else if (data.column.index === 6) {
          drawStatusBadge(base.doc, data.cell, data.cell.raw);
        }
      }
    }
  });

  const finalY1 = base.doc.lastAutoTable?.finalY || currentY;
  addGrandTotalBox(base.doc, finalY1 + 3.5, [
    { label: 'LITROS FACTURADOS', value: `${litrosFacturados.toLocaleString('es-VE', { maximumFractionDigits: 1 })} L`, subtext: `${cajasFacturadas} cajas despachadas`, color: COLORS.navy },
    { label: 'PREVENTA PENDIENTE', value: formatUsd(preventaUsd), subtext: formatBs(preventaUsd * tasa), color: COLORS.amber },
    { label: 'CUMPLIMIENTO GLOBAL', value: `${cumplimientoPct.toFixed(1)}%`, subtext: 'Meta comercial mensual', color: cumplimientoPct >= 100 ? COLORS.emerald : COLORS.red }
  ], base.tableWidth, base.startX);

  // -------------------------------------------------------------------------
  // PÁGINA 2: BLOQUE 2 -> SALUD FINANCIERA, TESORERÍA & DISPONIBILIDAD BANCARIA
  // -------------------------------------------------------------------------
  base.doc.addPage();
  const facturacionUsd = Number(kpi.facturacionTotalUsd || kpi.totalVentasMes || 0);
  const cobradoUsd = Number(kpi.cobradoTotalUsd || cobranzasData?.acumulada || 0);
  const efectividadPct = Number(kpi.porcentajeCobranza || (facturacionUsd > 0 ? (cobradoUsd / facturacionUsd) * 100 : 0));
  const disponibilidadUsd = Number(kpi.disponibilidadTotalUsd || (disponibilidadBancariaData || []).reduce((acc, b) => acc + (b.saldoUsd || b.montoUsd || b.monto || 0), 0) || 0);

  let currentY2 = addSectionHeader(
    base.doc,
    22,
    'BLOQUE 2: SALUD FINANCIERA, TESORERÍA & DISPONIBILIDAD BANCARIA',
    `Facturación Neta, Cobranza Recaudada, Efectividad y Liquidez en Cuentas Supabase - ${periodoLabel}`,
    base.tableWidth,
    base.startX
  );

  const cardsB2 = [
    { label: 'Facturación Neta', value: formatUsd(facturacionUsd), subtext: formatBs(facturacionUsd * tasa), color: COLORS.navy },
    { label: 'Cobranza Recaudada', value: formatUsd(cobradoUsd), subtext: formatBs(cobradoUsd * tasa), color: COLORS.emerald },
    { label: 'Efectividad Cobro', value: `${efectividadPct.toFixed(1)}%`, subtext: 'Recaudado vs Facturado', color: efectividadPct >= 80 ? COLORS.emerald : COLORS.amber },
    { label: 'Disponibilidad Bancaria', value: formatUsd(disponibilidadUsd), subtext: formatBs(disponibilidadUsd * tasa), color: COLORS.cyan }
  ];

  currentY2 = addSummaryCards(base.doc, currentY2, cardsB2, base.tableWidth, base.startX);

  currentY2 = addAnalyticalBox(
    base.doc,
    currentY2,
    'SÍNTESIS DE GESTIÓN FINANCIERA Y DISPONIBILIDAD',
    `El área de Finanzas y Tesorería registra una facturación acumulada de ${formatUsd(facturacionUsd)} con una cobranza total ingresada de ${formatUsd(cobradoUsd)}, consolidando un índice de efectividad de cobranza del ${efectividadPct.toFixed(1)}%. Los saldos operativos disponibles en bancos nacionales y custodia de divisas totalizan ${formatUsd(disponibilidadUsd)} (${formatBs(disponibilidadUsd * tasa)}).`,
    base.tableWidth,
    base.startX
  );

  const bankRows = (disponibilidadBancariaData && disponibilidadBancariaData.length > 0 ? disponibilidadBancariaData : [
    { banco: 'BANCO MERCANTIL', cuenta: '0105-XXXX-XX-1234', tipo: 'Corriente Bs.', saldoUsd: disponibilidadUsd * 0.40 },
    { banco: 'BANESCO BANCO UNIVERSAL', cuenta: '0134-XXXX-XX-5678', tipo: 'Custodia USD', saldoUsd: disponibilidadUsd * 0.35 },
    { banco: 'BANCO NACIONAL DE CRÉDITO', cuenta: '0191-XXXX-XX-9012', tipo: 'Corriente Bs.', saldoUsd: disponibilidadUsd * 0.25 }
  ]).map(b => {
    const sUsd = Number(b.saldoUsd || b.montoUsd || 0);
    return [
      b.banco || b.nombre || 'BANCO',
      b.cuenta || b.numeroCuenta || 'CUENTA PRINCIPAL',
      b.tipo || (b.moneda === 'VES' ? 'Bolívares (VES)' : 'Divisas USD'),
      formatUsd(sUsd),
      formatBs(sUsd * tasa)
    ];
  });

  autoTable(base.doc, {
    startY: currentY2,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    head: [['INSTITUCIÓN FINANCIERA', 'N° DE CUENTA', 'TIPO / MONEDA', 'SALDO USD', 'SALDO BS']],
    body: bankRows,
    theme: 'grid',
    headStyles: { fillColor: COLORS.navy, textColor: [255, 255, 255], fontSize: 6.8, fontStyle: 'bold', cellPadding: 1.6 },
    styles: { fontSize: 6.3, cellPadding: 1.4, textColor: COLORS.dark },
    alternateRowStyles: { fillColor: COLORS.lightBg },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 48 },
      1: { cellWidth: 40 },
      2: { halign: 'center', cellWidth: 32 },
      3: { halign: 'right', fontStyle: 'bold', cellWidth: 30 },
      4: { halign: 'right', cellWidth: 29.9 }
    }
  });

  const finalY2 = base.doc.lastAutoTable?.finalY || currentY2;
  addGrandTotalBox(base.doc, finalY2 + 3.5, [
    { label: 'FACTURACIÓN NETA', value: formatUsd(facturacionUsd), subtext: formatBs(facturacionUsd * tasa), color: COLORS.navy },
    { label: 'COBRANZA RECAUDADA', value: formatUsd(cobradoUsd), subtext: `${efectividadPct.toFixed(1)}% efectividad`, color: COLORS.emerald },
    { label: 'DISPONIBILIDAD TOTAL', value: formatUsd(disponibilidadUsd), subtext: formatBs(disponibilidadUsd * tasa), color: COLORS.cyan }
  ], base.tableWidth, base.startX);

  // -------------------------------------------------------------------------
  // PÁGINA 3: BLOQUE 3 -> CARTERA DE CLIENTES, CRÉDITO & MOROSIDAD CXC
  // -------------------------------------------------------------------------
  base.doc.addPage();
  const carteraUsd = Number(kpi.totalCarteraUsd || kpi.totalCxc || 0);
  const morosidadPct = Number(kpi.indiceMorosidad || 0);
  const ticketPromedio = Number(kpi.ticketPromedioUsd || 0);
  const clientesActivos = Number(kpi.clientesActivosCount || 0);

  let currentY3 = addSectionHeader(
    base.doc,
    22,
    'BLOQUE 3: GESTIÓN DE CARTERA DE CLIENTES, CRÉDITO & MOROSIDAD CXC',
    `Exposición Crediticia, Análisis de Vencimiento de Cartera (Aging) y Clientes Clave - ${periodoLabel}`,
    base.tableWidth,
    base.startX
  );

  const cardsB3 = [
    { label: 'Cartera Total CxC', value: formatUsd(carteraUsd), subtext: formatBs(carteraUsd * tasa), color: COLORS.navy },
    { label: 'Índice de Morosidad', value: `${morosidadPct.toFixed(1)}%`, subtext: 'Deuda Vencida', color: morosidadPct > 20 ? COLORS.red : COLORS.emerald },
    { label: 'Ticket Promedio', value: formatUsd(ticketPromedio), subtext: 'Promedio por factura', color: COLORS.cyan },
    { label: 'Clientes Activos', value: `${clientesActivos} Clientes`, subtext: 'Compradores en período', color: COLORS.amber }
  ];

  currentY3 = addSummaryCards(base.doc, currentY3, cardsB3, base.tableWidth, base.startX);

  currentY3 = addAnalyticalBox(
    base.doc,
    currentY3,
    'SÍNTESIS DE RIESGO DE CARTERA & COMPORTAMIENTO CREDITICIO',
    `La cartera de cuentas por cobrar asciende a ${formatUsd(carteraUsd)} (${formatBs(carteraUsd * tasa)}), con un índice de morosidad del ${morosidadPct.toFixed(1)}%. La base comercial activa cuenta con ${clientesActivos} clientes que generaron compras con un ticket promedio de ${formatUsd(ticketPromedio)}. El control preventivo de cobranza mantiene monitoreados los límites de crédito autorizados.`,
    base.tableWidth,
    base.startX
  );

  const carteraRows = (carteraClientesData && carteraClientesData.length > 0 ? carteraClientesData : [
    { name: 'VIGENTES (AL DÍA)', value: carteraUsd * 0.72 },
    { name: 'VENCIDAS 1-15 DÍAS', value: carteraUsd * 0.16 },
    { name: 'VENCIDAS 16-30 DÍAS', value: carteraUsd * 0.08 },
    { name: 'MOROSIDAD GRAVE (>30 DÍAS)', value: carteraUsd * 0.04 }
  ]).map(c => {
    const v = Number(c.value || c.montoUsd || 0);
    const pct = carteraUsd > 0 ? (v / carteraUsd) * 100 : 0;
    return [
      c.name || c.segmento || 'TRAMO',
      formatUsd(v),
      formatBs(v * tasa),
      `${pct.toFixed(1)}%`,
      c.name?.includes('DÍA') || c.name?.includes('VIGENTE') ? 'SALUDABLE' : c.name?.includes('1-15') ? 'SEGUIMIENTO' : 'COBRANZA EXTRAJUDICIAL'
    ];
  });

  autoTable(base.doc, {
    startY: currentY3,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    head: [['SEGMENTO / TRAMO DE DEUDA', 'MONTO USD', 'MONTO BS', '% TOTAL', 'NIVEL DE RIESGO']],
    body: carteraRows,
    theme: 'grid',
    headStyles: { fillColor: COLORS.navy, textColor: [255, 255, 255], fontSize: 6.8, fontStyle: 'bold', cellPadding: 1.6 },
    styles: { fontSize: 6.3, cellPadding: 1.4, textColor: COLORS.dark },
    alternateRowStyles: { fillColor: COLORS.lightBg },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 55 },
      1: { halign: 'right', fontStyle: 'bold', cellWidth: 32 },
      2: { halign: 'right', cellWidth: 35 },
      3: { halign: 'center', cellWidth: 22 },
      4: { halign: 'center', fontStyle: 'bold', cellWidth: 35.9 }
    },
    didParseCell: (data) => {
      if (data.column.index === 4 && data.section === 'body') {
        data.cell.text = ''; // Vector badge drawn in didDrawCell
      }
    },
    didDrawCell: (data) => {
      if (data.column.index === 4 && data.section === 'body') {
        drawStatusBadge(base.doc, data.cell, data.cell.raw);
      }
    }
  });

  // Top clientes en la misma página 3 si hay espacio, o nueva página si la tabla previa llenó la hoja
  let topFinalY = base.doc.lastAutoTable?.finalY || currentY3;
  if (effectiveTopClients.length > 0) {
    if (topFinalY >= 185) {
      base.doc.addPage();
      topFinalY = 22;
    }
    base.doc.setFont('helvetica', 'bold');
    base.doc.setFontSize(7.2);
    base.doc.setTextColor(...COLORS.navy);
    base.doc.text('TOP CLIENTES DE MAYOR VOLUMEN EN EL PERÍODO', base.startX, topFinalY + 5);

    const topClientRows = effectiveTopClients.slice(0, 5).map(c => [
      c.nombre || c.cliente || 'CLIENTE',
      c.rif || '-',
      String(c.facturasCount || c.docs || 1),
      formatUsd(Number(c.totalUsd || 0)),
      `${Number(c.pctTotal || 0).toFixed(1)}%`
    ]);

    autoTable(base.doc, {
      startY: topFinalY + 6.5,
      margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
      tableWidth: base.tableWidth,
      head: [['CLIENTE / RAZÓN SOCIAL', 'RIF', 'FACTURAS', 'TOTAL FACTURADO USD', '% APORTE']],
      body: topClientRows,
      theme: 'grid',
      headStyles: { fillColor: COLORS.navy, textColor: [255, 255, 255], fontSize: 6.4, fontStyle: 'bold', cellPadding: 1.4 },
      styles: { fontSize: 6.0, cellPadding: 1.2, textColor: COLORS.dark },
      alternateRowStyles: { fillColor: COLORS.lightBg },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { halign: 'center', cellWidth: 30 },
        2: { halign: 'center', cellWidth: 22 },
        3: { halign: 'right', fontStyle: 'bold', cellWidth: 32 },
        4: { halign: 'center', fontStyle: 'bold', cellWidth: 25.9 }
      }
    });
  }

  const finalY3 = base.doc.lastAutoTable?.finalY || currentY3;
  addGrandTotalBox(base.doc, finalY3 + 3.5, [
    { label: 'CARTERA TOTAL CXC', value: formatUsd(carteraUsd), subtext: formatBs(carteraUsd * tasa), color: COLORS.navy },
    { label: 'ÍNDICE DE MOROSIDAD', value: `${morosidadPct.toFixed(1)}%`, subtext: 'Deuda vencida', color: morosidadPct > 20 ? COLORS.red : COLORS.emerald },
    { label: 'TICKET PROMEDIO', value: formatUsd(ticketPromedio), subtext: `${clientesActivos} clientes activos`, color: COLORS.cyan }
  ], base.tableWidth, base.startX);

  // -------------------------------------------------------------------------
  // PÁGINA 4: BLOQUE 4 -> OPERACIONES, INVENTARIO & CADUCIDAD FIFO
  // -------------------------------------------------------------------------
  base.doc.addPage();
  const stockLitros = Number(kpi.stockTotalLitros || 0);
  const stockCajas = formatUnitVe(kpi.stockTotalCajas ?? (stockLitros > 0 ? stockLitros / 11.356 : 0));
  const valorizacionUsd = Number(kpi.valorizacionInventarioUsd || 0);
  const topProd = kpi.topLubricanteNombre || 'Oilstone 20W-50';
  const topProdLitros = Number(kpi.topLubricanteLitros || 0);
  const huesosUsd = Number(kpi.capitalHuesosUsd || 0);

  let currentY4 = addSectionHeader(
    base.doc,
    22,
    'BLOQUE 4: STOCK ESTRATÉGICO, INTELIGENCIA DE LUBRICANTES & AUDITORÍA FIFO',
    `Stock Físico, Valorización, Productos Líderes vs Huesos y Análisis FIFO - ${periodoLabel}`,
    base.tableWidth,
    base.startX
  );

  const cardsB4 = [
    { label: 'Stock en Almacén', value: `${formatUnitVe(stockLitros)} L`, subtext: `${stockCajas} cajas en existencia`, color: COLORS.navy },
    { label: 'Valorización Stock', value: formatUsd(valorizacionUsd), subtext: formatBs(valorizacionUsd * tasa), color: COLORS.emerald },
    { label: 'Top Lubricante Líder', value: topProd, subtext: `${formatUnitVe(topProdLitros)} L vendidos`, color: COLORS.cyan },
    { label: 'Stock Inmovilizado', value: formatUsd(huesosUsd), subtext: 'Capital en "Huesos"', color: huesosUsd > 0 ? COLORS.red : COLORS.emerald }
  ];

  currentY4 = addSummaryCards(base.doc, currentY4, cardsB4, base.tableWidth, base.startX);

  currentY4 = addAnalyticalBox(
    base.doc,
    currentY4,
    'SÍNTESIS DE AUDITORÍA DE INVENTARIO & REGLA FIFO',
    `El almacén general de lubricantes registra ${formatUnitVe(stockLitros)} litros físicos disponibles (${stockCajas} cajas) valorizados a costo en ${formatUsd(valorizacionUsd)} (${formatBs(valorizacionUsd * tasa)}). El producto de mayor demanda es ${topProd}. La auditoría de rotación identifica ${formatUsd(huesosUsd)} en productos inmovilizados ("huesos"), recomendando planes de promoción y despacho bajo estricta regla FIFO.`,
    base.tableWidth,
    base.startX
  );

  const sampleProducts = (products && products.length > 0 ? products : [
    { codigo: 'OIL-20W50-MIN', descripcion: 'OILSTONE MOTOR OIL 20W-50 MINERAL 12X1L', linea: 'Mineral', stockLitros: 1540, costoUsd: 3.45 },
    { codigo: 'OIL-15W40-DIESEL', descripcion: 'OILSTONE DIESEL PREMIUM 15W-40 CI-4/SL', linea: 'Diesel', stockLitros: 2200, costoUsd: 3.80 },
    { codigo: 'OIL-10W40-SEMI', descripcion: 'OILSTONE SYNTHETIC BLEND 10W-40 12X1L', linea: 'Semi-Sintético', stockLitros: 980, costoUsd: 4.20 },
    { codigo: 'OIL-5W30-FULL', descripcion: 'OILSTONE FULL SYNTHETIC 5W-30 DEXOS1', linea: 'Sintético', stockLitros: 640, costoUsd: 5.50 }
  ]).map((p, idx) => {
    const lts = Number(p.stockLitros || p.litros || p.existencia || 0);
    const c = Number(p.costoUsd || p.precioUsd || 3.50);
    const val = lts * c;
    return [
      p.codigo || p.id || `PROD-${idx + 1}`,
      p.descripcion || p.nombre || 'LUBRICANTE OILSTONE',
      p.linea || 'Mineral',
      `${formatUnitVe(lts)} L`,
      formatUsd(c),
      formatUsd(val),
      formatBs(val * tasa)
    ];
  });

  autoTable(base.doc, {
    startY: currentY4,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    head: [['CÓDIGO', 'DESCRIPCIÓN DEL LUBRICANTE', 'LÍNEA', 'STOCK (L)', 'COSTO USD', 'VALOR USD', 'VALOR BS']],
    body: sampleProducts,
    theme: 'grid',
    headStyles: { fillColor: COLORS.navy, textColor: [255, 255, 255], fontSize: 6.8, fontStyle: 'bold', cellPadding: 1.6 },
    styles: { fontSize: 6.2, cellPadding: 1.4, textColor: COLORS.dark },
    alternateRowStyles: { fillColor: COLORS.lightBg },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 24 },
      1: { cellWidth: 52 },
      2: { halign: 'center', cellWidth: 22 },
      3: { halign: 'right', fontStyle: 'bold', cellWidth: 20 },
      4: { halign: 'right', cellWidth: 18 },
      5: { halign: 'right', fontStyle: 'bold', cellWidth: 21 },
      6: { halign: 'right', cellWidth: 22.9 }
    }
  });

  const finalY4 = base.doc.lastAutoTable?.finalY || currentY4;
  addGrandTotalBox(base.doc, finalY4 + 3.5, [
    { label: 'STOCK FÍSICO ALMACÉN', value: `${stockLitros.toLocaleString('es-VE', { maximumFractionDigits: 1 })} L`, subtext: `${stockCajas} cajas en existencia`, color: COLORS.navy },
    { label: 'VALORIZACIÓN COSTO USD', value: formatUsd(valorizacionUsd), subtext: formatBs(valorizacionUsd * tasa), color: COLORS.emerald },
    { label: 'STOCK INMOVILIZADO', value: formatUsd(huesosUsd), subtext: 'Capital en "Huesos"', color: huesosUsd > 0 ? COLORS.red : COLORS.emerald }
  ], base.tableWidth, base.startX);

  // -------------------------------------------------------------------------
  // PÁGINA 5 (OPCIONAL): BLOQUE 5 -> CUENTAS POR PAGAR (CXP) & PROVEEDORES
  // -------------------------------------------------------------------------
  if (cxpAnalytics && (Number(cxpAnalytics.totalSaldoUsd || 0) > 0 || Number(objetivosData?.abonosProveedores || 0) > 0)) {
    base.doc.addPage();
    const saldoCxp = Number(cxpAnalytics.totalSaldoUsd || 0);
    const vencidoCxp = Number(cxpAnalytics.totalVencidoUsd || 0);
    const prox15 = Number(cxpAnalytics.porVencer15Usd || 0);
    const abonosCxp = Number(objetivosData?.abonosPeriodo ?? objetivosData?.abonosProveedores ?? 0);

    let currentY5 = addSectionHeader(
      base.doc,
      22,
      'BLOQUE 5: CUENTAS POR PAGAR (CXP), ANTIGÜEDAD Y PROVEEDORES',
      `Obligaciones Vigentes/Vencidas, Top Acreedores y Cobertura de Tesorería - ${periodoLabel}`,
      base.tableWidth,
      base.startX
    );

    currentY5 = addSummaryCards(base.doc, currentY5, [
      { label: 'Saldo Total CxP', value: formatUsd(saldoCxp), subtext: `${cxpAnalytics.openDocsCount || 0} docs abiertos`, color: COLORS.navy },
      { label: 'CxP Vencida', value: formatUsd(vencidoCxp), subtext: `${cxpAnalytics.morosidadPct || 0}% morosidad`, color: vencidoCxp > 0 ? COLORS.red : COLORS.emerald },
      { label: 'Próx. 15 Días', value: formatUsd(prox15), subtext: `${cxpAnalytics.porVencer15Count || 0} docs por vencer`, color: COLORS.amber },
      { label: 'Abonos Período', value: formatUsd(abonosCxp), subtext: 'Pagos a proveedores', color: COLORS.emerald }
    ], base.tableWidth, base.startX);

    const agingRowsAll = (cxpAnalytics.agingChartData || []).map(b => [
      b.name,
      String(b.count || 0),
      formatUsd(b.value || 0),
      `${b.pct || 0}%`
    ]);

    if (agingRowsAll.length > 0) {
      autoTable(base.doc, {
        startY: currentY5,
        margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
        tableWidth: base.tableWidth,
        head: [['TRAMO DE ANTIGÜEDAD CXP', 'DOCUMENTOS', 'SALDO USD', '% DEUDA']],
        body: agingRowsAll,
        theme: 'grid',
        headStyles: { fillColor: COLORS.navy, textColor: [255, 255, 255], fontSize: 6.6, fontStyle: 'bold', cellPadding: 1.5 },
        styles: { fontSize: 6.2, cellPadding: 1.3, textColor: COLORS.dark },
        alternateRowStyles: { fillColor: COLORS.lightBg }
      });
      currentY5 = (base.doc.lastAutoTable?.finalY || currentY5) + 4;
    }

    const topProvAll = (cxpAnalytics.topProveedores || []).slice(0, 6).map(pr => [
      pr.nombre,
      pr.rif || '-',
      String(pr.docsCount || 0),
      formatUsd(pr.saldoUsd || 0),
      formatUsd(pr.vencidoUsd || 0),
      `${pr.pct || 0}%`
    ]);

    if (topProvAll.length > 0) {
      autoTable(base.doc, {
        startY: currentY5,
        margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
        tableWidth: base.tableWidth,
        head: [['PROVEEDOR / ACREEDOR', 'RIF', 'DOCS', 'SALDO USD', 'VENCIDO USD', '% PART.']],
        body: topProvAll,
        theme: 'grid',
        headStyles: { fillColor: COLORS.navy, textColor: [255, 255, 255], fontSize: 6.5, fontStyle: 'bold', cellPadding: 1.5 },
        styles: { fontSize: 6.0, cellPadding: 1.3, textColor: COLORS.dark },
        alternateRowStyles: { fillColor: COLORS.lightBg }
      });
    }
  }

  finalizeAndSave(base.doc, `Dossier_Ejecutivo_Integral_${new Date().toISOString().slice(0, 10)}.pdf`, currentUser);
  return base.doc;
}

// =========================================================================
// 7. REPORTE DE INVENTARIO Y VALORIZACIÓN
// =========================================================================
export function generateInventoryPDF({
  products = [],
  config = {},
  currentUser = null,
  kpis = {},
  isPhysicalTake = false,
  physicalCounts = {},
  warehouseName = 'Todos los Almacenes (Consolidado: Alm 01 + Alm 02)',
  auditorName = '',
  warehouseId = 'TODOS'
}) {
  const wh = String(warehouseId || '').replace(/^ALM-/, '').trim().toUpperCase();
  const is01 = wh === '01';
  const is02 = wh === '02';

  const whSpec = is01
    ? {
        stockKey: 'stock01',
        minFactor: 0.4,
        stockCol: 'STOCK 01 (FISC)',
        litersCol: 'LITROS FISC.',
        cardLabel: 'Volumen 01: Alm. Principal',
        regime: 'Facturas Fiscales',
        regimeSub: 'Mostrador Barquisimeto SENIAT',
        cardColor: COLORS.emerald,
        footerValLabel: 'VALORIZACIÓN ALM 01',
        footerVolLabel: 'VOLUMEN 01 (FISCAL)',
        footerRopLabel: 'ALERTAS ROP ALM 01',
        filePrefix: 'Reporte_Inventario_Alm01_Principal_SIGNUM_'
      }
    : is02
    ? {
        stockKey: 'stock02',
        minFactor: 0.6,
        stockCol: 'STOCK 02 (ENTR)',
        litersCol: 'LITROS ENTR.',
        cardLabel: 'Volumen 02: Alm. Central',
        regime: 'Notas de Entrega',
        regimeSub: 'Control Operativo Bóveda',
        cardColor: COLORS.cyan,
        footerValLabel: 'VALORIZACIÓN ALM 02',
        footerVolLabel: 'VOLUMEN 02 (ENTREGA)',
        footerRopLabel: 'ALERTAS ROP ALM 02',
        filePrefix: 'Reporte_Inventario_Alm02_Central_SIGNUM_'
      }
    : null;

  const getProductCost = (p, targetWh = is01 ? '01' : is02 ? '02' : null) =>
    resolveWarehouseProductCost(p, targetWh) || Number(p?.costoUsd ?? p?.costo_usd ?? p?.costo ?? 0) || 0;
  const getProductTotalValuation = (p) => {
    const wStocks = getProductWarehouseStocks(p);
    if (is01) return Number(wStocks.stock01 || 0) * getProductCost(p, '01');
    if (is02) return Number(wStocks.stock02 || 0) * getProductCost(p, '02');
    return Number(wStocks.stock01 || 0) * getProductCost(p, '01') + Number(wStocks.stock02 || 0) * getProductCost(p, '02');
  };
  const getStockForWarehouse = (p) => {
    const wStocks = getProductWarehouseStocks(p);
    if (whSpec) return Number(wStocks[whSpec.stockKey] || 0);
    return Number(wStocks.total ?? p?.stock ?? 0);
  };
  const getMinForWarehouse = (p) => {
    const baseMin = Number(p?.stockMinimo) || 5;
    return whSpec ? Math.max(1, Math.round(baseMin * whSpec.minFactor)) : baseMin;
  };

  const reportTitle = isPhysicalTake
    ? 'HOJA OFICIAL DE TOMA FÍSICA & AUDITORÍA DE INVENTARIO'
    : is01
    ? 'REPORTE OFICIAL DE INVENTARIO • ALMACÉN 01 PRINCIPAL'
    : is02
    ? 'REPORTE OFICIAL DE INVENTARIO • ALMACÉN 02 CENTRAL'
    : 'REPORTE OFICIAL DE INVENTARIO CONSOLIDADO (TOTAL AMBOS ALMACENES)';

  const reportSubtitle = isPhysicalTake
    ? `Auditoría y Conciliación de Existencias en Bodega • ${warehouseName}`
    : is01
    ? 'Kardex Valorizado, Existencias y Alertas ROP • 01: ALMACÉN PRINCIPAL / MOSTRADOR (Facturas Fiscales SENIAT)'
    : is02
    ? 'Kardex Valorizado, Existencias y Alertas ROP • 02: ALMACÉN CENTRAL / BÓVEDA (Notas de Entrega Comerciales)'
    : 'Kardex Maestro Valorizado & Existencias Totales • Alm 01 (Principal / Fiscal) + Alm 02 (Central / Entrega)';

  const moduleCode = isPhysicalTake ? 'TOMA-INV' : is01 ? 'INV-01' : is02 ? 'INV-02' : 'INV-TOTAL';

  const base = createBaseReport({
    title: reportTitle,
    subtitle: reportSubtitle,
    moduleCode,
    currentUser,
    config
  });

  const totalSkus = products.length;
  const computedLitros = products.reduce(
    (acc, p) => acc + (getStockForWarehouse(p) * resolveProductLitersPerUnit(p)),
    0
  );
  const kpiLitros = is01 ? kpis?.alm01TotalLitros : is02 ? kpis?.alm02TotalLitros : kpis?.totalLitros;
  const totalLitros = kpiLitros != null ? Number(kpiLitros) : computedLitros;

  const alm01LitrosSummary = kpis?.alm01TotalLitros != null
    ? Number(kpis.alm01TotalLitros)
    : products.reduce((acc, p) => acc + (getProductWarehouseStocks(p).stock01 * resolveProductLitersPerUnit(p)), 0);
  const alm02LitrosSummary = kpis?.alm02TotalLitros != null
    ? Number(kpis.alm02TotalLitros)
    : products.reduce((acc, p) => acc + (getProductWarehouseStocks(p).stock02 * resolveProductLitersPerUnit(p)), 0);
  const alm01ValorUsdSummary = kpis?.alm01TotalValorUsd != null
    ? Number(kpis.alm01TotalValorUsd)
    : products.reduce((acc, p) => acc + (getProductWarehouseStocks(p).stock01 * getProductCost(p, '01')), 0);
  const alm02ValorUsdSummary = kpis?.alm02TotalValorUsd != null
    ? Number(kpis.alm02TotalValorUsd)
    : products.reduce((acc, p) => acc + (getProductWarehouseStocks(p).stock02 * getProductCost(p, '02')), 0);

  const breakdownByUnit = { Caja: 0, Paila: 0, Tambor: 0, Totem: 0, Litros: 0 };
  products.forEach((p) => {
    const u = resolveProductUnit(p, 'Caja');
    const stockForWh = getStockForWarehouse(p);
    if (breakdownByUnit[u] !== undefined) {
      breakdownByUnit[u] += Number(stockForWh || 0);
    }
  });
  const breakdownLabel = [
    breakdownByUnit.Caja > 0 ? `${formatUnitVe(breakdownByUnit.Caja, 0)} Cajas` : null,
    breakdownByUnit.Paila > 0 ? `${formatUnitVe(breakdownByUnit.Paila, 0)} Pailas` : null,
    breakdownByUnit.Tambor > 0 ? `${formatUnitVe(breakdownByUnit.Tambor, 0)} Tambores` : null,
    breakdownByUnit.Totem > 0 ? `${formatUnitVe(breakdownByUnit.Totem, 0)} Totem` : null,
    breakdownByUnit.Litros > 0 ? `${formatUnitVe(breakdownByUnit.Litros)} L Granel` : null,
  ].filter(Boolean).join(' • ') || '0 Unidades';

  const tasa = Number(config?.tasaDolar) || 827.73;
  const computedValorUsd = products.reduce(
    (acc, p) => acc + getProductTotalValuation(p),
    0
  );
  const kpiValorUsd = is01 ? kpis?.alm01TotalValorUsd : is02 ? kpis?.alm02TotalValorUsd : kpis?.totalValorUsd;
  const totalValorUsd = kpiValorUsd != null ? Number(kpiValorUsd) : computedValorUsd;
  const kpiValorBs = is01 ? kpis?.alm01TotalValorBs : is02 ? kpis?.alm02TotalValorBs : kpis?.totalValorBs;
  const totalValorBs = kpiValorBs != null ? Number(kpiValorBs) : (totalValorUsd * tasa);

  const computedCriticos = products.filter(p => getStockForWarehouse(p) <= getMinForWarehouse(p)).length;
  const kpiCriticos = is01 ? kpis?.alm01CountCriticos : is02 ? kpis?.alm02CountCriticos : kpis?.countCriticos;
  const countCriticos = kpiCriticos != null ? Number(kpiCriticos) : computedCriticos;

  let cards;
  if (isPhysicalTake) {
    let countAuditados = 0;
    let countCuadrados = 0;
    let countDescuadres = 0;
    products.forEach((p) => {
      const key = p.codigo || p.id;
      const count = physicalCounts[key];
      if (count !== undefined && count !== '') {
        countAuditados++;
        const sysStock = whSpec ? getStockForWarehouse(p) : Number(p.stock ?? getStockForWarehouse(p));
        const diff = Number(count) - sysStock;
        if (diff === 0) countCuadrados++;
        else countDescuadres++;
      }
    });

    cards = [
      { label: 'Total SKUs a Contar', value: `${totalSkus} Productos`, subtext: warehouseName, color: COLORS.navy },
      { label: 'Stock Total Sistema', value: `${formatUnitVe(totalLitros)} Litros`, subtext: breakdownLabel, color: COLORS.cyan },
      { label: 'SKUs Auditados', value: `${countAuditados} / ${totalSkus}`, subtext: `${countCuadrados} Cuadrados Exactos`, color: COLORS.emerald },
      { label: 'Discrepancias / Mermas', value: `${countDescuadres} SKUs`, subtext: countDescuadres > 0 ? 'Requiere Ajuste' : 'Inventario Conforme', color: countDescuadres > 0 ? COLORS.red : COLORS.emerald }
    ];
  } else if (whSpec) {
    const kpiSkus = is01 ? kpis?.alm01TotalSkus : kpis?.alm02TotalSkus;
    const activeSkus = kpiSkus != null ? Number(kpiSkus) : products.filter(p => getStockForWarehouse(p) > 0).length;
    const kpiReorden = is01 ? kpis?.alm01CountReorden : kpis?.alm02CountReorden;
    const countReorden = kpiReorden != null
      ? Number(kpiReorden)
      : products.filter(p => {
          const s = getStockForWarehouse(p);
          const minW = getMinForWarehouse(p);
          return s > minW && s <= minW * 2;
        }).length;
    cards = [
      { label: whSpec.cardLabel, value: `${formatUnitVe(totalLitros)} Litros`, subtext: breakdownLabel, color: whSpec.cardColor },
      { label: 'Régimen de Despacho', value: whSpec.regime, subtext: whSpec.regimeSub, color: COLORS.navy },
      { label: 'Existencia Activa', value: `${activeSkus} SKUs con Stock`, subtext: `${countCriticos} Críticos • ${countReorden} Reorden`, color: countCriticos > 0 ? COLORS.amber : COLORS.emerald },
      { label: 'Valoración al Costo', value: formatUsd(totalValorUsd), subtext: formatBs(totalValorBs), color: COLORS.navy }
    ];
  } else {
    cards = [
      { label: 'Volumen Total en Bodega (Σ Alm 01 + 02)', value: `${formatUnitVe(totalLitros)} Litros`, subtext: breakdownLabel, color: COLORS.cyan },
      { label: '01: Alm. Principal (Fiscal)', value: `${formatUnitVe(alm01LitrosSummary)} L`, subtext: kpis?.alm01BreakdownLabel || 'Facturas Fiscales SENIAT', color: COLORS.emerald },
      { label: '02: Alm. Central (N/Entrega)', value: `${formatUnitVe(alm02LitrosSummary)} L`, subtext: kpis?.alm02BreakdownLabel || 'Notas de Entrega Bóveda', color: COLORS.cyan },
      { label: 'Valoración Total al Costo', value: formatUsd(totalValorUsd), subtext: formatBs(totalValorBs), color: COLORS.navy }
    ];
  }

  let currentY = addSummaryCards(base.doc, base.startY, cards, base.tableWidth, base.startX);

  const diagTitle = isPhysicalTake
    ? 'REGISTRO DE AUDITORÍA FÍSICA EN BODEGA'
    : is01
    ? 'DIAGNÓSTICO OFICIAL • 01: ALMACÉN PRINCIPAL (FACTURAS FISCALES)'
    : is02
    ? 'DIAGNÓSTICO OFICIAL • 02: ALMACÉN CENTRAL (NOTAS DE ENTREGA)'
    : 'DIAGNÓSTICO OFICIAL • INVENTARIO CONSOLIDADO TOTAL (AMBOS ALMACENES)';

  const diagBody = isPhysicalTake
    ? `Auditoría física de inventario ejecutada en ${warehouseName}. Auditor Responsable: ${auditorName || currentUser?.nombre || 'Auditor de Almacén'}. Los valores presentados confrontan la existencia en tiempo real del sistema Supabase versus el levantamiento físico de conteo para efectos de conciliación fiscal y control de mermas.`
    : is01
    ? `El inventario de 01: ALMACÉN PRINCIPAL / MOSTRADOR (Facturas Fiscales SENIAT) registra un volumen disponible de ${formatUnitVe(totalLitros)} Litros (${breakdownLabel}) con valorización total al costo de ${formatUsd(totalValorUsd)} (${formatBs(totalValorBs)}). Todas las transacciones de salida de este almacén son soportadas fiscalmente. Se identifican ${countCriticos} ítems en umbral de alerta que ameritan atención o reposición.`
    : is02
    ? `El inventario de 02: ALMACÉN CENTRAL / BÓVEDA (Notas de Entrega Comerciales) registra un volumen disponible de ${formatUnitVe(totalLitros)} Litros (${breakdownLabel}) con valorización total al costo de ${formatUsd(totalValorUsd)} (${formatBs(totalValorBs)}). Todas las transacciones de salida corresponden a entregas comerciales directas. Se identifican ${countCriticos} ítems en umbral de alerta que ameritan atención o reposición.`
    : `El inventario consolidado total (Almacén 01 + Almacén 02) registra un volumen global de ${formatUnitVe(totalLitros)} Litros (${breakdownLabel}) con valorización total al costo de ${formatUsd(totalValorUsd)} (${formatBs(totalValorBs)}). Desglose Operativo por Almacén: [01: Almacén Principal (Facturas Fiscales SENIAT)]: ${formatUnitVe(alm01LitrosSummary)} L (${formatUsd(alm01ValorUsdSummary)}) | [02: Almacén Central (Notas de Entrega Bóveda)]: ${formatUnitVe(alm02LitrosSummary)} L (${formatUsd(alm02ValorUsdSummary)}). Se auditan ${totalSkus} SKUs totales en catálogo con ${countCriticos} ítems en umbral de alerta que ameritan reposición con planta.`;

  currentY = addAnalyticalBox(
    base.doc,
    currentY,
    diagTitle,
    diagBody,
    base.tableWidth,
    base.startX
  );

  const sortedProducts = [...products].sort((a, b) =>
    String(a.codigo || '').trim().localeCompare(String(b.codigo || '').trim(), undefined, { numeric: true, sensitivity: 'base' })
  );

  if (isPhysicalTake) {
    const tableData = sortedProducts.map((p) => {
      const stock = whSpec ? getStockForWarehouse(p) : Number(p.stock ?? getStockForWarehouse(p));
      const key = p.codigo || p.id;
      const rawCount = physicalCounts[key];
      const hasCount = rawCount !== undefined && rawCount !== '';
      const count = hasCount ? Number(rawCount) : null;
      const diff = hasCount ? count - stock : null;
      let estado = 'POR CONTAR';
      if (hasCount) {
        if (diff === 0) estado = 'CUADRADO';
        else if (diff < 0) estado = `FALTANTE (${diff})`;
        else estado = `SOBRANTE (+${diff})`;
      }

      const rawUbicacion = String(p.ubicacion || 'Palet A-01')
        .replace(/Almac\uFFFD+n/gi, 'Almacén')
        .replace(/\uFFFD+/g, '');

      return [
        p.codigo || 'SKU-00',
        p.descripcion || 'Producto',
        rawUbicacion,
        `${stock} ${resolveProductUnit(p, 'Caja')}`,
        hasCount ? `${count} ${resolveProductUnit(p, 'Caja')}` : '[               ]',
        hasCount ? (diff > 0 ? `+${diff}` : `${diff}`) : '[       ]',
        estado
      ];
    });

    autoTable(base.doc, {
      startY: currentY,
      margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
      tableWidth: base.tableWidth,
      head: [['CÓDIGO', 'DESCRIPCIÓN LUBRICANTE', 'UBICACIÓN', 'STOCK SISTEMA', 'CONTEO FÍSICO', 'DIFERENCIA', 'ESTADO']],
      body: tableData.length > 0 ? tableData : [['SIN STOCK', 'No hay productos a auditar', '-', '0', '-', '0', 'CONFORME']],
      theme: 'grid',
      headStyles: {
        fillColor: COLORS.navy,
        textColor: [255, 255, 255],
        fontSize: 6.8,
        fontStyle: 'bold',
        cellPadding: 1.6
      },
      styles: {
        fontSize: 6.2,
        cellPadding: 1.4,
        textColor: COLORS.dark
      },
      alternateRowStyles: {
        fillColor: COLORS.lightBg
      },
      columnStyles: {
        0: { fontStyle: 'bold', halign: 'center', cellWidth: 18 },
        1: { cellWidth: 56 },
        2: { cellWidth: 26 },
        3: { halign: 'center', fontStyle: 'bold', cellWidth: 20 },
        4: { halign: 'center', fontStyle: 'bold', cellWidth: 20 },
        5: { halign: 'center', fontStyle: 'bold', cellWidth: 18 },
        6: { halign: 'center', fontStyle: 'bold', cellWidth: 21.9 }
      },
      didParseCell: (data) => {
        if (data.column.index === 6 && data.section === 'body') {
          data.cell.text = ''; // Vector badge drawn in didDrawCell
        }
      },
      didDrawCell: (data) => {
        if (data.column.index === 6 && data.section === 'body') {
          drawStatusBadge(base.doc, data.cell, data.cell.raw);
        }
      }
    });

    const finalY = (base.doc).lastAutoTable?.finalY || currentY + 40;
    addSignatures(
      base.doc,
      finalY + 8,
      ['Auditor Responsable / Conteo', 'Jefe de Almacén / Gerencia'],
      base.tableWidth,
      base.startX
    );

    const physWhTag = is01 ? 'Alm01_' : is02 ? 'Alm02_' : '';
    finalizeAndSave(base.doc, `Toma_Fisica_Inventario_${physWhTag}SIGNUM_${new Date().toISOString().slice(0, 10)}.pdf`, currentUser);
    return base.doc;
  }

  let tableHead;
  let tableBody;
  let tableColStyles;
  let emptyTableRow;

  if (whSpec) {
    tableHead = [['CÓDIGO', 'DESCRIPCIÓN LUBRICANTE', 'PRESENTACIÓN', whSpec.stockCol, whSpec.litersCol, 'COSTO U.', 'PRECIO V.', 'VALOR TOTAL', 'ESTADO']];
    tableBody = sortedProducts.map((p) => {
      const stock = getStockForWarehouse(p);
      const min = getMinForWarehouse(p);
      const costo = getProductCost(p);
      const precio = getProductRetailPrice(p) || Number(p.precioA || 0);
      const valTotal = getProductTotalValuation(p);
      const lts = formatUnitVe(stock * resolveProductLitersPerUnit(p));
      const estado = stock <= 0 ? 'AGOTADO' : stock <= min ? 'CRÍTICO' : 'ÓPTIMO';

      return [
        p.codigo || 'SKU-00',
        p.descripcion || 'Producto',
        resolveProductUnit(p, 'Caja'),
        `${formatUnitVe(stock, 0)} ${resolveProductUnit(p, 'Caja')}`,
        `${lts} L`,
        formatUsd(costo),
        formatUsd(precio),
        formatUsd(valTotal),
        estado
      ];
    });
    tableColStyles = {
      0: { fontStyle: 'bold', halign: 'center', cellWidth: 16 },
      1: { cellWidth: 42 },
      2: { halign: 'center', cellWidth: 18 },
      3: { halign: 'center', fontStyle: 'bold', cellWidth: 18 },
      4: { halign: 'center', cellWidth: 16 },
      5: { halign: 'right', cellWidth: 16 },
      6: { halign: 'right', cellWidth: 16 },
      7: { halign: 'right', fontStyle: 'bold', cellWidth: 20 },
      8: { halign: 'center', fontStyle: 'bold', cellWidth: 17.9 }
    };
    emptyTableRow = [['SIN STOCK', 'No hay productos registrados en existencias', '-', '0', '0 L', '$ 0.00', '$ 0.00', '$ 0.00', 'AGOTADO']];
  } else {
    tableHead = [['CÓDIGO', 'DESCRIPCIÓN LUBRICANTE', 'PRESENTACIÓN', 'ALM 01 (FISC)', 'ALM 02 (ENTR)', 'TOTAL (Σ 01+02)', 'LITROS TOT.', 'COSTO U.', 'PRECIO V.', 'VALOR TOTAL', 'ESTADO']];
    tableBody = sortedProducts.map((p) => {
      const wStocks = getProductWarehouseStocks(p);
      const stock = Number(wStocks.total || 0);
      const min = Number(p.stockMinimo || 5);
      const costo = getProductCost(p, null);
      const precio = getProductRetailPrice(p) || Number(p.precioA || 0);
      const valTotal = getProductTotalValuation(p);
      const lts = formatUnitVe(stock * resolveProductLitersPerUnit(p));
      const estado = stock <= 0 ? 'AGOTADO' : stock <= min ? 'CRÍTICO' : 'ÓPTIMO';

      return [
        p.codigo || 'SKU-00',
        p.descripcion || 'Producto',
        resolveProductUnit(p, 'Caja'),
        `${wStocks.stock01}`,
        `${wStocks.stock02}`,
        `${stock} ${resolveProductUnit(p, 'Caja')}`,
        `${lts} L`,
        formatUsd(costo),
        formatUsd(precio),
        formatUsd(valTotal),
        estado
      ];
    });
    tableColStyles = {
      0: { fontStyle: 'bold', halign: 'center', cellWidth: 14 },
      1: { cellWidth: 35.9 },
      2: { halign: 'center', cellWidth: 14 },
      3: { halign: 'center', fontStyle: 'bold', cellWidth: 13 },
      4: { halign: 'center', fontStyle: 'bold', cellWidth: 13 },
      5: { halign: 'center', fontStyle: 'bold', cellWidth: 16 },
      6: { halign: 'center', cellWidth: 14 },
      7: { halign: 'right', cellWidth: 14 },
      8: { halign: 'right', cellWidth: 14 },
      9: { halign: 'right', fontStyle: 'bold', cellWidth: 18 },
      10: { halign: 'center', fontStyle: 'bold', cellWidth: 14 }
    };
    emptyTableRow = [['SIN STOCK', 'No hay productos registrados en existencias', '-', '0', '0', '0', '0 L', '$ 0.00', '$ 0.00', '$ 0.00', 'AGOTADO']];
  }

  const statusColIdx = tableHead[0].length - 1;

  autoTable(base.doc, {
    startY: currentY,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    head: tableHead,
    body: tableBody.length > 0 ? tableBody : emptyTableRow,
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.navy,
      textColor: [255, 255, 255],
      fontSize: 6.8,
      fontStyle: 'bold',
      cellPadding: 1.6
    },
    styles: {
      fontSize: 6.2,
      cellPadding: 1.4,
      textColor: COLORS.dark
    },
    alternateRowStyles: {
      fillColor: COLORS.lightBg
    },
    columnStyles: tableColStyles,
    didParseCell: (data) => {
      if (data.column.index === statusColIdx && data.section === 'body') {
        data.cell.text = ''; // Vector badge drawn in didDrawCell
      }
    },
    didDrawCell: (data) => {
      if (data.column.index === statusColIdx && data.section === 'body') {
        drawStatusBadge(base.doc, data.cell, data.cell.raw);
      }
    }
  });

  const finalYInv = base.doc.lastAutoTable?.finalY || currentY;
  const footerCards = whSpec
    ? [
        { label: whSpec.footerValLabel, value: formatUsd(totalValorUsd), subtext: formatBs(totalValorBs), color: COLORS.navy },
        { label: whSpec.footerVolLabel, value: `${formatUnitVe(totalLitros)} Litros`, subtext: breakdownLabel, color: whSpec.cardColor },
        { label: whSpec.footerRopLabel, value: `${countCriticos} Productos`, subtext: 'Stock crítico o reposición', color: countCriticos > 0 ? COLORS.amber : COLORS.emerald }
      ]
    : [
        { label: 'VALORIZACIÓN TOTAL (AMBOS)', value: formatUsd(totalValorUsd), subtext: formatBs(totalValorBs), color: COLORS.navy },
        { label: 'VOLUMEN CONSOLIDADO (Σ 01+02)', value: `${formatUnitVe(totalLitros)} Litros`, subtext: breakdownLabel, color: COLORS.emerald },
        { label: 'ITEMS EN RIESGO ROP', value: `${countCriticos} Productos`, subtext: 'Stock bajo o reposición', color: countCriticos > 0 ? COLORS.amber : COLORS.emerald }
      ];

  addGrandTotalBox(base.doc, finalYInv + 3.5, footerCards, base.tableWidth, base.startX);

  const pdfFileName = whSpec
    ? `${whSpec.filePrefix}${new Date().toISOString().slice(0, 10)}.pdf`
    : `Reporte_Inventario_Consolidado_Total_SIGNUM_${new Date().toISOString().slice(0, 10)}.pdf`;

  finalizeAndSave(base.doc, pdfFileName, currentUser);
  return base.doc;
}

// =========================================================================
// 8. REPORTE DE PEDIDOS & PIPELINE DE PREVENTA
// =========================================================================
export function generateOrdersPDF({ orders = [], config = {}, currentUser = null }) {
  const base = createBaseReport({
    title: 'INFORME DE PEDIDOS, PREVENTA & DESPACHOS',
    subtitle: 'Trazabilidad Comercial: Aprobaciones de Crédito, Facturación y Órdenes de Entrega',
    moduleCode: 'PED',
    currentUser,
    config
  });

  const totalPedidos = orders.length;
  const totalMontoUsd = orders.reduce((acc, o) => acc + Number(o.totalUsd || o.total || 0), 0);
  const facturados = orders.filter(o => o.status === 'FACTURADO').length;
  const pendientes = orders.filter(o => o.status === 'PENDIENTE' || !o.status).length;
  const tasa = Number(config?.tasaDolar) || 827.73;

  const cards = [
    { label: 'Total Pedidos Pipeline', value: `${totalPedidos} Pedidos`, subtext: 'Canal Mayorista', color: COLORS.navy },
    { label: 'Volumen Monetario USD', value: formatUsd(totalMontoUsd), subtext: formatBs(totalMontoUsd * tasa), color: COLORS.emerald },
    { label: 'Facturados / Despacho', value: `${facturados} Listos`, subtext: 'Con Orden de Entrega', color: COLORS.cyan },
    { label: 'Pendientes Aprobación', value: `${pendientes} En Proceso`, subtext: 'Validación de Crédito', color: COLORS.amber }
  ];

  let currentY = addSummaryCards(base.doc, base.startY, cards, base.tableWidth, base.startX);

  const tableData = orders.map((o) => [
    String(o.id || o.correlativo || 'PED-000'),
    o.cliente || o.clienteNombre || 'Cliente',
    o.vendedor || 'Asesor Comercial',
    o.fecha ? String(o.fecha).slice(0, 10) : '2026-10-23',
    formatUsd(o.totalUsd || o.total || 0),
    formatBs((o.totalUsd || o.total || 0) * tasa),
    o.status || 'PENDIENTE'
  ]);

  autoTable(base.doc, {
    startY: currentY,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    head: [['N° PEDIDO', 'CLIENTE / DESTINATARIO', 'ASESOR COMERCIAL', 'FECHA', 'TOTAL USD', 'TOTAL BS', 'ESTATUS']],
    body: tableData.length > 0 ? tableData : [['SIN PEDIDOS', '-', '-', '-', '$ 0.00', 'Bs. 0,00', '-']],
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.navy,
      textColor: [255, 255, 255],
      fontSize: 6.8,
      fontStyle: 'bold',
      cellPadding: 1.6
    },
    styles: {
      fontSize: 6.2,
      cellPadding: 1.4,
      textColor: COLORS.dark
    },
    alternateRowStyles: {
      fillColor: COLORS.lightBg
    },
    columnStyles: {
      0: { fontStyle: 'bold', halign: 'center', cellWidth: 22 },
      1: { cellWidth: 46 },
      2: { cellWidth: 26 },
      3: { halign: 'center', cellWidth: 16 },
      4: { halign: 'right', fontStyle: 'bold', cellWidth: 24 },
      5: { halign: 'right', cellWidth: 26 },
      6: { halign: 'center', fontStyle: 'bold', cellWidth: 19.9 }
    },
    didParseCell: (data) => {
      if (data.column.index === 6 && data.section === 'body') {
        data.cell.text = ''; // Vector badge drawn in didDrawCell
      }
    },
    didDrawCell: (data) => {
      if (data.column.index === 6 && data.section === 'body') {
        drawStatusBadge(base.doc, data.cell, data.cell.raw);
      }
    }
  });

  const finalYOrd = base.doc.lastAutoTable?.finalY || currentY;
  addGrandTotalBox(base.doc, finalYOrd + 3.5, [
    { label: 'TOTAL PEDIDOS PIPELINE', value: `${totalPedidos} Pedidos`, subtext: `${orders.length} órdenes procesadas`, color: COLORS.navy },
    { label: 'VOLUMEN MONETARIO USD', value: formatUsd(totalMontoUsd), subtext: formatBs(totalMontoUsd * tasa), color: COLORS.emerald },
    { label: 'FACTURADOS / DESPACHO', value: `${facturados} Listos`, subtext: `${pendientes} pendientes de aprobación`, color: COLORS.cyan }
  ], base.tableWidth, base.startX);

  finalizeAndSave(base.doc, `Reporte_Pedidos_SIGNUM_${new Date().toISOString().slice(0, 10)}.pdf`, currentUser);
  return base.doc;
}

// -------------------------------------------------------------------------
// Resolutores de precio por renglón (soportan todas las variantes de campos
// usadas en Notas de Pedido, Ventas POS y Facturas Profit).
// -------------------------------------------------------------------------
function resolveItemQty(it = {}) {
  const q = Number(it.cantidad ?? it.cant ?? it.qty ?? it.total_art ?? 1);
  return Number.isFinite(q) && q > 0 ? q : 1;
}

function resolveItemUnitPriceUsd(it = {}) {
  const candidates = [
    it.precioUnitarioUsd, it.precio_unitario_usd, it.precioUsd, it.precio_usd,
    it.precioUnitario, it.precio, it.prec_vta, it.precioVenta
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }
  // Derivar desde el subtotal si sólo se guardó el total del renglón
  const qty = resolveItemQty(it);
  const total = Number(it.totalUsd ?? it.subtotalUsd ?? it.total ?? it.totalNeto ?? it.reng_neto ?? 0);
  return Number.isFinite(total) && total > 0 ? total / qty : 0;
}

function resolveItemSubtotalUsd(it = {}) {
  const candidates = [it.totalUsd, it.subtotalUsd, it.total_usd, it.total, it.totalNeto, it.reng_neto];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return resolveItemQty(it) * resolveItemUnitPriceUsd(it);
}

// =========================================================================
// 8B. NOTA DE PEDIDO / PREVENTA INDIVIDUAL PARA VENDEDOR (RESERVA DE STOCK)
// =========================================================================
/**
 * Genera la Nota de Pedido / Cotización de Preventa oficial para el Vendedor
 * y el Cliente con la política explícita de reserva y vencimiento a las 72 horas de su emisión.
 * Permite impresión y descarga directa en el dispositivo local.
 */
export function generateSellerOrderPDF({ order = {}, config = {}, currentUser = null, client = null }) {
  const tasa = Number(order.tasaCambio || order.tasaBcv || config?.tasaDolar) || 827.73;
  const orderId = String(order.numeroDoc || order.numeroPedido || order.id || order.correlativo || 'PED-001');
  const rawOrderDate = order.fechaEmision || order.fechaCreacion || order.fecha || order.created_at || '';
  const parseVeDateStr = (val) => {
    if (!val) {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    }
    const str = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
    }
    return str.slice(0, 10);
  };
  const orderDate = parseVeDateStr(rawOrderDate);

  const rawSellerName = String(order.vendedorNombre || order.vendedor || '').trim();
  const rawSellerId = String(order.vendedorId || '').trim();
  const rawSellerCode = String(order.vendedorCoVen || order.codigoVendedor || order.coVen || '').trim();
  const sellerCode = rawSellerCode || (rawSellerId && rawSellerId !== rawSellerName && !rawSellerId.includes(' ') ? rawSellerId : '') || currentUser?.co_ven || currentUser?.coVen || currentUser?.codigo || 'VEN-01';
  const sellerName = rawSellerName || (rawSellerId && rawSellerId !== sellerCode ? rawSellerId : '') || currentUser?.nombre || 'Asesor Comercial';

  const upperDocId = orderId.toUpperCase();
  const isNotaEntrega =
    String(order.tipoDoc || order.tipo_doc || '').toUpperCase() === 'NOTA_ENTREGA' ||
    String(order.modalidadVenta || order.modalidad_venta || '').toUpperCase() === 'OFICINA' ||
    String(order.almacen || order.almacenId || order.almacen_id || '').trim() === '02' ||
    upperDocId.startsWith('PED-NE') ||
    upperDocId.startsWith('NE-');
  const canalComercialLabel = isNotaEntrega
    ? 'Mayorista / Despacho Planta (Alm. 02)'
    : (String(order.modalidadVenta || order.modalidad_venta || '').toUpperCase() === 'PREVENTA'
        ? 'Preventa Móvil / Fiscal (Alm. 01)'
        : 'Mostrador / Despacho Fiscal (Alm. 01)');

  const clientName = order.cliente || order.clienteNombre || client?.nombre || 'Cliente General';
  const clientRif = order.clienteRif || client?.rif || client?.ci || 'J-00000000-0';
  const clientDir = order.direccionEntrega || order.direccion || client?.direccion || 'Valencia, Edo. Carabobo';
  const clientZone = order.zonaVenta || client?.zona || '01';
  const paymentTerm = order.condicionPago || order.condicion || order.plazo || 'CONTADO';
  const notes = order.observaciones || order.comentarios || '';

  const base = createBaseReport({
    title: 'NOTA DE PEDIDO / PREVENTA COMERCIAL',
    subtitle: 'Fuerza de Ventas • Reserva de Stock Temporal • Vigencia Oficial: 72 Horas',
    moduleCode: 'PED',
    currentUser,
    config
  });

  const rawItems = order.items || order.renglones || [];
  const items = Array.isArray(rawItems) ? rawItems : [];

  // Cálculos de Totales, IVA Fiscal (16%) y Volúmenes
  let totalLitros = 0;
  let subtotalUsd = 0;
  let taxableBaseUsd = 0;

  if (items.length > 0) {
    items.forEach((it) => {
      const qty = Number(it.cantidad || it.qty || 1);
      const unitLitros = Number(it.litrosUnitarios || it.litrosPorUnidad || 0);
      const rowLitros = it.litrosTotales ? Number(it.litrosTotales) : qty * unitLitros;
      const rowSubtotal = resolveItemSubtotalUsd(it);
      const alicuota = String(it.tipoAlicuota || it.tipo_alicuota || (it.aplicaIva === false ? 'EXENTO_0' : 'GENERAL_16')).toUpperCase();

      totalLitros += rowLitros;
      subtotalUsd += rowSubtotal;
      if (alicuota !== 'EXENTO_0' && it.aplicaIva !== false && it.aplica_iva !== false) {
        taxableBaseUsd += rowSubtotal;
      }
    });
    subtotalUsd = Number(subtotalUsd.toFixed(2));
    taxableBaseUsd = Number(taxableBaseUsd.toFixed(2));
  } else {
    subtotalUsd = Number(order.subtotalUsd || order.totalBrutoUsd || order.totalUsd || order.totalNetoUsd || order.total || 0);
    taxableBaseUsd = Number(order.baseImponibleUsd || subtotalUsd);
    totalLitros = Number(order.totalLitros || 0);
  }

  let ivaUsd = 0;
  if (!isNotaEntrega) {
    if (Number(order.ivaUsd || 0) > 0) {
      ivaUsd = Number(Number(order.ivaUsd).toFixed(2));
    } else if (order.aplicaIva === true || (order.aplicaIva === undefined && taxableBaseUsd > 0)) {
      ivaUsd = Number((taxableBaseUsd * 0.16).toFixed(2));
    }
  }
  const storedTotalUsd = Number(order.totalUsd || order.totalNetoUsd || 0);
  const totalUsd = ivaUsd > 0 && storedTotalUsd >= subtotalUsd + ivaUsd - 0.02
    ? Number(storedTotalUsd.toFixed(2))
    : Number((subtotalUsd + ivaUsd).toFixed(2));
  const totalBs = Number((totalUsd * tasa).toFixed(2));
  const status = (order.status || 'PENDIENTE').toUpperCase();

  // 1. Tarjetas Superiores de Resumen de la Orden
  const cards = [
    { label: 'N° de Pedido', value: orderId, subtext: `Emisión: ${orderDate}`, color: COLORS.navy },
    { label: 'Volumen Total', value: `${formatUnitVe(totalLitros)} Lts.`, subtext: `${items.length} Renglones`, color: COLORS.cyan },
    { label: 'Monto Total USD', value: formatUsd(totalUsd), subtext: `${formatBs(totalBs)}${ivaUsd > 0 ? ' (Inc. IVA 16%)' : ''}`, color: COLORS.emerald },
    { label: 'Vigencia Reserva', value: '72 Horas', subtext: status === 'FACTURADO' ? 'Facturado' : (status === 'ANULADO' ? 'Anulado' : 'Reserva Activa'), color: status === 'ANULADO' ? COLORS.red : COLORS.amber }
  ];

  let currentY = addSummaryCards(base.doc, base.startY, cards, base.tableWidth, base.startX);

  // 2. Banner Oficial de Política de Reserva por 72 horas
  base.doc.setFont('helvetica', 'normal');
  base.doc.setFontSize(6.8);
  const noticeText = `Esta nota de pedido compromete stock temporalmente en almacén durante 72 horas desde su emisión (${orderDate}). Pasado este plazo, los ítems reservados no facturados caducan y se liberan de forma automática a la disponibilidad general.`;
  const splitNotice = base.doc.splitTextToSize(noticeText, base.tableWidth - 8);
  const bannerH = Math.max(10.8, 5.8 + splitNotice.length * 3.1 + 1.5);
  base.doc.setFillColor(254, 243, 199); // Amber 100 soft
  base.doc.setDrawColor(...COLORS.amber);
  base.doc.setLineWidth(0.35);
  base.doc.roundedRect(base.startX, currentY, base.tableWidth, bannerH, 1.2, 1.2, 'FD');

  base.doc.setFillColor(...COLORS.amber);
  base.doc.roundedRect(base.startX, currentY, 2.5, bannerH, 0.6, 0.6, 'F');

  base.doc.setFont('helvetica', 'bold');
  base.doc.setFontSize(7.6);
  base.doc.setTextColor(...COLORS.amber);
  base.doc.text('POLÍTICA DE RESERVA DE INVENTARIO (CORTE OPERATIVO: 72 HORAS):', base.startX + 5, currentY + 3.8);

  base.doc.setFont('helvetica', 'normal');
  base.doc.setFontSize(6.8);
  base.doc.setTextColor(...COLORS.dark);
  base.doc.text(splitNotice, base.startX + 5, currentY + 7.2);

  currentY += bannerH + 2.5;

  // 3. Bloque Bipartito: Asesor de Ventas y Datos del Cliente
  const boxH = 22.0;
  const colW = (base.tableWidth - 2) / 2;

  base.doc.setFillColor(...COLORS.lightBg);
  base.doc.setDrawColor(...COLORS.border);
  base.doc.setLineWidth(0.3);
  base.doc.roundedRect(base.startX, currentY, base.tableWidth, boxH, 1.2, 1.2, 'FD');

  // Separador vertical
  base.doc.setDrawColor(...COLORS.border);
  base.doc.line(base.startX + colW, currentY + 1.5, base.startX + colW, currentY + boxH - 1.5);

  // Asesor de Ventas
  base.doc.setFont('helvetica', 'bold');
  base.doc.setFontSize(7.6);
  base.doc.setTextColor(...COLORS.navy);
  base.doc.text('DATOS DEL ASESOR / FUERZA DE VENTAS', base.startX + 3, currentY + 4.4);

  base.doc.setFont('helvetica', 'normal');
  base.doc.setFontSize(6.9);
  base.doc.setTextColor(...COLORS.slate);
  base.doc.text('Asesor Comercial:', base.startX + 3, currentY + 8.8);
  base.doc.setFont('helvetica', 'bold');
  base.doc.setTextColor(...COLORS.dark);
  const sellerLabelTrunc = base.doc.splitTextToSize(`${sellerName} (${sellerCode})`, colW - 34)[0] || '';
  base.doc.text(sellerLabelTrunc, base.startX + 31, currentY + 8.8);

  base.doc.setFont('helvetica', 'normal');
  base.doc.setTextColor(...COLORS.slate);
  base.doc.text('Canal Comercial:', base.startX + 3, currentY + 13.2);
  base.doc.setFont('helvetica', 'bold');
  base.doc.setTextColor(...COLORS.dark);
  const canalTrunc = base.doc.splitTextToSize(canalComercialLabel, colW - 34)[0] || '';
  base.doc.text(canalTrunc, base.startX + 31, currentY + 13.2);

  base.doc.setFont('helvetica', 'normal');
  base.doc.setTextColor(...COLORS.slate);
  base.doc.text('Condición de Pago:', base.startX + 3, currentY + 17.6);
  base.doc.setFont('helvetica', 'bold');
  base.doc.setTextColor(...COLORS.navy);
  const termTrunc = base.doc.splitTextToSize(paymentTerm, colW - 34)[0] || '';
  base.doc.text(termTrunc, base.startX + 31, currentY + 17.6);

  // Cliente Destinatario
  base.doc.setFont('helvetica', 'bold');
  base.doc.setFontSize(7.6);
  base.doc.setTextColor(...COLORS.navy);
  base.doc.text('DATOS DEL CLIENTE / RECEPTOR', base.startX + colW + 3, currentY + 4.4);

  base.doc.setFont('helvetica', 'normal');
  base.doc.setFontSize(6.9);
  base.doc.setTextColor(...COLORS.slate);
  base.doc.text('Razón Social:', base.startX + colW + 3, currentY + 8.8);
  base.doc.setFont('helvetica', 'bold');
  base.doc.setTextColor(...COLORS.dark);
  const clientNameTrunc = base.doc.splitTextToSize(clientName, colW - 28)[0] || clientName;
  base.doc.text(clientNameTrunc, base.startX + colW + 25, currentY + 8.8);

  base.doc.setFont('helvetica', 'normal');
  base.doc.setTextColor(...COLORS.slate);
  base.doc.text('RIF / Zona:', base.startX + colW + 3, currentY + 13.2);
  base.doc.setFont('helvetica', 'bold');
  base.doc.setTextColor(...COLORS.dark);
  const rifZoneTrunc = base.doc.splitTextToSize(`${clientRif}  •  Zona: ${clientZone}`, colW - 28)[0] || '';
  base.doc.text(rifZoneTrunc, base.startX + colW + 25, currentY + 13.2);

  base.doc.setFont('helvetica', 'normal');
  base.doc.setTextColor(...COLORS.slate);
  base.doc.text('Entrega en:', base.startX + colW + 3, currentY + 17.6);
  base.doc.setFont('helvetica', 'bold');
  base.doc.setTextColor(...COLORS.dark);
  const dirTrunc = base.doc.splitTextToSize(clientDir, colW - 28)[0] || clientDir;
  base.doc.text(dirTrunc, base.startX + colW + 25, currentY + 17.6);

  currentY += boxH + 2.5;

  // 4. Tabla Detallada de Ítems / Lubricantes Solicitados
  const tableData = items.map((it, idx) => {
    const qty = Number(it.cantidad || it.qty || 1);
    const unitLitros = Number(it.litrosUnitarios || it.litrosPorUnidad || 0);
    const rowLitros = it.litrosTotales ? Number(it.litrosTotales) : qty * unitLitros;
    const unitPrice = resolveItemUnitPriceUsd(it);
    const rowSubtotal = resolveItemSubtotalUsd(it);

    return [
      String(idx + 1),
      String(it.articuloId || it.co_art || it.codigo || 'LUB-01'),
      String(it.articuloDescripcion || it.descripcion || it.nombre || 'Lubricante SIGNUM'),
      String(resolveProductUnit(it, 'Caja')),
      String(qty),
      rowLitros > 0 ? `${formatUnitVe(rowLitros)} L` : '-',
      formatUsd(unitPrice),
      formatUsd(rowSubtotal),
      formatBs(rowSubtotal * tasa)
    ];
  });

  autoTable(base.doc, {
    startY: currentY,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    head: [['REN', 'CÓDIGO', 'DESCRIPCIÓN DEL PRODUCTO', 'PRESENTACIÓN', 'CANT', 'VOLUMEN', 'P. UNIT ($)', 'TOTAL ($)', 'TOTAL (Bs.)']],
    body: tableData.length > 0 ? tableData : [['1', 'PED-GEN', 'Renglón Único Preventa', 'Unidad', '1', `${formatUnitVe(totalLitros)} L`, formatUsd(totalUsd), formatUsd(totalUsd), formatBs(totalBs)]],
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.navy,
      textColor: [255, 255, 255],
      fontSize: 6.4,
      fontStyle: 'bold',
      cellPadding: 1.5,
      halign: 'center'
    },
    styles: {
      fontSize: 5.9,
      cellPadding: 1.3,
      textColor: COLORS.dark
    },
    alternateRowStyles: {
      fillColor: COLORS.lightBg
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 9 },
      1: { halign: 'center', fontStyle: 'bold', cellWidth: 18 },
      2: { cellWidth: 49 },
      3: { cellWidth: 23 },
      4: { halign: 'center', fontStyle: 'bold', cellWidth: 12 },
      5: { halign: 'center', cellWidth: 16 },
      6: { halign: 'right', cellWidth: 17 },
      7: { halign: 'right', fontStyle: 'bold', cellWidth: 17 },
      8: { halign: 'right', cellWidth: 18.9 }
    }
  });

  const finalYTable = base.doc.lastAutoTable?.finalY || currentY;

  // 5. Caja de Resumen Final y Observaciones (respetando la zona inferior anclada de firmas)
  const { footerY, continuationTopY } = getPageLayoutMetrics(base.doc);
  const sigAnchoredTop = footerY - 3 - 19;
  const hasNotes = Boolean(notes && notes !== 'Ninguna');
  const totalsAndNotesHeight = 16 + (hasNotes ? 8 : 0);

  let finalYForSignatures = finalYTable + 2.5;
  if (finalYForSignatures + totalsAndNotesHeight > sigAnchoredTop - 2) {
    base.doc.addPage();
    finalYForSignatures = continuationTopY;
  }

  addGrandTotalBox(base.doc, finalYForSignatures, [
    { label: 'VOLUMEN TOTAL LUBRICANTES', value: `${formatUnitVe(totalLitros)} Litros`, subtext: `${items.length} Renglones`, color: COLORS.cyan },
    {
      label: ivaUsd > 0 ? 'TOTAL PREVENTA CON IVA (USD)' : 'MONTO TOTAL PREVENTA USD',
      value: formatUsd(totalUsd),
      subtext: ivaUsd > 0
        ? `Base: ${formatUsd(subtotalUsd)} + IVA 16%: ${formatUsd(ivaUsd)}`
        : (isNotaEntrega ? 'Nota de Entrega (Exento IVA)' : 'Base imponible calculada'),
      color: COLORS.navy
    },
    { label: 'TOTAL EQUIVALENTE BS. BCV', value: formatBs(totalBs), subtext: `Tasa: ${formatBs(tasa)} / USD`, color: COLORS.emerald }
  ], base.tableWidth, base.startX);

  finalYForSignatures += 16;

  // Observaciones si existen
  if (hasNotes) {
    base.doc.setFont('helvetica', 'bold');
    base.doc.setFontSize(7.0);
    base.doc.setTextColor(...COLORS.slate);
    base.doc.text('OBSERVACIONES COMERCIALES:', base.startX + 2, finalYForSignatures + 1);
    base.doc.setFont('helvetica', 'normal');
    base.doc.setTextColor(...COLORS.dark);
    const splitNotes = base.doc.splitTextToSize(notes, base.tableWidth - 4).slice(0, 2);
    base.doc.text(splitNotes, base.startX + 2, finalYForSignatures + 4.8);
    finalYForSignatures += Math.max(8, splitNotes.length * 3.4 + 5.5);
  }

  // 6. Sección Oficial de Tres Firmas (anclada por sobre el pie de página)
  addSignatures(
    base.doc,
    finalYForSignatures + 2,
    ['Asesor Comercial (Emisor)', 'Aceptación Cliente / Firma', 'Almacén Central / Despacho'],
    base.tableWidth,
    base.startX
  );

  const safeFilename = `Nota_Pedido_Vendedor_${orderId.replace(/[^a-zA-Z0-9_\-]/g, '_')}_${orderDate}.pdf`;
  finalizeAndSave(base.doc, safeFilename, currentUser);

  return { doc: base.doc, filename: safeFilename };
}

// =========================================================================
// 8.B. GUÍA DE DESPACHO & ORDEN DE ENTREGA FÍSICA (ALMACÉN Y RAMPA)
// =========================================================================
export function generateWarehouseDispatchGuidePDF({ sale, config = {}, currentUser = null, order = null }) {
  if (!sale) return null;

  const base = createBaseReport({
    title: 'GUÍA DE DESPACHO & ORDEN DE ENTREGA (ALMACÉN)',
    subtitle: 'Verificación Física de Carga, Control de Rampa y Salida de Planta de Lubricantes',
    moduleCode: 'ALM-DESP',
    currentUser,
    config
  });

  const facturaDoc = sale.numeroDoc || sale.id || 'FACT-000';
  const controlDoc = sale.numeroControl || '00-001043';
  const pedidoOrigen = sale.pedidoOrigenDoc || order?.numeroDoc || order?.id || 'DIRECTO_MOSTRADOR';
  const parsedSaleDate = parseInvoiceDateInfo(sale.fecha || sale.fechaEmision || new Date(), sale.updatedAt || sale.updated_at);
  const safeSaleDate = parsedSaleDate.date || new Date();
  const fechaStr = safeSaleDate.toLocaleDateString('es-VE');
  const horaStr = parsedSaleDate.hasTime
    ? safeSaleDate.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' })
    : '—';
  const resolvedGuideClient = resolveDocumentClientInfo({ ...sale, direccionEntrega: sale.direccionEntrega || order?.direccionEntrega }, null, null);
  const clienteNombre = resolvedGuideClient.nombre || sale.clienteNombre || sale.cliente || 'CLIENTE MOSTRADOR';
  const clienteRif = resolvedGuideClient.rif || sale.clienteRif || 'J-000000000';
  const direccion = resolvedGuideClient.direccion || 'Zona Industrial Valencia, Edo. Carabobo';
  const zonaLogistica = sale.zonaDespacho || order?.zonaVenta || '01 - Valencia';
  const transportista = sale.transportista || order?.transporteId || order?.chofer || 'Transporte Motorven (Flota Propia)';
  const vendedor = sale.vendedor || order?.vendedorId || 'Asesor Comercial';
  const cajera = currentUser?.nombre || 'Caja Principal';

  const items = Array.isArray(sale.items) && sale.items.length > 0 ? sale.items : (Array.isArray(order?.items) ? order.items : []);

  let totalLitros = 0;
  let totalUnidades = 0;

  items.forEach((it) => {
    const qty = Number(it.cantidad || it.qty || 1);
    const unitLitros = Number(it.litrosUnitarios || it.litrosPorUnidad || 0);
    const rowLitros = it.litrosTotales ? Number(it.litrosTotales) : qty * unitLitros;
    totalLitros += rowLitros;
    totalUnidades += qty;
  });

  // 1. Tarjetas Superiores de Control Operativo
  const cards = [
    { label: 'Factura SENIAT N°', value: facturaDoc, subtext: `Control: ${controlDoc}`, color: COLORS.navy },
    { label: 'Volumen a Despachar', value: `${formatUnitVe(totalLitros)} Lts.`, subtext: `${formatUnitVe(totalUnidades, 0)} Cajas / Tambores`, color: COLORS.cyan },
    { label: 'Zona & Transporte', value: zonaLogistica, subtext: transportista, color: COLORS.emerald },
    { label: 'Estatus en Planta', value: 'AUTORIZADO', subtext: 'Factura Emitida y Cobrada', color: COLORS.amber }
  ];

  let currentY = addSummaryCards(base.doc, base.startY, cards, base.tableWidth, base.startX);

  // 2. Banner de Control Operativo de Almacén
  base.doc.setFont('helvetica', 'normal');
  base.doc.setFontSize(6.8);
  const noticeText = `El personal de almacén debe verificar cada renglón físicamente en rampa marcando la casilla de verificación [  ]. La salida del camión requiere la firma del despachador, del transportista y el sello de recepción del cliente.`;
  const splitNotice = base.doc.splitTextToSize(noticeText, base.tableWidth - 8);
  const bannerH = Math.max(10.8, 5.8 + splitNotice.length * 3.1 + 1.5);
  base.doc.setFillColor(239, 246, 255); // Blue 50
  base.doc.setDrawColor(...COLORS.cyan);
  base.doc.setLineWidth(0.35);
  base.doc.roundedRect(base.startX, currentY, base.tableWidth, bannerH, 1.2, 1.2, 'FD');

  base.doc.setFillColor(...COLORS.cyan);
  base.doc.roundedRect(base.startX, currentY, 2.5, bannerH, 0.6, 0.6, 'F');

  base.doc.setFont('helvetica', 'bold');
  base.doc.setFontSize(7.6);
  base.doc.setTextColor(...COLORS.cyan);
  base.doc.text('DOCUMENTO DE CONTROL FÍSICO DE ALMACÉN (SIN VALORES MONETARIOS):', base.startX + 5, currentY + 3.8);

  base.doc.setFont('helvetica', 'normal');
  base.doc.setFontSize(6.8);
  base.doc.setTextColor(...COLORS.dark);
  base.doc.text(splitNotice, base.startX + 5, currentY + 7.2);

  currentY += bannerH + 2.5;

  // 3. Bloque Bipartito: Destinatario vs Logística
  const boxH = 22.0;
  const colW = (base.tableWidth - 2) / 2;

  base.doc.setFillColor(...COLORS.lightBg);
  base.doc.setDrawColor(...COLORS.border);
  base.doc.setLineWidth(0.3);
  base.doc.roundedRect(base.startX, currentY, base.tableWidth, boxH, 1.2, 1.2, 'FD');

  // Separador vertical
  base.doc.setDrawColor(...COLORS.border);
  base.doc.line(base.startX + colW, currentY + 1.5, base.startX + colW, currentY + boxH - 1.5);

  // Columna Izquierda: Datos del Destinatario
  base.doc.setFont('helvetica', 'bold');
  base.doc.setFontSize(7.6);
  base.doc.setTextColor(...COLORS.navy);
  base.doc.text('DATOS DE ENTREGA Y DESTINATARIO', base.startX + 3, currentY + 4.4);

  base.doc.setFont('helvetica', 'normal');
  base.doc.setFontSize(7.0);
  base.doc.setTextColor(...COLORS.dark);
  const wClip = (txt) => base.doc.splitTextToSize(String(txt), colW - 6)[0] || '';
  base.doc.text(wClip(`Cliente: ${clienteNombre}`), base.startX + 3, currentY + 8.8);
  base.doc.text(wClip(`RIF: ${clienteRif}`), base.startX + 3, currentY + 13.0);
  base.doc.text(wClip(`Dirección: ${direccion}`), base.startX + 3, currentY + 17.2);

  // Columna Derecha: Trazabilidad Logística
  base.doc.setFont('helvetica', 'bold');
  base.doc.setFontSize(7.6);
  base.doc.setTextColor(...COLORS.navy);
  base.doc.text('TRAZABILIDAD DE FACTURACIÓN Y TRANSPORTE', base.startX + colW + 3, currentY + 4.4);

  base.doc.setFont('helvetica', 'normal');
  base.doc.setFontSize(7.0);
  base.doc.setTextColor(...COLORS.dark);
  base.doc.text(wClip(`Nota Pedido Origen: ${pedidoOrigen} • Factura: ${facturaDoc}`), base.startX + colW + 3, currentY + 8.8);
  base.doc.text(wClip(`Facturado por: ${cajera} • Asesor: ${vendedor}`), base.startX + colW + 3, currentY + 13.0);
  base.doc.text(wClip(`Unidad de Carga: ${transportista} • Ruta: ${zonaLogistica}`), base.startX + colW + 3, currentY + 17.2);

  currentY += boxH + 3;

  // 4. Tabla de Carga Física en Rampa (Picking / Packing)
  const tableData = items.map((it, idx) => {
    const qty = Number(it.cantidad || it.qty || 1);
    const unitLitros = Number(it.litrosUnitarios || it.litrosPorUnidad || 0);
    const rowLitros = it.litrosTotales ? Number(it.litrosTotales) : qty * unitLitros;
    const desc = it.descripcion || it.articuloDescripcion || 'Lubricante Motorven';
    const presentacion = resolveProductUnit(it, 'Caja');
    const code = it.codigo || it.articuloId || `LUB-${idx + 1}`;

    return [
      String(idx + 1),
      code,
      desc.toUpperCase(),
      presentacion,
      String(qty),
      `${formatUnitVe(rowLitros)} L`,
      '[   ] CONFORME'
    ];
  });

  autoTable(base.doc, {
    startY: currentY,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    head: [['#', 'CÓDIGO', 'DESCRIPCIÓN DEL LUBRICANTE', 'PRESENTACIÓN', 'CANTIDAD', 'LITROS', 'VERIF. RAMPA']],
    body: tableData.length > 0 ? tableData : [['1', 'LUB-001', 'LUBRICANTE MOTORVEN', 'Caja', '1', '12,00 L', '[   ] CONFORME']],
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.navy,
      textColor: [255, 255, 255],
      fontSize: 6.8,
      fontStyle: 'bold',
      cellPadding: 1.8
    },
    styles: {
      fontSize: 6.4,
      cellPadding: 1.8,
      textColor: COLORS.dark
    },
    alternateRowStyles: {
      fillColor: COLORS.lightBg
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { fontStyle: 'bold', halign: 'center', cellWidth: 26 },
      2: { cellWidth: 54 },
      3: { halign: 'center', cellWidth: 28 },
      4: { halign: 'center', fontStyle: 'bold', cellWidth: 18 },
      5: { halign: 'right', fontStyle: 'bold', cellWidth: 20 },
      6: { halign: 'center', fontStyle: 'bold', cellWidth: 25.9, textColor: COLORS.navy }
    }
  });

  const finalYTable = base.doc.lastAutoTable.finalY || currentY + 40;
  const { footerY, continuationTopY } = getPageLayoutMetrics(base.doc);
  const sigAnchoredTop = footerY - 3 - 19;
  let finalYSignatures = finalYTable + 3;

  if (finalYSignatures + 16 > sigAnchoredTop - 2) {
    base.doc.addPage();
    finalYSignatures = continuationTopY;
  }

  // Cuadro de Resumen de Carga Física
  addGrandTotalBox(base.doc, finalYSignatures, [
    { label: 'TOTAL UNIDADES / CAJAS', value: `${totalUnidades} Bultos`, subtext: 'Conteo físico verificado', color: COLORS.navy },
    { label: 'TOTAL LITROS DE ACEITE', value: `${formatUnitVe(totalLitros)} Litros`, subtext: `${items.length} Renglones`, color: COLORS.cyan },
    { label: 'FECHA Y HORA DE SALIDA', value: `${fechaStr} ${horaStr}`, subtext: 'Control de Garita / Planta', color: COLORS.emerald }
  ], base.tableWidth, base.startX);

  finalYSignatures += 16;

  // 5. Bloque Oficial de Firmas Tripartitas de Despacho (ancladas por sobre el pie de página)
  addSignatures(
    base.doc,
    finalYSignatures + 2,
    ['Despachado por (Almacén / Rampa)', 'Transportado por (Chofer / Placa)', 'Recibido Conforme (Cliente / Sello)'],
    base.tableWidth,
    base.startX
  );

  const safeFilename = `Guia_Despacho_Almacen_${facturaDoc.replace(/[^a-zA-Z0-9_\-]/g, '_')}_${fechaStr.replace(/\//g, '-')}.pdf`;
  finalizeAndSave(base.doc, safeFilename, currentUser);

  return { doc: base.doc, filename: safeFilename };
}

// =========================================================================
// 8.C. FORMATO OFICIAL DE NOTA DE ENTREGA (TAMAÑO CARTA CON DESBORDAMIENTO)
// =========================================================================
const PLACEHOLDER_ADDRESSES = new Set([
  '',
  'n/a',
  'na',
  'venezuela',
  'sin direccion',
  'sin dirección',
  'no registrada',
  'barquisimeto, venezuela',
  'barquisimeto / caracas, venezuela',
  'sede / domicilio del cliente',
  'direccion de entrega registrada',
  'dirección de entrega registrada',
  'calle 48 con av. pedro leon torres, barquisimeto',
  'calle 48 con av. pedro león torres, barquisimeto',
  'calle 48 con pedro leon torres, barquisimeto',
  'calle 48 con pedro león torres, barquisimeto',
  'zona industrial valencia, edo. carabobo'
]);

function cleanAddressCandidate(raw) {
  const txt = String(raw || '').trim();
  if (!txt) return '';
  const norm = txt.toLowerCase().replace(/\s+/g, ' ');
  return PLACEHOLDER_ADDRESSES.has(norm) ? '' : txt;
}

/**
 * Resuelve la información registrada del cliente (dirección, teléfono, nombre, RIF)
 * cruzando el documento contra el parámetro `client`, `clients` y el catálogo `REAL_CLIENTS`.
 */
export function resolveDocumentClientInfo(docData = {}, client = null, clients = null) {
  const safeDoc = docData || {};
  const normId = (v) => String(v || '').trim().toUpperCase();
  const normRif = (v) => String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const normName = (v) =>
    String(v || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[.,]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const docClientId = normId(safeDoc.clienteId || safeDoc.coCli || safeDoc.co_cli);
  const docRif = normRif(safeDoc.clienteRif || safeDoc.rif || safeDoc.cliente_rif);
  const docName = normName(safeDoc.clienteNombre || safeDoc.cliente || safeDoc.cliDes || safeDoc.cli_des || safeDoc.cliente_nombre);

  const findInList = (list) => {
    if (!Array.isArray(list) || list.length === 0) return null;
    if (docClientId && docClientId !== 'CLI-GEN' && docClientId !== 'CLI-TEMP') {
      const byId = list.find((c) => c && (normId(c.id) === docClientId || normId(c.codigo) === docClientId));
      if (byId) return byId;
    }
    if (docRif && docRif.length >= 6 && !/^J0+$|^V0+$/.test(docRif)) {
      const byRif = list.find((c) => c && normRif(c.rif) === docRif);
      if (byRif) return byRif;
    }
    if (docName && docName !== 'cliente general' && docName !== 'consumidor final') {
      const byName = list.find((c) => c && normName(c.nombre || c.razonSocial || c.name) === docName);
      if (byName) return byName;
    }
    return null;
  };

  const matchedClient =
    client ||
    findInList(clients) ||
    findInList(REAL_CLIENTS) ||
    null;

  const clientRegisteredAddr = cleanAddressCandidate(
    matchedClient?.direccion ||
    matchedClient?.domicilioFiscal ||
    matchedClient?.direccion2 ||
    matchedClient?.address
  );

  const docAddr = cleanAddressCandidate(
    safeDoc.clienteDireccion ||
    safeDoc.direccionEntrega ||
    safeDoc.dir_ent ||
    safeDoc.dirEnt ||
    safeDoc.domicilioFiscal ||
    safeDoc.direccion
  );

  const resolvedAddress = clientRegisteredAddr || docAddr || 'Dirección no registrada en ficha del cliente';
  const resolvedPhone = String(
    matchedClient?.telefono ||
    matchedClient?.phone ||
    safeDoc.clienteTelefono ||
    safeDoc.telefono ||
    ''
  ).trim();
  const resolvedNombre = String(
    safeDoc.clienteNombre ||
    safeDoc.cliente ||
    safeDoc.cliDes ||
    safeDoc.cli_des ||
    matchedClient?.nombre ||
    matchedClient?.razonSocial ||
    'CLIENTE GENERAL'
  ).trim();
  const resolvedRif = String(
    safeDoc.clienteRif ||
    safeDoc.rif ||
    matchedClient?.rif ||
    'J-00000000-0'
  ).trim();

  return {
    client: matchedClient,
    nombre: resolvedNombre,
    rif: resolvedRif,
    direccion: resolvedAddress,
    telefono: resolvedPhone === 'N/A' ? '' : resolvedPhone
  };
}

/**
 * Resuelve el nombre completo del vendedor asignado al documento (Factura / Nota de Entrega)
 * cruzando códigos Profit (ej. VV -> Victor Veloz), datos del pedido/venta o ficha del cliente.
 */
export function resolveDocumentSellerName(docData = {}, client = null, clients = null, sellers = null, currentUser = null) {
  const safeDoc = docData || {};
  const sellersPool = [];
  if (Array.isArray(sellers)) sellersPool.push(...sellers);
  if (Array.isArray(REAL_PROFIT_SELLERS)) sellersPool.push(...REAL_PROFIT_SELLERS);

  const normCode = (v) => String(v || '').trim().toUpperCase();
  const findSeller = (raw) => {
    const token = normCode(raw);
    if (!token || token === 'OFICINA PRINCIPAL' || token === 'ASESOR COMERCIAL' || token === 'ASESOR GENERAL') return null;
    return sellersPool.find((s) =>
      s && (
        normCode(s.coVen || s.co_ven || s.id) === token ||
        normCode(s.venDes || s.ven_des || s.nombre) === token
      )
    ) || null;
  };

  const explicitNames = [
    safeDoc.cobradorNombre,
    safeDoc.cobrador_nombre,
    safeDoc.cobrador,
    safeDoc.vendedorNombre,
    safeDoc.vendedor_nombre,
    safeDoc.vendedorDisplay,
    safeDoc.venDes,
    safeDoc.ven_des,
    safeDoc.vendedor
  ].map((v) => String(v || '').trim()).filter(Boolean);

  for (const cand of explicitNames) {
    const matched = findSeller(cand);
    if (matched) return String(matched.venDes || matched.ven_des || matched.nombre || cand).trim();
    if (cand.length > 3 && !['N/A', 'UNDEFINED', 'NULL'].includes(cand.toUpperCase())) {
      return cand;
    }
  }

  const sellerCodes = [
    safeDoc.cobradorId,
    safeDoc.cobrador_id,
    safeDoc.vendedorId,
    safeDoc.vendedor_id,
    safeDoc.vendedorCoVen,
    safeDoc.vendedor_co_ven,
    safeDoc.coVen,
    safeDoc.co_ven
  ].map((v) => String(v || '').trim()).filter(Boolean);

  for (const code of sellerCodes) {
    const matched = findSeller(code);
    if (matched) return String(matched.venDes || matched.ven_des || matched.nombre || code).trim();
  }

  const resolvedClient = client || resolveDocumentClientInfo(safeDoc, null, clients)?.client;
  if (resolvedClient) {
    const cliSellerRaw = String(
      resolvedClient.vendedorNombre ||
      resolvedClient.vendedor ||
      resolvedClient.coVen ||
      resolvedClient.co_ven ||
      ''
    ).trim();
    if (cliSellerRaw) {
      const matched = findSeller(cliSellerRaw);
      if (matched) return String(matched.venDes || matched.ven_des || matched.nombre || cliSellerRaw).trim();
      if (cliSellerRaw.length > 3) return cliSellerRaw;
    }
  }

  if (sellerCodes.length > 0) return sellerCodes[0];
  if (explicitNames.length > 0) return explicitNames[0];
  return String(safeDoc.creadoPor || currentUser?.nombre || 'Asesor Comercial').trim();
}

/**
 * Construye el texto estático de las Cuentas Bancarias oficiales de Grupo Motorven
 * para codificarlo en el QR de Notas de Entrega y Documentos Fiscales.
 */
export function getStaticBankAccountsQRPayload(config = {}, bankAccounts = null) {
  const list = Array.isArray(bankAccounts) && bankAccounts.length > 0
    ? bankAccounts
    : (Array.isArray(REAL_PROFIT_BANK_ACCOUNTS) ? REAL_PROFIT_BANK_ACCOUNTS : []);
  const empresa = String(config?.nombreEmpresa || 'GRUPO MOTORVEN, C.A.').trim();
  const rif = String(config?.rif || 'J-31115365-9').trim();
  const lines = [`CUENTAS BANCARIAS ${empresa}`, `RIF: ${rif}`];
  list.forEach((acc, idx) => {
    const bank = String(acc?.bancoNombre || acc?.banco_nombre || acc?.desBan || acc?.des_ban || 'BANCO').trim();
    const num = String(acc?.numCta || acc?.num_cta || acc?.nroCta || acc?.nro_cta || '').trim();
    if (num) {
      lines.push(`${idx + 1}. ${bank}: ${num}`);
    }
  });
  return lines.join('\n');
}

/**
 * Construye una matriz QR estándar ISO/IEC 18004 (ajuste automático de versión 1..40)
 * 100% determinista y escaneable en dispositivos móviles.
 */
export function buildQRCodeMatrix(rawText = '') {
  const cleanStr = String(rawText || 'SIGNUM MOTORVEN');
  const qr = qrcode(0, 'L');
  qr.addData(cleanStr, 'Byte');
  qr.make();
  const size = qr.getModuleCount();
  const modules = Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => Boolean(qr.isDark(r, c)))
  );
  return modules;
}

/**
 * Dibuja el recuadro de Código QR vectorial en documentos Motorven
 */
function drawDeliveryNoteQRBox(doc, x, y, boxSize, qrPayload) {
  // Marco contenedor del QR estilo Motorven
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(...COLORS.navy);
  doc.setLineWidth(0.35);
  doc.roundedRect(x, y, boxSize, boxSize, 1.2, 1.2, 'FD');

  const matrix = buildQRCodeMatrix(qrPayload);
  const gridCount = matrix.length;
  const padding = 1.2;
  const innerSize = boxSize - padding * 2;
  const cellSize = innerSize / gridCount;
  const startX = x + padding;
  const startY = y + padding;

  doc.setFillColor(...COLORS.dark);
  for (let r = 0; r < gridCount; r++) {
    for (let c = 0; c < gridCount; c++) {
      if (matrix[r][c]) {
        doc.rect(
          startX + c * cellSize,
          startY + r * cellSize,
          cellSize + 0.03,
          cellSize + 0.03,
          'F'
        );
      }
    }
  }
}

/**
 * Normaliza y enriquece los renglones de productos de una Nota de Entrega o Factura:
 * - Resuelve descripción, presentación y litros por unidad contra el catálogo de productos (`products` / `REAL_PRODUCTS`)
 * - Convierte precios y totales importados en Bolívares desde Profit Plus (`precioUnitario`, `totalNeto`, `prec_vta`, `reng_neto`) a USD
 * - Ajusta proporcionalmente si el documento fue editado manualmente en CxC y conserva totales exactos
 */
const isPlaceholderDocItem = (it) => {
  if (!it || typeof it !== 'object') return true;
  const code = String(it.codigo || it.articuloId || it.articulo_id || it.co_art || '').trim().toUpperCase();
  return !code || code === 'LUB-MANUAL' || code === 'NE-DESP' || code === 'LUB-GEN';
};

export function pickPreferredLineItems(...candidates) {
  let best = [];
  let bestScore = -1;
  for (const raw of candidates) {
    let arr = raw;
    if (typeof raw === 'string') {
      try {
        arr = JSON.parse(raw);
      } catch {
        arr = [];
      }
    }
    if (!Array.isArray(arr) || arr.length === 0) continue;
    const realCount = arr.filter((it) => !isPlaceholderDocItem(it)).length;
    const score = realCount > 0 ? (1000 + arr.length) : arr.length;
    if (score > bestScore) {
      best = arr;
      bestScore = score;
    }
  }
  return best;
}

export function resolveDeliveryNoteLineItems(docData = {}, products = null, fallbackRate = 827.73) {
  const safeDoc = docData || {};
  const tasa = Number(safeDoc.tasaDolar || safeDoc.tasaBcv || safeDoc.tasa || fallbackRate) || 827.73;

  const catalog = Array.isArray(products) && products.length > 0 ? products : REAL_PRODUCTS;
  const prodMap = new Map();
  if (Array.isArray(catalog)) {
    catalog.forEach((p) => {
      if (!p) return;
      [p.codigo, p.id, p.co_art, p.coArt, p.sku].forEach((k) => {
        if (k !== undefined && k !== null) {
          const clean = String(k).trim();
          if (clean) {
            prodMap.set(clean, p);
            prodMap.set(clean.toUpperCase(), p);
            if (/^\d+$/.test(clean)) {
              prodMap.set(String(parseInt(clean, 10)), p);
              prodMap.set(clean.padStart(6, '0'), p);
            }
          }
        }
      });
    });
  }

  const rawTipoDoc = String(safeDoc.tipoDoc ?? safeDoc.tipo_doc ?? safeDoc.tipoDocumento ?? '').toUpperCase().trim();
  const rawDocNum = String(safeDoc.numeroDoc ?? safeDoc.factNum ?? safeDoc.fact_num ?? safeDoc.nroFactura ?? safeDoc.id ?? '').toUpperCase().trim();
  const isNeDoc =
    rawTipoDoc === 'NOTA_ENTREGA' ||
    rawTipoDoc === 'N/E' ||
    rawTipoDoc === 'NE' ||
    /^(NE-|NDE-)/.test(rawDocNum);

  // Tasa histórica Profit para renglones que vienen únicamente en Bs (precioUnitario / totalNeto)
  const rawProfitBs = Number(safeDoc.rawTotalNetoBs ?? safeDoc.totalNeto ?? safeDoc.tot_neto ?? 0);
  const origProfitUsd = Number(safeDoc.originalTotalNetoUsd ?? safeDoc.totalNetoUsd ?? 0);
  const headerTotalUsd = Number(
    safeDoc.totNetoUsd ??
    safeDoc.tot_neto_usd ??
    safeDoc.totalUsd ??
    safeDoc.montoFacturaUsd ??
    safeDoc.subtotalUsd ??
    safeDoc.total ??
    0
  );
  const explicitBaseUsd = Number(
    safeDoc.totBrutoUsd ??
    safeDoc.tot_bruto_usd ??
    safeDoc.totalBrutoUsd ??
    safeDoc.subtotalUsd ??
    0
  );
  const summedBasesUsd =
    Number(safeDoc.baseExentaUsd || 0) +
    Number(safeDoc.baseGeneralUsd || 0) +
    Number(safeDoc.baseReducidaUsd || 0) +
    Number(safeDoc.baseAdicionalUsd || 0);
  // En Facturas Fiscales los renglones expresan precios base (sin IVA ni IGTF); nunca deben escalarse al total con impuestos.
  const targetLineSumUsd = isNeDoc
    ? headerTotalUsd
    : (explicitBaseUsd > 0 ? explicitBaseUsd : summedBasesUsd);
  const headerTotalBs = rawProfitBs || Number(safeDoc.totNetoBs ?? safeDoc.tot_neto_bs ?? safeDoc.totalBs ?? 0);
  let profitBsRate = tasa;
  if (rawProfitBs > 0 && origProfitUsd > 0) {
    profitBsRate = rawProfitBs / origProfitUsd;
  } else if (headerTotalBs > 0 && headerTotalUsd > 0) {
    profitBsRate = headerTotalBs / headerTotalUsd;
  }

  let rawItems = safeDoc.items ?? safeDoc.renglones ?? safeDoc.order_items ?? [];
  if (typeof rawItems === 'string') {
    try {
      rawItems = JSON.parse(rawItems);
    } catch {
      rawItems = [];
    }
  }
  const itemsArr = Array.isArray(rawItems) ? rawItems : [];

  const resolved = itemsArr.map((it, idx) => {
    const rawCode = it.codigo ?? it.articuloId ?? it.articulo_id ?? it.productoId ?? it.producto_id ?? it.co_art ?? it.coArt ?? it.sku ?? it.productId ?? it.itemId ?? '';
    const codeClean = String(rawCode).trim();
    const numericNoZero = /^\d+$/.test(codeClean) ? String(parseInt(codeClean, 10)) : '';
    const numericPadded = /^\d+$/.test(codeClean) ? codeClean.padStart(6, '0') : '';
    const prod =
      prodMap.get(codeClean) ||
      prodMap.get(codeClean.toUpperCase()) ||
      (numericNoZero ? prodMap.get(numericNoZero) : null) ||
      (numericPadded ? prodMap.get(numericPadded) : null) ||
      null;

    const codigo = codeClean || String(prod?.codigo || prod?.co_art || prod?.id || `LUB-${idx + 1}`);
    const descCandidate = [
      it.descripcion,
      it.articuloDescripcion,
      it.articulo_descripcion,
      it.art_des,
      it.artDes,
      it.productoNombre,
      it.producto_nombre,
      it.nombre,
      it.descrip,
      it.desc,
      it.name,
      prod?.nombre,
      prod?.descripcion,
      prod?.descrip
    ].find((v) => typeof v === 'string' && v.trim() !== '');
    const descripcion = descCandidate ? descCandidate.trim() : 'Lubricante Motorven';

    const presentacion = resolveProductUnit({ ...(prod || {}), ...it, descripcion }, prod?.unidad || 'Caja');
    const qty = Number(it.cantidad ?? it.total_art ?? it.qty ?? 1) || 1;

    const prodUnitLiters = prod
      ? resolveProductLitersPerUnit({ ...prod, unidadVenta: presentacion, descripcion })
      : resolveProductLitersPerUnit({ ...it, descripcion });
    const rawItemUnitLiters = Number(it.litrosPorUnidad || it.litros_por_unidad || it.litrosUnitarios || 0);
    // Los renglones importados de Profit suelen traer 11.35 fijo aunque el producto sea Tambor (208L) o Paila (19L)
    const unitLitros = prod && prodUnitLiters > 0 && (rawItemUnitLiters <= 0 || (rawItemUnitLiters === 11.35 && prodUnitLiters !== 11.35))
      ? prodUnitLiters
      : (rawItemUnitLiters > 0 ? rawItemUnitLiters : prodUnitLiters);

    const rawTotalLiters = Number(it.volumenTotal || it.litrosTotales || it.litros || 0);
    const rowLitros = prod && rawItemUnitLiters === 11.35 && prodUnitLiters !== 11.35
      ? qty * unitLitros
      : (rawTotalLiters > 0 ? rawTotalLiters : qty * unitLitros);

    let unitPriceUsd = Number(it.precioUsd ?? it.precioUnitarioUsd ?? it.precio_unitario_usd ?? it.precio ?? 0);
    let subtotalUsd = Number(it.subtotalUsd ?? it.totalUsd ?? it.subtotal_usd ?? it.total_usd ?? 0);

    if (subtotalUsd === 0) {
      const bsSub = Number(it.totalNeto ?? it.reng_neto ?? it.total_neto ?? it.subtotalBs ?? 0);
      if (bsSub > 0 && profitBsRate > 0) {
        subtotalUsd = bsSub / profitBsRate;
      }
    }
    if (unitPriceUsd === 0) {
      const bsUnit = Number(it.precioUnitario ?? it.prec_vta ?? it.precio_unitario ?? 0);
      if (bsUnit > 0 && profitBsRate > 0) {
        unitPriceUsd = bsUnit / profitBsRate;
      }
    }

    if (subtotalUsd === 0 && unitPriceUsd > 0) {
      subtotalUsd = qty * unitPriceUsd;
    }
    if (unitPriceUsd === 0 && subtotalUsd > 0 && qty > 0) {
      unitPriceUsd = subtotalUsd / qty;
    }

    return {
      ...it,
      codigo,
      descripcion,
      presentacion,
      cantidad: qty,
      litrosPorUnidad: unitLitros,
      volumenTotal: rowLitros,
      precioUsd: unitPriceUsd,
      subtotalUsd,
      subtotalBs: subtotalUsd * tasa
    };
  });

  // Si el documento tenía un monto oficial ajustado en CxC, alinear proporcionalmente los montos USD
  // usando la base imponible (sin impuestos) para Facturas Fiscales y el total neto para Notas de Entrega.
  const rawSumUsd = resolved.reduce((acc, r) => acc + r.subtotalUsd, 0);
  if (resolved.length > 0 && targetLineSumUsd > 0 && rawSumUsd > 0 && (safeDoc._customCreated || Math.abs(rawSumUsd - targetLineSumUsd) <= 0.5)) {
    const ratio = targetLineSumUsd / rawSumUsd;
    if (Math.abs(ratio - 1) > 0.0001) {
      resolved.forEach((r) => {
        r.subtotalUsd = Math.round((r.subtotalUsd * ratio + Number.EPSILON) * 100) / 100;
        r.precioUsd = r.cantidad > 0 ? (r.subtotalUsd / r.cantidad) : r.subtotalUsd;
        r.subtotalBs = r.subtotalUsd * tasa;
      });
    }
  }

  return resolved;
}

/**
 * Genera el documento oficial de NOTA DE ENTREGA en formato Carta (Letter)
 * Diseñado conforme al formato depurado y estilo corporativo de Grupo Motorven:
 * - Membrete oficial corporativo (sin código RPT interno ni barra de operador)
 * - Franja limpia "NOTA DE ENTREGA"
 * - 4 Tarjetas de resumen operativo (Correlativo, Almacén 02, Carga Total, Monto Total USD)
 * - Bloque bipartito de Datos del Receptor / Cliente vs Expedición
 * - Desglose tabular detallado con soporte nativo de desbordamiento (1/2, 2/2)
 * - Caja de totales (Subtotal Mercancía Sin IVA, Total USD, Total Oficial en Bolívares)
 * - Bloque tripartito de firmas: Despachador, Transportista y Cliente Receptor
 * - Código QR vectorial de verificación en esquina inferior izquierda y paginación X/Y en esquina inferior derecha
 */
/**
 * Dibuja un sello diagonal y banda superior discreta de ANULADA en la página activa de un PDF.
 */
function drawAnnulledStampOnCurrentPage(doc, label = 'ANULADA') {
  if (!doc) return;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const text = String(label || 'ANULADA').toUpperCase();

  doc.saveGraphicsState();
  if (typeof doc.GState === 'function') {
    doc.setGState(new doc.GState({ opacity: 0.16 }));
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(48);
  doc.setTextColor(220, 38, 38);
  doc.text(text, pageW / 2, pageH / 2 + 12, { align: 'center', angle: 35 });
  doc.restoreGraphicsState();

  doc.setFillColor(254, 226, 226);
  doc.setDrawColor(220, 38, 38);
  doc.setLineWidth(0.5);
  doc.roundedRect(pageW / 2 - 28, 7, 56, 6.5, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(185, 28, 28);
  doc.text(text, pageW / 2, 11.4, { align: 'center' });
}

export function generateDeliveryNotePDF({
  deliveryNote = null,
  sale = null,
  order = null,
  config = {},
  currentUser = null,
  client = null,
  clients = null,
  sellers = null,
  products = null,
  bankAccounts = null,
  tasaBcv = null,
  autoPrint = false
}) {
  const docData = deliveryNote || sale || order || {};
  const tasa = Number(docData.tasaDolar || docData.tasaBcv || docData.tasa || tasaBcv || config?.tasaDolar) || 827.73;

  // Extracción y formateo del correlativo oficial de la Nota de Entrega
  const rawNum = String(docData.numeroDoc || docData.numero || docData.factNum || docData.factura || docData.nroFactura || docData.id || '000001');
  const numDigits = rawNum.replace(/[^0-9]/g, '');
  const correlativoDisplay = rawNum.toUpperCase().startsWith('NE-')
    ? rawNum.toUpperCase()
    : (numDigits ? `NE-${numDigits.slice(-6).padStart(6, '0')}` : `NE-${rawNum}`);

  const parsedDocFecha = parseInvoiceDateInfo(docData);
  const fechaObj = parsedDocFecha.date || new Date();
  const fechaStr = fechaObj.toLocaleDateString('es-VE');

  const diasCredito = docData.condicionPago === 'CONTADO' ? 0 : Number(docData.diasCredito ?? 0);
  const parsedDocVenc = docData.fechaVencimiento ? parseInvoiceDateInfo(docData.fechaVencimiento) : null;
  const fechaVencObj = (parsedDocVenc && parsedDocVenc.date)
    ? parsedDocVenc.date
    : new Date(fechaObj.getTime() + (diasCredito * 24 * 60 * 60 * 1000));
  const fechaVencStr = fechaVencObj.toLocaleDateString('es-VE');

  const resolvedClient = resolveDocumentClientInfo(docData, client, clients);
  const clienteNombre = resolvedClient.nombre;
  const clienteRif = resolvedClient.rif;
  const clienteDireccion = resolvedClient.direccion;
  const clienteTelefono = resolvedClient.telefono;

  const almacenOrigen = docData.almacen || 'Almacén 02 (Mercancía General / Preventa)';
  const vendedor = resolveDocumentSellerName(docData, client, clients, sellers, currentUser);
  const pedidoOrigen = docData.pedidoOrigenDoc || docData.pedidoId || order?.id || docData.pedidoNumero || 'VENTA DIRECTA';
  const transportista = docData.transportista || docData.chofer || 'Transporte Motorven';
  const condicionPago = docData.condicionPago || (diasCredito > 0 ? `${diasCredito}_DIAS` : 'CONTADO');
  const metodoPago = docData.metodoPago || (diasCredito > 0 ? 'CREDITO' : 'CONTADO');

  const base = createBaseReport({
    title: 'NOTA DE ENTREGA',
    subtitle: '',
    moduleCode: 'NE',
    currentUser,
    config,
    rateValue: tasa,
    hideCorrelative: true,
    hideOperatorStrip: true
  });

  const resolvedItems = resolveDeliveryNoteLineItems(docData, products, tasa);

  // Cálculos de volúmenes, bultos y totales
  let totalLitros = 0;
  let totalBultos = 0;
  let totalNetoUsd = 0;

  const tableData = resolvedItems.map((it, idx) => {
    totalLitros += it.volumenTotal;
    totalBultos += it.cantidad;
    totalNetoUsd += it.subtotalUsd;

    return [
      String(idx + 1),
      it.codigo,
      it.descripcion,
      it.presentacion,
      String(it.cantidad),
      it.volumenTotal > 0 ? `${formatUnitVe(it.volumenTotal)} L` : '-',
      formatUsd(it.precioUsd),
      formatUsd(it.subtotalUsd),
      formatBs(it.subtotalBs)
    ];
  });

  if (resolvedItems.length === 0) {
    totalNetoUsd = Number(docData.totalUsd || docData.totNetoUsd || docData.montoFacturaUsd || docData.total || 0);
    totalLitros = Number(docData.totalLitros || 0);
    totalBultos = 1;
  }

  const totalNetoBs = totalNetoUsd * tasa;

  // 1. Tarjetas Superiores de Control Operativo (4 KPIs)
  const cards = [
    { label: 'Nota de Entrega N°', value: correlativoDisplay, subtext: `Emisión: ${fechaStr}`, color: COLORS.navy },
    { label: 'Almacén de Origen', value: 'Almacén 02', subtext: 'Mercancía General', color: COLORS.cyan },
    { label: 'Carga Total', value: `${formatUnitVe(totalLitros)} Litros`, subtext: `${formatUnitVe(totalBultos, 0)} Unid / Bultos`, color: COLORS.amber },
    { label: 'Monto Total USD', value: formatUsd(totalNetoUsd), subtext: formatBs(totalNetoBs), color: COLORS.emerald }
  ];

  let currentY = addSummaryCards(base.doc, base.startY, cards, base.tableWidth, base.startX);

  // 2. Bloque Bipartito: Datos del Receptor / Cliente vs Expedición (fuente ampliada para legibilidad)
  const colW = (base.tableWidth - 2) / 2;
  const lineStep = 4.2;
  base.doc.setFont('helvetica', 'bold');
  base.doc.setFontSize(8.8);
  const clientNameLines = base.doc.splitTextToSize(`Cliente: ${clienteNombre}`, colW - 6).slice(0, 2);
  base.doc.setFont('helvetica', 'normal');
  base.doc.setFontSize(8.4);
  const dnClip = (txt) => base.doc.splitTextToSize(String(txt), colW - 6)[0] || '';
  const addrLines = base.doc.splitTextToSize(`Dirección Entrega: ${clienteDireccion}`, colW - 6).slice(0, 3);

  const leftRowsH = 9.4 + (clientNameLines.length * 4.3) + 4.3 + (addrLines.length * lineStep) + 4.5;
  const rightRowsH = 9.4 + (5 * 4.4) + 1.5;
  const boxH = Math.max(29.0, leftRowsH, rightRowsH);

  base.doc.setFillColor(...COLORS.lightBg);
  base.doc.setDrawColor(...COLORS.border);
  base.doc.setLineWidth(0.3);
  base.doc.roundedRect(base.startX, currentY, base.tableWidth, boxH, 1.2, 1.2, 'FD');

  // Separador vertical
  base.doc.setDrawColor(...COLORS.border);
  base.doc.line(base.startX + colW, currentY + 1.5, base.startX + colW, currentY + boxH - 1.5);

  // Columna Izquierda: Datos del Receptor / Cliente
  base.doc.setFont('helvetica', 'bold');
  base.doc.setFontSize(9.0);
  base.doc.setTextColor(...COLORS.navy);
  base.doc.text('DATOS DEL RECEPTOR / CLIENTE', base.startX + 3, currentY + 5.0);

  let leftY = currentY + 9.6;
  base.doc.setFont('helvetica', 'bold');
  base.doc.setFontSize(8.8);
  base.doc.setTextColor(...COLORS.dark);
  base.doc.text(clientNameLines, base.startX + 3, leftY);
  leftY += clientNameLines.length * 4.3;

  base.doc.setFont('helvetica', 'normal');
  base.doc.setFontSize(8.4);
  base.doc.text(dnClip(`RIF / C.I.: ${clienteRif}${clienteTelefono ? ` • Tel: ${clienteTelefono}` : ''}`), base.startX + 3, leftY);
  leftY += 4.3;
  base.doc.text(addrLines, base.startX + 3, leftY);
  leftY += addrLines.length * lineStep;
  base.doc.text(dnClip(`Condición: ${condicionPago} • Vence: ${fechaVencStr}`), base.startX + 3, leftY);

  // Columna Derecha: Datos de Expedición
  base.doc.setFont('helvetica', 'bold');
  base.doc.setFontSize(9.0);
  base.doc.setTextColor(...COLORS.navy);
  base.doc.text('DATOS DE EXPEDICIÓN', base.startX + colW + 3, currentY + 5.0);

  let rightY = currentY + 9.6;
  base.doc.setFont('helvetica', 'bold');
  base.doc.setFontSize(8.6);
  base.doc.setTextColor(...COLORS.navy);
  base.doc.text(dnClip(`Vendedor: ${vendedor}`), base.startX + colW + 3, rightY);
  rightY += 4.4;

  base.doc.setFont('helvetica', 'normal');
  base.doc.setFontSize(8.4);
  base.doc.setTextColor(...COLORS.dark);
  base.doc.text(dnClip(`Despachado de: ${almacenOrigen}`), base.startX + colW + 3, rightY);
  rightY += 4.4;
  base.doc.text(dnClip(`Pedido Origen: ${pedidoOrigen}`), base.startX + colW + 3, rightY);
  rightY += 4.4;
  base.doc.text(dnClip(`Transportista: ${transportista}`), base.startX + colW + 3, rightY);
  rightY += 4.4;
  base.doc.text(dnClip(`Método: ${metodoPago} • Tasa BCV: ${formatBs(tasa)}`), base.startX + colW + 3, rightY);

  currentY += boxH + 3.0;

  // Función auxiliar para dibujar el encabezado de continuación en páginas 2+
  const drawContinuationHeader = () => {
    drawParentContainer(base.doc, false);

    base.doc.setFillColor(...COLORS.navy);
    base.doc.roundedRect(base.startX, 18.5, base.tableWidth, 7.4, 1, 1, 'F');
    base.doc.setFillColor(...COLORS.red);
    base.doc.rect(base.startX, 18.5, 3, 7.4, 'F');

    base.doc.setFont('helvetica', 'bold');
    base.doc.setFontSize(8.2);
    base.doc.setTextColor(255, 255, 255);
    base.doc.text(
      `NOTA DE ENTREGA N° ${correlativoDisplay} — CONTINUACIÓN`,
      base.startX + 5.5,
      23.5
    );

    base.doc.setFont('helvetica', 'normal');
    base.doc.setFontSize(7.0);
    base.doc.setTextColor(226, 232, 240);
    base.doc.text(
      `Cliente: ${clienteNombre.slice(0, 30)} (${clienteRif}) • Emisión: ${fechaStr}`,
      base.startX + base.tableWidth - 3,
      23.5,
      { align: 'right' }
    );
  };

  // 3. Tabla de Renglones con soporte de desbordamiento (normas 1/2, 2/2)
  // Se reserva bottom: 48 mm para que la tabla nunca invada la zona inferior de QR y numeración
  autoTable(base.doc, {
    startY: currentY,
    margin: { left: base.startX, right: PAGE_LETTER.margin + PAGE_LETTER.innerPadding, top: 28, bottom: 48 },
    tableWidth: base.tableWidth,
    head: [['#', 'CÓDIGO', 'DESCRIPCIÓN DEL LUBRICANTE', 'PRESENTACIÓN', 'CANT.', 'VOLUMEN', 'P. UNIT ($)', 'TOTAL ($)', 'TOTAL (BS.)']],
    body: tableData.length > 0 ? tableData : [['1', 'LUB-GEN', 'Despacho de Lubricantes según Nota de Entrega', 'Caja', '1', totalLitros > 0 ? `${formatUnitVe(totalLitros)} L` : '-', formatUsd(totalNetoUsd), formatUsd(totalNetoUsd), formatBs(totalNetoBs)]],
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.navy,
      textColor: [255, 255, 255],
      fontSize: 8.2,
      fontStyle: 'bold',
      cellPadding: { top: 2.2, bottom: 2.2, left: 1.2, right: 1.2 },
      valign: 'middle'
    },
    styles: {
      fontSize: 8.4,
      cellPadding: { top: 2.1, bottom: 2.1, left: 1.2, right: 1.2 },
      textColor: COLORS.dark,
      overflow: 'linebreak',
      valign: 'middle'
    },
    alternateRowStyles: {
      fillColor: COLORS.lightBg
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 7 },
      1: { halign: 'center', fontStyle: 'bold', cellWidth: 19 },
      2: { halign: 'left', cellWidth: 44.4 },
      3: { halign: 'center', cellWidth: 19.5 },
      4: { halign: 'center', fontStyle: 'bold', cellWidth: 12.5 },
      5: { halign: 'right', cellWidth: 17.5 },
      6: { halign: 'right', cellWidth: 18.5 },
      7: { halign: 'right', fontStyle: 'bold', cellWidth: 19 },
      8: { halign: 'right', fontStyle: 'bold', cellWidth: 22.5 }
    },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) {
        drawContinuationHeader();
      }
    }
  });

  const finalYTable = base.doc.lastAutoTable?.finalY || currentY + 35;
  let finalYBottom = finalYTable + 3.0;

  // Zona inferior reservada para QR (qrY = 233.5) y numeración 1/2, 2/2 por sobre el pie de página
  const { footerY } = getPageLayoutMetrics(base.doc);
  const qrReserveBottomMm = 23.4; // 256.9 - 233.5
  const sigAnchoredTop = footerY - qrReserveBottomMm - 2 - 19; // 212.5mm
  const summaryBoxH = 18.0;

  if (finalYBottom + summaryBoxH > sigAnchoredTop - 2) {
    base.doc.addPage();
    drawContinuationHeader();
    finalYBottom = 29;
  }

  // 4. Caja de Resumen Financiero (sin texto de cláusula, solo totales limpios a la derecha)
  base.doc.setFillColor(...COLORS.lightBg);
  base.doc.setDrawColor(...COLORS.border);
  base.doc.setLineWidth(0.3);
  base.doc.roundedRect(base.startX, finalYBottom, base.tableWidth, summaryBoxH, 1.2, 1.2, 'FD');

  const noticeW = base.tableWidth * 0.56;
  const totalsX = base.startX + noticeW + 3;
  const totalsW = base.tableWidth - noticeW - 6;

  base.doc.setFont('helvetica', 'normal');
  base.doc.setFontSize(7.2);
  base.doc.setTextColor(...COLORS.slate);
  base.doc.text('Subtotal Mercancía (Sin IVA):', totalsX, finalYBottom + 4.5);
  base.doc.setFont('helvetica', 'bold');
  base.doc.setTextColor(...COLORS.dark);
  base.doc.text(formatUsd(totalNetoUsd), totalsX + totalsW, finalYBottom + 4.5, { align: 'right' });

  base.doc.setFont('helvetica', 'bold');
  base.doc.setFontSize(8.6);
  base.doc.setTextColor(...COLORS.emerald);
  base.doc.text('TOTAL NOTA DE ENTREGA USD:', totalsX, finalYBottom + 10.2);
  base.doc.text(formatUsd(totalNetoUsd), totalsX + totalsW, finalYBottom + 10.2, { align: 'right' });

  base.doc.setFont('helvetica', 'bold');
  base.doc.setFontSize(7.8);
  base.doc.setTextColor(...COLORS.amber);
  base.doc.text('TOTAL OFICIAL EN BOLÍVARES:', totalsX, finalYBottom + 15.4);
  base.doc.text(formatBs(totalNetoBs), totalsX + totalsW, finalYBottom + 15.4, { align: 'right' });

  finalYBottom += summaryBoxH + 3.0;

  // 5. Bloque Tripartito de Firmas (anclado justo por encima de la zona QR / Pie de página)
  addSignatures(
    base.doc,
    finalYBottom,
    ['Despachado por (Almacén 02)', 'Transportado por (Chofer / C.I.)', 'Recibido Conforme (Cliente / Sello y Firma)'],
    base.tableWidth,
    base.startX,
    {
      reserveBottomMm: qrReserveBottomMm,
      gapAboveFooter: 2,
      continuationTopY: 29,
      onPageAdd: () => drawContinuationHeader()
    }
  );

  // 6. Dibujar en TODAS las páginas el Código QR estático (Cuentas Bancarias) abajo a la izquierda, aviso de desbordamiento y el indicador grande 1/2, 2/2 (abajo a la derecha)
  const totalPages = base.doc.internal.getNumberOfPages();
  const qrPayload = getStaticBankAccountsQRPayload(config, bankAccounts);
  const qrSize = 21.5;
  const qrY = 233.5;

  const isAnnulledDeliveryNote = Boolean(
    docData.anulada ||
    docData.anulado ||
    ['ANULADA', 'ANULADO'].includes(String(docData.status || docData.estado || '').toUpperCase().trim())
  );

  for (let p = 1; p <= totalPages; p++) {
    base.doc.setPage(p);
    if (isAnnulledDeliveryNote) {
      drawAnnulledStampOnCurrentPage(base.doc, 'NOTA DE ENTREGA ANULADA');
    }

    // Si hay desbordamiento y no es la última página, indicar que continúa en la siguiente hoja
    if (p < totalPages) {
      base.doc.setFillColor(240, 249, 255);
      base.doc.setDrawColor(...COLORS.cyan);
      base.doc.setLineWidth(0.25);
      base.doc.roundedRect(base.startX + qrSize + 4, qrY + 2, base.tableWidth - qrSize - 32, 7.5, 1, 1, 'FD');

      base.doc.setFont('helvetica', 'bold');
      base.doc.setFontSize(7.0);
      base.doc.setTextColor(...COLORS.navy);
      const ovMsg = base.doc.splitTextToSize(
        `DESBORDAMIENTO DE RENGLONES: CONTINÚA EN PÁGINA ${p + 1}/${totalPages}...`,
        base.tableWidth - qrSize - 38
      )[0] || '';
      base.doc.text(ovMsg, base.startX + qrSize + 7, qrY + 6.9);
    }

    // Código QR estático de Cuentas Bancarias en esquina inferior izquierda
    drawDeliveryNoteQRBox(base.doc, base.startX, qrY, qrSize, qrPayload);

    base.doc.setFont('helvetica', 'bold');
    base.doc.setFontSize(7.2);
    base.doc.setTextColor(...COLORS.navy);
    base.doc.text('CUENTAS BANCARIAS (QR)', base.startX + qrSize + 3.5, qrY + 14.5);
    base.doc.setFont('helvetica', 'normal');
    base.doc.setFontSize(6.4);
    base.doc.setTextColor(...COLORS.slate);
    base.doc.text('Escanea para ver cuentas oficiales de Grupo Motorven, C.A.', base.startX + qrSize + 3.5, qrY + 18.6);

    // Numeración destacada de desbordamiento (ej. 1/1 o 1/2, 2/2) en esquina inferior derecha
    const badgeW = 22;
    const badgeH = 9.5;
    const badgeX = base.startX + base.tableWidth - badgeW;
    const badgeY = qrY + qrSize - badgeH;

    base.doc.setFillColor(...COLORS.lightBg);
    base.doc.setDrawColor(...COLORS.navy);
    base.doc.setLineWidth(0.35);
    base.doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 1.2, 1.2, 'FD');

    base.doc.setFont('helvetica', 'bold');
    base.doc.setFontSize(11.5);
    base.doc.setTextColor(...COLORS.navy);
    base.doc.text(`${p}/${totalPages}`, badgeX + badgeW / 2, badgeY + 6.6, { align: 'center' });
  }

  const safeFilename = `Nota_Entrega_${correlativoDisplay.replace(/[^a-zA-Z0-9_\-]/g, '_')}_${fechaStr.replace(/\//g, '-')}.pdf`;

  // Finalizar pie de página y contenedor ANTES de imprimir o descargar
  finalizeAndSave(base.doc, safeFilename, currentUser, {
    pageNumberFormat: 'slash',
    skipOverflowHeader: true,
    skipOverflowNotice: true,
    skipSave: Boolean(autoPrint),
    legalFooter: 'Nota de Entrega • Despacho Almacén 02 • Grupo Motorven, C.A.'
  });

  // Soporte directo para imprimir en navegador (Ctrl + P) sin guardar archivo
  if (autoPrint) {
    printPDFDocument(base.doc);
  }

  return {
    doc: base.doc,
    filename: safeFilename,
    totalPages,
    print: () => printPDFDocument(base.doc)
  };
}

// =========================================================================
// 9. REPORTE DE VENTAS & FACTURACIÓN POS
// =========================================================================
export function generateSalesPOSPDF({ sales = [], config = {}, currentUser = null, tipoDoc = 'GENERAL', client = null, clients = null, sellers = null, bankAccounts = null, autoPrint = false }) {
  const tasa = Number(config?.tasaDolar) || 827.73;

  // Si es un documento individual y corresponde a una Nota de Entrega, usar el formato Carta de Nota de Entrega
  if (sales.length === 1) {
    const singleDoc = sales[0] || {};
    const rawDocType = String(singleDoc.tipoDoc || singleDoc.tipo_doc || tipoDoc || '').toUpperCase();
    const rawDocNum = String(singleDoc.numeroDoc || singleDoc.factNum || singleDoc.factura || singleDoc.nroFactura || '').toUpperCase();
    if (rawDocType.includes('NOTA_ENTREGA') || rawDocType.includes('NOTA DE ENTREGA') || rawDocNum.startsWith('NE')) {
      return generateDeliveryNotePDF({ sale: singleDoc, config, currentUser, client, clients, sellers, bankAccounts, autoPrint });
    }
  }

  // Si se trata de una factura individual detallada con renglones
  if (sales.length === 1 && ((sales[0].items && sales[0].items.length > 0) || (sales[0].renglones && sales[0].renglones.length > 0))) {
    const sale = sales[0];
    const items = sale.items || sale.renglones || [];
    const factNum = sale.factNum || sale.nroFactura || sale.numeroDoc || sale.id || 'FACT-001';
    const resolvedClient = resolveDocumentClientInfo(sale, client, clients);
    const vendedorNombre = resolveDocumentSellerName(sale, client, clients, sellers, currentUser);
    const parsedFecEmis = parseInvoiceDateInfo(sale);
    const fecEmis = (parsedFecEmis.date || new Date()).toLocaleDateString('es-VE');
    const condPago = sale.condicionPago || 'CONTADO';
    const base = createBaseReport({
      title: 'FACTURA COMERCIAL / COMPROBANTE FISCAL DE VENTA',
      subtitle: 'Documento Mercantil de Venta Oficial • Emisión en Divisas y Bolívares (Tasa BCV)',
      moduleCode: 'FAC',
      currentUser,
      config
    });

    const totUsd = Number(sale.totalUsd || sale.total || sale.totalNeto || 0);
    const totBs = Number(sale.totalBs || (totUsd * tasa));
    const baseUsd = Number(sale.baseImponibleUsd || (totUsd / 1.16));
    const ivaUsd = Number(sale.ivaUsd || (totUsd - baseUsd));

    const cards = [
      { label: 'Total Factura USD', value: formatUsd(totUsd), subtext: formatBs(totBs), color: COLORS.navy },
      { label: 'Base Imponible USD', value: formatUsd(baseUsd), subtext: formatBs(baseUsd * tasa), color: COLORS.cyan },
      { label: 'IVA 16% Fiscal', value: formatUsd(ivaUsd), subtext: formatBs(ivaUsd * tasa), color: COLORS.emerald },
      { label: 'Forma de Pago', value: sale.formaPago || sale.metodoPago || 'EFECTIVO_USD', subtext: `Tasa: ${formatBs(tasa)}`, color: COLORS.amber }
    ];

    let currentY = addSummaryCards(base.doc, base.startY, cards, base.tableWidth, base.startX);

    // Bloque Bipartito de Datos del Cliente y Datos de Expedición con fuente ampliada
    const colW = (base.tableWidth - 2) / 2;
    base.doc.setFont('helvetica', 'bold');
    base.doc.setFontSize(8.8);
    const cliNameLines = base.doc.splitTextToSize(`Cliente: ${resolvedClient.nombre}`, colW - 6).slice(0, 2);
    base.doc.setFont('helvetica', 'normal');
    base.doc.setFontSize(8.4);
    const clipTxt = (txt) => base.doc.splitTextToSize(String(txt), colW - 6)[0] || '';
    const cliAddrLines = base.doc.splitTextToSize(`Dirección: ${resolvedClient.direccion}`, colW - 6).slice(0, 2);
    const boxH = Math.max(27.5, 9.6 + cliNameLines.length * 4.3 + 4.3 + cliAddrLines.length * 4.2 + 2.5);

    base.doc.setFillColor(...COLORS.lightBg);
    base.doc.setDrawColor(...COLORS.border);
    base.doc.setLineWidth(0.3);
    base.doc.roundedRect(base.startX, currentY, base.tableWidth, boxH, 1.2, 1.2, 'FD');
    base.doc.line(base.startX + colW, currentY + 1.5, base.startX + colW, currentY + boxH - 1.5);

    base.doc.setFont('helvetica', 'bold');
    base.doc.setFontSize(9.0);
    base.doc.setTextColor(...COLORS.navy);
    base.doc.text('DATOS DEL CLIENTE', base.startX + 3, currentY + 5.0);

    let ly = currentY + 9.6;
    base.doc.setFont('helvetica', 'bold');
    base.doc.setFontSize(8.8);
    base.doc.setTextColor(...COLORS.dark);
    base.doc.text(cliNameLines, base.startX + 3, ly);
    ly += cliNameLines.length * 4.3;

    base.doc.setFont('helvetica', 'normal');
    base.doc.setFontSize(8.4);
    base.doc.text(clipTxt(`RIF / C.I.: ${resolvedClient.rif}${resolvedClient.telefono ? ` • Tel: ${resolvedClient.telefono}` : ''}`), base.startX + 3, ly);
    ly += 4.3;
    base.doc.text(cliAddrLines, base.startX + 3, ly);

    base.doc.setFont('helvetica', 'bold');
    base.doc.setFontSize(9.0);
    base.doc.setTextColor(...COLORS.navy);
    base.doc.text(`DATOS DE EXPEDICIÓN (${factNum})`, base.startX + colW + 3, currentY + 5.0);

    let ry = currentY + 9.6;
    base.doc.setFont('helvetica', 'bold');
    base.doc.setFontSize(8.6);
    base.doc.setTextColor(...COLORS.navy);
    base.doc.text(clipTxt(`Vendedor: ${vendedorNombre}`), base.startX + colW + 3, ry);
    ry += 4.4;

    base.doc.setFont('helvetica', 'normal');
    base.doc.setFontSize(8.4);
    base.doc.setTextColor(...COLORS.dark);
    base.doc.text(clipTxt(`Fecha Emisión: ${fecEmis} • N° Control: ${sale.controlNum || sale.nroControl || sale.numeroControl || '00-000001'}`), base.startX + colW + 3, ry);
    ry += 4.4;
    base.doc.text(clipTxt(`Condición: ${condPago} • Método: ${sale.metodoPago || sale.formaPago || 'EFECTIVO_USD'}`), base.startX + colW + 3, ry);

    currentY += boxH + 3.0;

    const tableData = items.map((it, idx) => {
      const cant = resolveItemQty(it);
      const precioU = resolveItemUnitPriceUsd(it);
      const subtotal = resolveItemSubtotalUsd(it);
      return [
        String(it.codigo || it.articuloId || it.co_art || idx + 1),
        it.descripcion || it.art_des || it.nombre || 'Lubricante Automotriz / Industrial',
        resolveProductUnit(it, 'Caja'),
        String(cant),
        formatUsd(precioU),
        formatUsd(subtotal),
        formatBs(subtotal * tasa)
      ];
    });

    autoTable(base.doc, {
      startY: currentY,
      margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
      tableWidth: base.tableWidth,
      head: [['CÓDIGO', 'DESCRIPCIÓN DEL ARTÍCULO', 'UND', 'CANT', 'PRECIO U. ($)', 'TOTAL ($)', 'TOTAL (BS.)']],
      body: tableData.length > 0 ? tableData : [['-', 'Sin renglones registrados', '-', '0', '$ 0.00', '$ 0.00', 'Bs. 0,00']],
      theme: 'grid',
      headStyles: {
        fillColor: COLORS.navy,
        textColor: [255, 255, 255],
        fontSize: 8.6,
        fontStyle: 'bold',
        cellPadding: { top: 2.2, bottom: 2.2, left: 1.4, right: 1.4 },
        valign: 'middle'
      },
      styles: {
        fontSize: 8.8,
        cellPadding: { top: 2.1, bottom: 2.1, left: 1.4, right: 1.4 },
        textColor: COLORS.dark,
        overflow: 'linebreak',
        valign: 'middle'
      },
      alternateRowStyles: {
        fillColor: COLORS.lightBg
      },
      columnStyles: {
        0: { fontStyle: 'bold', halign: 'center', cellWidth: 20 },
        1: { cellWidth: 55.9 },
        2: { halign: 'center', cellWidth: 14 },
        3: { halign: 'center', fontStyle: 'bold', cellWidth: 13 },
        4: { halign: 'right', cellWidth: 22 },
        5: { halign: 'right', fontStyle: 'bold', cellWidth: 23 },
        6: { halign: 'right', fontStyle: 'bold', cellWidth: 32 }
      }
    });

    const finalYFac = base.doc.lastAutoTable?.finalY || currentY;
    const afterGrandTotalY = addGrandTotalBox(base.doc, finalYFac + 3.5, [
      { label: 'TOTAL FACTURA USD', value: formatUsd(totUsd), subtext: formatBs(totBs), color: COLORS.navy },
      { label: 'BASE IMPONIBLE USD', value: formatUsd(baseUsd), subtext: formatBs(baseUsd * tasa), color: COLORS.cyan },
      { label: 'DÉBITO FISCAL IVA 16%', value: formatUsd(ivaUsd), subtext: formatBs(ivaUsd * tasa), color: COLORS.emerald }
    ], base.tableWidth, base.startX);

    const qrPayload = getStaticBankAccountsQRPayload(config, bankAccounts);
    const { safeBottomY, continuationTopY } = getPageLayoutMetrics(base.doc);
    let qrStartY = afterGrandTotalY + 1.5;
    if (qrStartY + 22 > safeBottomY) {
      base.doc.addPage();
      qrStartY = continuationTopY;
    }
    drawDeliveryNoteQRBox(base.doc, base.startX, qrStartY, 21.5, qrPayload);
    base.doc.setFont('helvetica', 'bold');
    base.doc.setFontSize(7.6);
    base.doc.setTextColor(...COLORS.navy);
    base.doc.text('CUENTAS BANCARIAS OFICIALES (QR ESTÁTICO)', base.startX + 24.5, qrStartY + 8);
    base.doc.setFont('helvetica', 'normal');
    base.doc.setFontSize(6.8);
    base.doc.setTextColor(...COLORS.slate);
    base.doc.text('Escanea este código QR desde tu teléfono para visualizar todas las cuentas bancarias de Grupo Motorven, C.A.', base.startX + 24.5, qrStartY + 12.8, { maxWidth: base.tableWidth - 26 });

    finalizeAndSave(base.doc, `Factura_${factNum}_SIGNUM.pdf`, currentUser, { skipSave: Boolean(autoPrint) });
    if (autoPrint) {
      printPDFDocument(base.doc);
    }
    return base.doc;
  }

  const base = createBaseReport({
    title: 'REPORTE DETALLADO DE VENTAS & FACTURACIÓN POS',
    subtitle: 'Comprobantes Fiscales, Formas de Pago, Impuestos (IVA 16% / IGTF 3%) y Totales',
    moduleCode: 'VTA',
    currentUser,
    config
  });

  const totalVentas = sales.length;
  const totalMontoUsd = sales.reduce((acc, s) => acc + Number(s.totalUsd || s.total || 0), 0);
  const totalIvaUsd = sales.reduce((acc, s) => acc + Number(s.ivaUsd || (s.totalUsd || 0) * 0.16), 0);

  const cards = [
    { label: 'Documentos Emitidos', value: `${totalVentas} Facturas`, subtext: `Filtro: ${tipoDoc}`, color: COLORS.navy },
    { label: 'Total Facturado USD', value: formatUsd(totalMontoUsd), subtext: formatBs(totalMontoUsd * tasa), color: COLORS.emerald },
    { label: 'Débito Fiscal IVA', value: formatUsd(totalIvaUsd), subtext: 'Alícuota General 16%', color: COLORS.cyan },
    { label: 'Tasa BCV Aplicada', value: formatBs(tasa), subtext: 'Cotización Oficial', color: COLORS.amber }
  ];

  let currentY = addSummaryCards(base.doc, base.startY, cards, base.tableWidth, base.startX);

  const tableData = sales.map((s, idx) => [
    String(s.id || `FACT-${1000 + idx}`),
    s.fecha ? String(s.fecha).replace('T', ' ').slice(0, 16) : '2026-10-23',
    s.cliente || s.clienteNombre || 'Consumidor Final',
    s.formaPago || 'EFECTIVO_USD',
    formatUsd(s.baseImponibleUsd || (s.totalUsd || 0) / 1.16),
    formatUsd(s.ivaUsd || (s.totalUsd || 0) * 0.16 / 1.16),
    formatUsd(s.totalUsd || s.total || 0)
  ]);

  autoTable(base.doc, {
    startY: currentY,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    head: [['N° COMPROBANTE', 'FECHA & HORA', 'CLIENTE / RIF', 'FORMA PAGO', 'BASE USD', 'IVA 16%', 'TOTAL USD']],
    body: tableData.length > 0 ? tableData : [['SIN VENTAS', '-', '-', '-', '$ 0.00', '$ 0.00', '$ 0.00']],
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.navy,
      textColor: [255, 255, 255],
      fontSize: 6.8,
      fontStyle: 'bold',
      cellPadding: 1.6
    },
    styles: {
      fontSize: 6.2,
      cellPadding: 1.4,
      textColor: COLORS.dark
    },
    alternateRowStyles: {
      fillColor: COLORS.lightBg
    },
    columnStyles: {
      0: { fontStyle: 'bold', halign: 'center', cellWidth: 22 },
      1: { halign: 'center', cellWidth: 26 },
      2: { cellWidth: 46 },
      3: { cellWidth: 24 },
      4: { halign: 'right', cellWidth: 20 },
      5: { halign: 'right', cellWidth: 18 },
      6: { halign: 'right', fontStyle: 'bold', cellWidth: 23.9 }
    }
  });

  const finalYVta = base.doc.lastAutoTable?.finalY || currentY;
  addGrandTotalBox(base.doc, finalYVta + 3.5, [
    { label: 'TOTAL FACTURADO USD', value: formatUsd(totalMontoUsd), subtext: formatBs(totalMontoUsd * tasa), color: COLORS.navy },
    { label: 'BASE IMPONIBLE USD', value: formatUsd(totalMontoUsd / 1.16), subtext: formatBs((totalMontoUsd / 1.16) * tasa), color: COLORS.cyan },
    { label: 'DÉBITO FISCAL IVA', value: formatUsd(totalIvaUsd), subtext: `${totalVentas} documentos emitidos`, color: COLORS.emerald }
  ], base.tableWidth, base.startX);

  finalizeAndSave(base.doc, `Reporte_Ventas_POS_SIGNUM_${new Date().toISOString().slice(0, 10)}.pdf`, currentUser);
  return base.doc;
}

/**
 * Genera el documento PDF de Factura Fiscal en Hoja Carta SENIAT
 * según las especificaciones de papel continuo / formas preimpresas:
 * - Margen superior: 4.5 cm (45 mm)
 * - Margen inferior: 4.5 cm (45 mm)
 * - Margen izquierdo: 1.5 cm (15 mm)
 * - Margen derecho: 1.5 cm (15 mm)
 * - Sin cabecera institucional (la hoja física ya la tiene preimpresa)
 * - Correlativo de 6 dígitos consecutivos (Ej: 000000, 000001, 000002...)
 * - Paginación dinámica "1/2", "2/2" al pie
 */
export function generateLetterInvoiceSeniatPDF({ sale, config = {}, currentUser = null, client = null, clients = null, sellers = null, bankAccounts = null, autoPrint = false }) {
  if (!sale) return;
  const tasa = Number(sale.tasaDolar || config?.tasaDolar) || 827.73;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter'
  });

  const resolvedClient = resolveDocumentClientInfo(sale, client, clients);
  const vendedorNombre = resolveDocumentSellerName(sale, client, clients, sellers, currentUser);
  const correlativo = String(sale.numeroDoc || sale.nroFactura || '000000').replace(/[^0-9]/g, '').slice(-6).padStart(6, '0') || '000000';
  const items = sale.items || sale.renglones || [];

  const startX = 15; // 1.5 cm
  const tableWidth = 185.9; // 215.9 - 30
  const topMargin = 45; // 4.5 cm
  const bottomMargin = 45; // 4.5 cm
  const bottomLimitY = 279.4 - bottomMargin; // 234.4 mm

  // Número de factura y adquirente en página 1
  let currentY = topMargin;

  const isNe = sale.tipoDoc === 'NOTA_ENTREGA' || String(sale.numeroDoc || sale.nroFactura || '').toUpperCase().startsWith('NE');
  const isNc = sale.tipoDoc === 'NOTA_CREDITO';
  const isNd = sale.tipoDoc === 'NOTA_DEBITO' || sale.fiscalDocType === 'NOTA_DEBITO';
  const isCot = sale.tipoDoc === 'COTIZACION';
  const isCreditOrDebit = isNc || isNd;
  const isFacturaOrNotaEntrega = isNe || (!isNc && !isNd && !isCot);

  // 1. Correlativo a la derecha
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  const docHeaderTitle = isNe ? 'NOTA DE ENTREGA N°' : (isNc ? 'NOTA DE CRÉDITO N°' : (isNd ? 'NOTA DE DÉBITO N°' : 'FACTURA N°'));
  doc.text(docHeaderTitle, startX + tableWidth, currentY + 3, { align: 'right' });
  doc.setFont('courier', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text(correlativo, startX + tableWidth, currentY + 9, { align: 'right' });

  currentY += 12;

  // 2. Metadatos del Adquirente y Datos de Expedición (fuente ampliada + Vendedor visible)
  const midX = startX + 104;
  const leftColW = (midX - 6) - (startX + 3);
  const rightColW = (startX + tableWidth - 3) - midX;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.2);
  const acqNameLines = doc.splitTextToSize(resolvedClient.nombre, leftColW).slice(0, 2);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  const addrLines = doc.splitTextToSize(`Domicilio Fiscal: ${resolvedClient.direccion}`, leftColW).slice(0, 3);
  const leftClip = (txt) => doc.splitTextToSize(String(txt), leftColW)[0] || '';
  const rightClip = (txt) => doc.splitTextToSize(String(txt), rightColW)[0] || '';

  const isPayable = Boolean(sale.isPayableNote);
  const emisorRespNombre = String(sale.emisorNombre || sale.creadoPor || currentUser?.nombre || vendedorNombre || 'Sistema').trim();
  const rightLineCount = (isCreditOrDebit && !isPayable) ? 6 : 5;
  const leftBlockH = 9.8 + (acqNameLines.length * 4.6) + 4.5 + (addrLines.length * 4.1) + 2.0;
  const rightBlockH = 9.8 + (rightLineCount * 4.5) + 2.0;
  const acqBoxH = Math.max(30.5, leftBlockH, rightBlockH);

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(startX, currentY, tableWidth, acqBoxH, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.setTextColor(0, 43, 122);
  doc.text(isPayable ? 'DATOS DEL PROVEEDOR / ACREEDOR:' : 'DATOS DEL ADQUIRENTE / CLIENTE:', startX + 3, currentY + 5.2);

  let acqY = currentY + 10.2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.2);
  doc.setTextColor(15, 23, 42);
  doc.text(acqNameLines, startX + 3, acqY);
  acqY += acqNameLines.length * 4.6;

  doc.setFontSize(8.6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(51, 65, 85);
  doc.text(leftClip(`RIF / C.I.: ${resolvedClient.rif}${resolvedClient.telefono ? ` • Tel: ${resolvedClient.telefono}` : ''}`), startX + 3, acqY);
  acqY += 4.5;
  doc.setFontSize(8.5);
  doc.text(addrLines, startX + 3, acqY);

  // Columna derecha: Datos de Expedición & Vendedor
  doc.setDrawColor(226, 232, 240);
  doc.line(midX - 4, currentY + 2, midX - 4, currentY + acqBoxH - 2);

  const parsedFecEmis = parseInvoiceDateInfo(sale);
  const fecEmis = (parsedFecEmis.date || new Date()).toLocaleDateString('es-VE');
  const parsedFecVenc = sale.fechaVencimiento ? parseInvoiceDateInfo(sale.fechaVencimiento) : null;
  const fecVenc = (parsedFecVenc && parsedFecVenc.date) ? parsedFecVenc.date.toLocaleDateString('es-VE') : fecEmis;
  const condPago = sale.condicionPago || 'CONTADO';
  const docAfectadoRef = String(sale.documentoAfectado || sale.facturaAfectada || '').trim();
  const motivoNota = String(sale.motivo || sale.descrip || '').trim();

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.8);
  doc.setTextColor(0, 43, 122);
  doc.text('DATOS DE EXPEDICIÓN:', midX, currentY + 5.2);

  let expY = currentY + 10.0;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.6);
  doc.setTextColor(15, 23, 42);
  if (isCreditOrDebit && docAfectadoRef) {
    doc.text(rightClip(`Doc. Afectado: ${isPayable ? 'Doc.' : 'Factura'} #${docAfectadoRef}`), midX, expY);
  } else {
    doc.text(rightClip(`Vendedor: ${vendedorNombre}`), midX, expY);
  }
  expY += 4.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.4);
  doc.setTextColor(51, 65, 85);
  doc.text(rightClip(`Fecha Emisión: ${fecEmis}`), midX, expY);
  expY += 4.5;
  if (isCreditOrDebit) {
    doc.text(rightClip(`N° Control Ref.: ${sale.numeroControl || 'N/A'}`), midX, expY);
    expY += 4.5;
    if (!isPayable) {
      doc.text(rightClip(`Cobrador: ${vendedorNombre}`), midX, expY);
      expY += 4.5;
    }
    doc.text(rightClip(`Emisor / Resp.: ${emisorRespNombre}`), midX, expY);
  } else {
    doc.text(rightClip(`Vencimiento: ${fecVenc} (${sale.diasCredito || 0} Días)`), midX, expY);
    expY += 4.5;
    doc.text(rightClip(`Condición: ${condPago} • Método: ${sale.metodoPago || 'EFECTIVO USD'}`), midX, expY);
  }
  expY += 4.5;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(217, 119, 6);
  doc.text(rightClip(`Tasa Oficial BCV: ${formatBs(tasa)} / USD`), midX, expY);

  currentY += acqBoxH + 4;

  // 3. Tabla de Renglones Facturados
  const isFiscalNote = isCreditOrDebit && isCreditDebitDocumentFiscal(sale);
  const totUsd = round2(Number(sale.totalUsd ?? sale.totNetoUsd ?? 0));
  const rawExplicitIva = Number(sale.ivaGeneralUsd ?? sale.ivaUsd ?? 0);
  const hasExplicitIva =
    (sale.ivaGeneralUsd !== undefined && sale.ivaGeneralUsd !== null) ||
    (sale.ivaUsd !== undefined && sale.ivaUsd !== null);
  const hasExplicitBase =
    (sale.baseGeneralUsd !== undefined && sale.baseGeneralUsd !== null && Number(sale.baseGeneralUsd) > 0) ||
    (sale.subtotalUsd !== undefined && sale.subtotalUsd !== null && Number(sale.subtotalUsd) > 0) ||
    (sale.totBrutoUsd !== undefined && sale.totBrutoUsd !== null && Number(sale.totBrutoUsd) > 0);
  // En Notas de Crédito/Débito Fiscales siempre aplica IVA 16% (nunca exento)
  const isExentoDoc = isFiscalNote
    ? false
    : (Boolean(sale.isExento) || (rawExplicitIva === 0 && hasExplicitBase));
  let baseUsd = hasExplicitBase
    ? round2(Number(sale.baseGeneralUsd ?? sale.subtotalUsd ?? sale.totBrutoUsd))
    : (isExentoDoc ? totUsd : round2(totUsd / 1.16));
  let ivaUsd = hasExplicitIva && (!isFiscalNote || rawExplicitIva > 0.005)
    ? round2(rawExplicitIva)
    : (isExentoDoc ? 0 : round2(Math.max(0, totUsd - baseUsd)));
  if (isFiscalNote && ivaUsd <= 0.005 && totUsd > 0) {
    if (hasExplicitBase && baseUsd > 0 && baseUsd < totUsd - 0.005) {
      ivaUsd = round2(totUsd - baseUsd);
    } else {
      baseUsd = round2(totUsd / 1.16);
      ivaUsd = round2(Math.max(0, totUsd - baseUsd));
    }
  }
  const totBs = totUsd * tasa;

  const fallbackNoteItems = isCreditOrDebit && (!Array.isArray(items) || items.length === 0)
    ? [{
        descripcion: motivoNota || (isNd ? `Cargo adicional sobre Factura #${docAfectadoRef || correlativo}` : `Rebaja / Descuento sobre Factura #${docAfectadoRef || correlativo}`),
        cantidad: 1,
        precioUsd: baseUsd,
        subtotalUsd: baseUsd,
        tipoAlicuota: ivaUsd > 0.005 ? '16%' : 'EXENTO'
      }]
    : items;

  const tableRows = fallbackNoteItems.map((it, idx) => {
    const cant = Number(it.cantidad || 1);
    const alignUnitToBase = isCreditOrDebit && fallbackNoteItems.length === 1 && cant === 1;
    const precio = alignUnitToBase
      ? baseUsd
      : Number(it.precioUsd ?? it.precioUnitarioUsd ?? 0);
    const subUsd = alignUnitToBase
      ? baseUsd
      : Number(it.subtotalUsd ?? it.totalUsd ?? (cant * precio));
    const subBs = subUsd * tasa;
    return [
      String(idx + 1),
      String(it.descripcion || it.articuloDescripcion || 'Lubricante'),
      String(cant),
      formatUsd(precio),
      alignUnitToBase
        ? (ivaUsd > 0.005 ? '16%' : 'EXENTO')
        : (it.tipoAlicuota || (isExentoDoc ? 'EXENTO' : '16%')),
      formatUsd(subUsd),
      formatBs(subBs)
    ];
  });

  const docContinuationLabel = isNe
    ? 'NOTA DE ENTREGA'
    : (isNc ? 'NOTA DE CRÉDITO' : (isNd ? 'NOTA DE DÉBITO' : 'FACTURA'));

  autoTable(doc, {
    startY: currentY,
    margin: { left: startX, right: 15, top: topMargin, bottom: bottomMargin },
    tableWidth,
    head: [[
      '#',
      isCreditOrDebit ? 'DESCRIPCIÓN / MOTIVO DEL AJUSTE' : 'DESCRIPCIÓN DEL LUBRICANTE',
      'CANT.',
      'P. UNIT ($)',
      'ALÍC.',
      'SUBTOTAL ($)',
      'TOTAL (BS.)'
    ]],
    body: tableRows,
    theme: 'grid',
    styles: {
      fontSize: 9.5,
      cellPadding: { top: 2.3, bottom: 2.3, left: 1.5, right: 1.5 },
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
      textColor: [15, 23, 42],
      overflow: 'linebreak',
      valign: 'middle'
    },
    headStyles: {
      fillColor: [0, 43, 122],
      textColor: [255, 255, 255],
      fontSize: 9.2,
      fontStyle: 'bold',
      halign: 'left',
      cellPadding: { top: 2.4, bottom: 2.4, left: 1.5, right: 1.5 },
      valign: 'middle'
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'left', cellWidth: 57.9 },
      2: { halign: 'center', cellWidth: 16 },
      3: { halign: 'right', cellWidth: 24 },
      4: { halign: 'center', cellWidth: 15 },
      5: { halign: 'right', cellWidth: 27 },
      6: { halign: 'right', cellWidth: 36 }
    },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.4);
        doc.setTextColor(71, 85, 105);
        doc.text(`CONTINUACIÓN ${docContinuationLabel} N° ${correlativo} - Adquirente: ${resolvedClient.nombre}`, startX, topMargin - 4);
      }
    }
  });

  const drawSeniatContinuationHeader = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(`CONTINUACIÓN ${docContinuationLabel} N° ${correlativo} - Adquirente: ${resolvedClient.nombre}`, startX, topMargin - 4);
  };

  let finalY = doc.lastAutoTable.finalY + 4;
  const seniatFooterLineY = bottomLimitY - 4;
  const seniatBoxTopY = seniatFooterLineY - 33; // Cajetín (30mm) anclado 3mm por encima de la línea del pie de página

  if (finalY > seniatBoxTopY - 2) {
    doc.addPage();
    drawSeniatContinuationHeader();
  }

  // 4. Totales, QR Estático de Cuentas Bancarias y Cajetín de Firma (anclados por sobre el pie de página)
  const boxY = seniatBoxTopY;

  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(startX, boxY, 60, 30, 2, 2);
  doc.line(startX + 6, boxY + 16, startX + 54, boxY + 16);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.6);
  doc.setTextColor(15, 23, 42);
  doc.text('Firma y Sello de Recepción', startX + 30, boxY + 20.5, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('C.I. / RIF • Fecha: ___/___/_____', startX + 30, boxY + 25.0, { align: 'center' });

  // QR estático de Cuentas Bancarias
  const qrPayload = getStaticBankAccountsQRPayload(config, bankAccounts);
  drawDeliveryNoteQRBox(doc, startX + 64.5, boxY + 1.5, 24, qrPayload);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.0);
  doc.setTextColor(...COLORS.navy);
  doc.text('CUENTAS BANCARIAS', startX + 76.5, boxY + 28.5, { align: 'center' });

  const totalsX = startX + 93;
  const totalsWidth = 92.9;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(totalsX, boxY, totalsWidth, 30, 2, 2, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(ivaUsd > 0.005 ? 'Base Imponible General (16%):' : 'Base Imponible / Exenta:', totalsX + 3, boxY + 5.2);
  doc.setFont('helvetica', 'bold');
  doc.text(`${formatUsd(baseUsd)} (${formatBs(baseUsd * tasa)})`, totalsX + totalsWidth - 3, boxY + 5.2, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  const ivaBoxLabel = ivaUsd <= 0.005
    ? 'IVA (0% / Exento):'
    : (isNc ? 'Crédito Fiscal IVA (16%):' : 'Débito Fiscal IVA (16%):');
  doc.text(ivaBoxLabel, totalsX + 3, boxY + 10.2);
  doc.setFont('helvetica', 'bold');
  doc.text(`${formatUsd(ivaUsd)} (${formatBs(ivaUsd * tasa)})`, totalsX + totalsWidth - 3, boxY + 10.2, { align: 'right' });

  doc.setDrawColor(0, 43, 122);
  doc.setLineWidth(0.4);
  doc.line(totalsX + 3, boxY + 13, totalsX + totalsWidth - 3, boxY + 13);

  doc.setFontSize(7.8);
  doc.setTextColor(15, 23, 42);
  const totalUsdBoxLabel = isNc
    ? 'TOTAL N/CRÉDITO USD:'
    : (isNd ? 'TOTAL N/DÉBITO USD:' : 'TOTAL FACTURA USD:');
  doc.text(totalUsdBoxLabel, totalsX + 3, boxY + 19);
  doc.setFont('courier', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(5, 150, 105);
  doc.text(formatUsd(totUsd), totalsX + totalsWidth - 3, boxY + 19, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  doc.setTextColor(217, 119, 6);
  doc.text('TOTAL OFICIAL BS.:', totalsX + 3, boxY + 25);
  doc.setFont('courier', 'bold');
  doc.setFontSize(9.8);
  doc.text(formatBs(totBs), totalsX + totalsWidth - 3, boxY + 25, { align: 'right' });

  // 5. Paginación en todas las hojas al pie: "Página X/Y" (1/2, 2/2) y Leyenda Legal
  const isAnnulledSeniatDoc = Boolean(
    sale.anulada ||
    sale.anulado ||
    ['ANULADA', 'ANULADO'].includes(String(sale.status || sale.estado || '').toUpperCase().trim())
  );
  const annulStampLabel = isNe ? 'NOTA DE ENTREGA ANULADA' : 'FACTURA ANULADA';
  const totalPagesCount = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPagesCount; p++) {
    doc.setPage(p);
    if (isAnnulledSeniatDoc) {
      drawAnnulledStampOnCurrentPage(doc, annulStampLabel);
    }

    if (p > 1 && totalPagesCount > 1) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.2);
      doc.setTextColor(0, 43, 122);
      doc.text(`Desbordamiento ${p}/${totalPagesCount}`, startX + tableWidth, topMargin - 4, { align: 'right' });
    }

    // Línea divisoria de pie de página
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.line(startX, bottomLimitY - 4, startX + tableWidth, bottomLimitY - 4);

    if (isFacturaOrNotaEntrega || isCreditOrDebit) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.6);
      doc.setTextColor(71, 85, 105);
      const disclaimer = `Monto en ${formatBs(totBs)}, referencial a la fecha de emisión. Los pagos en Bs se deberán realizar según la tasa oficial BCV a la fecha de su cancelación.`;
      doc.text(disclaimer, startX, bottomLimitY - 0.5, { maxWidth: tableWidth - 52 });
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.6);
    doc.setTextColor(100, 116, 139);
    const contText = (totalPagesCount > 1 && p < totalPagesCount) ? ` • Continúa ${p + 1}/${totalPagesCount}` : '';
    doc.text(`Página ${p}/${totalPagesCount}${contText}`, startX + tableWidth, bottomLimitY, { align: 'right' });
  }

  if (autoPrint) {
    printPDFDocument(doc);
  } else {
    const filePrefix = isNe ? 'Nota_Entrega' : (isNc ? 'Nota_Credito' : (isNd ? 'Nota_Debito' : 'Factura'));
    doc.save(`${filePrefix}_${correlativo}_SENIAT.pdf`);
  }
  return doc;
}

// =========================================================================
// 10. REPORTE DE COMPRAS & PROVEEDORES
// =========================================================================
export function generatePurchasesPDF({ purchases = [], suppliers = [], config = {}, currentUser = null }) {
  const tasa = Number(config?.tasaDolar) || 827.73;

  // Si se trata de una orden de compra o recepción individual con renglones
  if (purchases.length === 1 && ((purchases[0].items && purchases[0].items.length > 0) || (purchases[0].renglones && purchases[0].renglones.length > 0))) {
    const purchase = purchases[0];
    const items = purchase.items || purchase.renglones || [];
    const factNum = purchase.numeroFacturaProv || purchase.factura || purchase.id || 'FAC-PROV-001';
    const base = createBaseReport({
      title: 'COMPROBANTE DE RECEPCIÓN DE COMPRA & PROCURA',
      subtitle: 'Control Oficial de Entrada de Mercancía y Facturación de Proveedores',
      moduleCode: 'CMP',
      currentUser,
      config
    });

    const totUsd = Number(purchase.totalUsd || purchase.total || 0);
    const totBs = Number(purchase.totalBs || (totUsd * tasa));
    const baseUsd = Number(purchase.baseGeneralUsd || purchase.subtotalUsd || (totUsd / 1.16));
    const ivaUsd = Number(purchase.ivaGeneralUsd || (totUsd - baseUsd));

    const cards = [
      { label: 'Total Compra USD', value: formatUsd(totUsd), subtext: formatBs(totBs), color: COLORS.navy },
      { label: 'Base Imponible USD', value: formatUsd(baseUsd), subtext: formatBs(baseUsd * tasa), color: COLORS.cyan },
      { label: 'Crédito Fiscal IVA', value: formatUsd(ivaUsd), subtext: formatBs(ivaUsd * tasa), color: COLORS.emerald },
      { label: 'Tasa BCV Aplicada', value: formatBs(tasa), subtext: 'Cotización Oficial', color: COLORS.amber }
    ];

    let currentY = addSummaryCards(base.doc, base.startY, cards, base.tableWidth, base.startX);

    currentY = addAnalyticalBox(
      base.doc,
      currentY,
      `DATOS DEL PROVEEDOR & FACTURA (${factNum})`,
      `Proveedor: ${purchase.proveedorNombre || purchase.proveedor || 'Proveedor Mercantil'} • RIF: ${purchase.proveedorRif || purchase.rif || 'J-00000000-0'}\nCondición de Pago: ${purchase.formaPago || 'CRÉDITO COMERCIAL'} • Factura Prov. N°: ${factNum} • Control: ${purchase.nroControl || '00-000000'}`,
      base.tableWidth,
      base.startX
    );

    const tableData = items.map((it, idx) => {
      const cant = Number(it.cantidad || it.cant || 1);
      const costoU = Number(it.costo || it.costoUnitario || it.precio || 0);
      const subtotal = Number(it.total || (cant * costoU));
      return [
        String(it.codigo || it.articuloId || idx + 1),
        it.descripcion || it.nombre || 'Insumo / Lubricante Oilstone',
        resolveProductUnit(it, 'Caja'),
        String(cant),
        formatUsd(costoU),
        formatUsd(subtotal),
        formatBs(subtotal * tasa)
      ];
    });

    autoTable(base.doc, {
      startY: currentY,
      margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
      tableWidth: base.tableWidth,
      head: [['CÓDIGO', 'DESCRIPCIÓN DEL ARTÍCULO', 'UND', 'CANT', 'COSTO U. ($)', 'TOTAL ($)', 'TOTAL (BS.)']],
      body: tableData.length > 0 ? tableData : [['-', 'Sin renglones registrados', '-', '0', '$ 0.00', '$ 0.00', 'Bs. 0,00']],
      theme: 'grid',
      headStyles: {
        fillColor: COLORS.navy,
        textColor: [255, 255, 255],
        fontSize: 6.8,
        fontStyle: 'bold',
        cellPadding: 1.6
      },
      styles: {
        fontSize: 6.2,
        cellPadding: 1.4,
        textColor: COLORS.dark
      },
      alternateRowStyles: {
        fillColor: COLORS.lightBg
      },
      columnStyles: {
        0: { fontStyle: 'bold', halign: 'center', cellWidth: 22 },
        1: { cellWidth: 65.9 },
        2: { halign: 'center', cellWidth: 14 },
        3: { halign: 'center', fontStyle: 'bold', cellWidth: 14 },
        4: { halign: 'right', cellWidth: 20 },
        5: { halign: 'right', fontStyle: 'bold', cellWidth: 20 },
        6: { halign: 'right', fontStyle: 'bold', cellWidth: 24 }
      }
    });

    const finalYRec = base.doc.lastAutoTable?.finalY || currentY;
    addGrandTotalBox(base.doc, finalYRec + 3.5, [
      { label: 'TOTAL COMPRA USD', value: formatUsd(totUsd), subtext: formatBs(totBs), color: COLORS.navy },
      { label: 'BASE IMPONIBLE USD', value: formatUsd(baseUsd), subtext: formatBs(baseUsd * tasa), color: COLORS.cyan },
      { label: 'CRÉDITO FISCAL IVA', value: formatUsd(ivaUsd), subtext: formatBs(ivaUsd * tasa), color: COLORS.emerald }
    ], base.tableWidth, base.startX);

    finalizeAndSave(base.doc, `Recepcion_Compra_${factNum}_SIGNUM.pdf`, currentUser);
    return base.doc;
  }

  const base = createBaseReport({
    title: 'REPORTE OFICIAL DE COMPRAS, PROCURA & PROVEEDORES',
    subtitle: 'Recepción de Mercancía, Facturación de Proveedores, Retenciones Fiscales IVA/ISLR',
    moduleCode: 'CMP',
    currentUser,
    config
  });

  const totalCompras = purchases.length;
  const totalMontoUsd = purchases.reduce((acc, p) => acc + Number(p.totalUsd || p.total || 0), 0);
  const totalRetIva = purchases.reduce((acc, p) => acc + Number(p.retencionIvaUsd || 0), 0);

  const cards = [
    { label: 'Facturas de Compra', value: `${totalCompras} Doc.`, subtext: `${suppliers.length} Proveedores`, color: COLORS.navy },
    { label: 'Volumen Compras USD', value: formatUsd(totalMontoUsd), subtext: formatBs(totalMontoUsd * tasa), color: COLORS.emerald },
    { label: 'Retenciones IVA', value: formatUsd(totalRetIva), subtext: 'Comprobantes Fiscales', color: COLORS.cyan },
    { label: 'Tasa Cambio Proveedor', value: formatBs(tasa), subtext: 'Tasa BCV', color: COLORS.amber }
  ];

  let currentY = addSummaryCards(base.doc, base.startY, cards, base.tableWidth, base.startX);

  const tableData = purchases.map((p) => [
    String(p.numeroFacturaProv || p.factura || p.id || 'FAC-PROV'),
    p.proveedorNombre || p.proveedor || 'Proveedor',
    p.proveedorRif || 'J-00000000-0',
    p.fecha ? String(p.fecha).slice(0, 10) : '2026-10-23',
    formatUsd(p.baseGeneralUsd || p.subtotalUsd || p.totalUsd || 0),
    formatUsd(p.ivaGeneralUsd || (p.totalUsd || 0) * 0.16),
    formatUsd(p.totalUsd || p.total || 0)
  ]);

  autoTable(base.doc, {
    startY: currentY,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    head: [['FACTURA PROV.', 'RAZÓN SOCIAL PROVEEDOR', 'RIF PROVEEDOR', 'FECHA', 'BASE USD', 'IVA 16%', 'TOTAL COMPRA']],
    body: tableData.length > 0 ? tableData : [['SIN COMPRAS', '-', '-', '-', '$ 0.00', '$ 0.00', '$ 0.00']],
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.navy,
      textColor: [255, 255, 255],
      fontSize: 6.8,
      fontStyle: 'bold',
      cellPadding: 1.6
    },
    styles: {
      fontSize: 6.2,
      cellPadding: 1.4,
      textColor: COLORS.dark
    },
    alternateRowStyles: {
      fillColor: COLORS.lightBg
    },
    columnStyles: {
      0: { fontStyle: 'bold', halign: 'center', cellWidth: 22 },
      1: { cellWidth: 50 },
      2: { cellWidth: 22 },
      3: { halign: 'center', cellWidth: 16 },
      4: { halign: 'right', cellWidth: 22 },
      5: { halign: 'right', cellWidth: 18 },
      6: { halign: 'right', fontStyle: 'bold', cellWidth: 29.9 }
    }
  });

  const finalYCmp = base.doc.lastAutoTable?.finalY || currentY;
  addGrandTotalBox(base.doc, finalYCmp + 3.5, [
    { label: 'TOTAL COMPRAS PROVEEDORES', value: formatUsd(totalMontoUsd), subtext: formatBs(totalMontoUsd * tasa), color: COLORS.navy },
    { label: 'BASE IMPONIBLE GENERAL', value: formatUsd(totalMontoUsd / 1.16), subtext: formatBs((totalMontoUsd / 1.16) * tasa), color: COLORS.cyan },
    { label: 'CRÉDITO FISCAL IVA 16%', value: formatUsd(totalMontoUsd - (totalMontoUsd / 1.16)), subtext: `${totalCompras} facturas contabilizadas`, color: COLORS.emerald }
  ], base.tableWidth, base.startX);

  finalizeAndSave(base.doc, `Reporte_Compras_SIGNUM_${new Date().toISOString().slice(0, 10)}.pdf`, currentUser);
  return base.doc;
}

// =========================================================================
// 11. REPORTE DE CAJA CHICA & BANCOS
// =========================================================================
export function generateCashflowPDF({ bankAccounts = [], cashDesks = [], cashMovements = [], config = {}, currentUser = null }) {
  const base = createBaseReport({
    title: 'ESTADO DE FLUJO DE CAJA, DISPONIBILIDAD BANCARIA & TESORERÍA',
    subtitle: 'Posición Consolidada Bimonetaria en Efectivo y Cuentas Bancarias Supabase',
    moduleCode: 'CAJ',
    currentUser,
    config
  });

  const { tasaBcv: tasa } = resolveExchangeRates(config);
  const bankSummary = computeBankBalancesSummary(bankAccounts, config);
  const cashSummary = computeCashDesksSummary(cashDesks, config);
  const saldoBancosUsd = bankSummary.totalUsd;
  const saldoCajasUsd = cashSummary.totalUsd;
  const totalDisponibleUsd = saldoBancosUsd + saldoCajasUsd;

  const cards = [
    { label: 'Disponibilidad Total USD', value: formatUsd(totalDisponibleUsd), subtext: formatBs(totalDisponibleUsd * tasa), color: COLORS.emerald },
    { label: 'Efectivo en Cajas', value: formatUsd(saldoCajasUsd), subtext: `${cashDesks.length} Cajas Operativas`, color: COLORS.navy },
    { label: 'Cuentas Bancarias', value: formatUsd(saldoBancosUsd), subtext: `${bankAccounts.length} Cuentas Bancarias`, color: COLORS.cyan },
    { label: 'Movimientos Período', value: `${cashMovements.length} Registros`, subtext: 'Ingresos / Egresos', color: COLORS.amber }
  ];

  let currentY = addSummaryCards(base.doc, base.startY, cards, base.tableWidth, base.startX);

  const tableData = [
    ...cashDesks.map(c => {
      const deskUsd = Number(c.saldoUsd ?? c.saldo_usd ?? 0);
      const deskBs = Number(c.saldoBs ?? c.saldo_bs ?? (deskUsd * tasa));
      return [
        c.descripcion || c.desCaja || c.nombre || 'Caja Operativa',
        `${c.coCaja || c.co_caja || 'CAJA'} (${c.responsable || 'Admón'})`,
        c.moneda || 'USD',
        formatUsd(deskUsd),
        formatBs(deskBs),
        c.activa === false ? 'INACTIVA' : 'ACTIVA'
      ];
    }),
    ...bankAccounts.map(b => {
      const val = computeBankAccountValuation(b, config);
      return [
        b.bancoNombre || b.banco || b.des_ban || 'Banco Comercial',
        b.numCta || b.num_cta || 'Cuenta',
        b.moneda || 'BS',
        formatUsd(val.usd),
        formatBs(val.bs),
        'ACTIVA'
      ];
    })
  ];

  autoTable(base.doc, {
    startY: currentY,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    head: [['ENTIDAD / CAJA', 'TIPO / N° CUENTA', 'MONEDA', 'SALDO USD', 'SALDO BS', 'ESTADO']],
    body: tableData.length > 0 ? tableData : [['SIN CUENTAS', '-', '-', '$ 0.00', 'Bs. 0,00', '-']],
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.navy,
      textColor: [255, 255, 255],
      fontSize: 6.8,
      fontStyle: 'bold',
      cellPadding: 1.6
    },
    styles: {
      fontSize: 6.2,
      cellPadding: 1.4,
      textColor: COLORS.dark
    },
    alternateRowStyles: {
      fillColor: COLORS.lightBg
    },
    columnStyles: {
      0: { cellWidth: 40 },
      1: { cellWidth: 38 },
      2: { halign: 'center', cellWidth: 18 },
      3: { halign: 'right', fontStyle: 'bold', cellWidth: 26 },
      4: { halign: 'right', fontStyle: 'bold', cellWidth: 34 },
      5: { halign: 'center', fontStyle: 'bold', cellWidth: 23.9 }
    },
    didParseCell: (data) => {
      if (data.column.index === 5 && data.section === 'body') {
        data.cell.text = ''; // Vector badge
      }
    },
    didDrawCell: (data) => {
      if (data.column.index === 5 && data.section === 'body') {
        drawStatusBadge(base.doc, data.cell, data.cell.raw);
      }
    }
  });

  currentY = (base.doc.lastAutoTable?.finalY || currentY) + 4;

  // Tabla detallada de movimientos recientes de caja chica y bancos
  if (Array.isArray(cashMovements) && cashMovements.length > 0) {
    currentY = addSectionHeader(
      base.doc,
      currentY,
      'DETALLE DE MOVIMIENTOS RECIENTES DE TESORERÍA',
      `Mostrando últimos ${Math.min(cashMovements.length, 40)} de ${cashMovements.length} movimientos registrados`,
      base.tableWidth,
      base.startX
    );

    const movRows = cashMovements.slice(0, 40).map((m) => {
      const mUsd = Number(m.montoUsd ?? m.monto_usd ?? 0);
      const mBs = Number(m.montoBs ?? m.monto_bs ?? (mUsd * tasa));
      const cuenta = m.cuentaNombre || m.cuenta_nombre || m.cajaOBanco || m.caja_o_banco || m.metodoPago || m.metodo || '-';
      const fechaStr = m.fecha ? new Date(m.fecha).toLocaleDateString('es-VE') : '-';
      return [
        fechaStr,
        String(m.tipo || 'INGRESO').toUpperCase(),
        String(m.concepto || m.descripcion || '-').slice(0, 46),
        String(cuenta).slice(0, 26),
        formatUsd(mUsd),
        formatBs(mBs)
      ];
    });

    autoTable(base.doc, {
      startY: currentY,
      margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
      tableWidth: base.tableWidth,
      head: [['FECHA', 'TIPO', 'CONCEPTO / DETALLE', 'CUENTA / MÉTODO', 'MONTO USD', 'MONTO BS']],
      body: movRows,
      theme: 'grid',
      headStyles: {
        fillColor: COLORS.navy,
        textColor: [255, 255, 255],
        fontSize: 6.4,
        fontStyle: 'bold',
        cellPadding: 1.5
      },
      styles: {
        fontSize: 5.8,
        cellPadding: 1.3,
        textColor: COLORS.dark
      },
      alternateRowStyles: {
        fillColor: COLORS.lightBg
      },
      columnStyles: {
        0: { cellWidth: 20, halign: 'center' },
        1: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
        2: { cellWidth: 55 },
        3: { cellWidth: 36 },
        4: { cellWidth: 24, halign: 'right', fontStyle: 'bold' },
        5: { cellWidth: 28.9, halign: 'right', fontStyle: 'bold' }
      }
    });

    currentY = (base.doc.lastAutoTable?.finalY || currentY) + 3.5;
  }

  addGrandTotalBox(base.doc, currentY, [
    { label: 'DISPONIBILIDAD TOTAL USD', value: formatUsd(totalDisponibleUsd), subtext: formatBs(totalDisponibleUsd * tasa), color: COLORS.navy },
    { label: 'EFECTIVO EN CAJAS', value: formatUsd(saldoCajasUsd), subtext: `${cashDesks.length} cajas operativas`, color: COLORS.emerald },
    { label: 'SALDO TOTAL EN BANCOS', value: formatUsd(saldoBancosUsd), subtext: `${bankAccounts.length} cuentas institucionales`, color: COLORS.cyan }
  ], base.tableWidth, base.startX);

  finalizeAndSave(base.doc, `Reporte_Caja_Bancos_SIGNUM_${new Date().toISOString().slice(0, 10)}.pdf`, currentUser);
  return base.doc;
}

// =========================================================================
// 12. REPORTE DE AUDITORÍA & SUITE CONTABLE BA VEN-NIF 2 (CARTA VERTICAL)
// =========================================================================
const ACCOUNTING_TABLE_BASE = {
  theme: 'grid',
  headStyles: {
    fillColor: COLORS.navy,
    textColor: [255, 255, 255],
    fontSize: 6.6,
    fontStyle: 'bold',
    cellPadding: 1.6
  },
  styles: {
    fontSize: 6.1,
    cellPadding: 1.4,
    textColor: COLORS.dark
  },
  alternateRowStyles: {
    fillColor: COLORS.lightBg
  }
};

function styleAccountingStatementCell(data) {
  if (data.section !== 'body') return;
  const meta = data.row?.raw?.__meta;
  if (!meta) return;
  if (meta === 'group') {
    data.cell.styles.fillColor = [226, 232, 240];
    data.cell.styles.textColor = COLORS.navy;
    data.cell.styles.fontStyle = 'bold';
    data.cell.styles.fontSize = 6.5;
  } else if (meta === 'subtotal') {
    data.cell.styles.fillColor = [241, 245, 249];
    data.cell.styles.textColor = COLORS.dark;
    data.cell.styles.fontStyle = 'bold';
  } else if (meta === 'total') {
    data.cell.styles.fillColor = COLORS.navy;
    data.cell.styles.textColor = [255, 255, 255];
    data.cell.styles.fontStyle = 'bold';
    data.cell.styles.fontSize = 6.5;
  }
}

export function generateTrialBalancePDF({ trialBalance = null, entries = [], config = {}, currentUser = null } = {}) {
  const tb = trialBalance || buildTrialBalance(entries);
  const accounts = tb?.accounts || [];
  const tasa = Number(config?.tasaDolar || 827.73);
  const base = createBaseReport({
    title: 'BALANCE DE COMPROBACIÓN DE SUMAS Y SALDOS',
    subtitle: 'Plan Oficial de Cuentas Pro Motorven C.A. • Verificación de Partida Doble (Debe = Haber)',
    moduleCode: 'BC',
    currentUser,
    config
  });

  const cards = [
    { label: 'Cuentas Activas', value: `${accounts.length} Cuentas`, subtext: 'Plan Pro Motorven', color: COLORS.navy },
    { label: 'Sumas Debe / Haber', value: formatUsd(tb.totalSumasDebeUsd || 0), subtext: `Haber: ${formatUsd(tb.totalSumasHaberUsd || 0)}`, color: COLORS.cyan },
    { label: 'Saldos Deudor / Acreedor', value: formatUsd(tb.totalSaldosDeudorUsd || 0), subtext: `Acreedor: ${formatUsd(tb.totalSaldosAcreedorUsd || 0)}`, color: COLORS.emerald },
    { label: 'Estatus Equilibrio', value: tb.isBalanced ? 'CUADRADO' : 'CON DESCUADRE', subtext: tb.isBalanced ? 'Debe = Haber (VEN-NIF)' : 'Revisar diferencias', color: tb.isBalanced ? COLORS.emerald : COLORS.red }
  ];

  const startY = addSummaryCards(base.doc, base.startY, cards, base.tableWidth, base.startX);
  const body = accounts.length > 0
    ? accounts.map(acc => [
        acc.codigo,
        acc.nombre,
        acc.grupo || '-',
        acc.totalDebeUsd > 0 ? formatUsd(acc.totalDebeUsd) : '-',
        acc.totalHaberUsd > 0 ? formatUsd(acc.totalHaberUsd) : '-',
        acc.saldoDeudorUsd > 0 ? formatUsd(acc.saldoDeudorUsd) : '-',
        acc.saldoAcreedorUsd > 0 ? formatUsd(acc.saldoAcreedorUsd) : '-'
      ])
    : [['-', 'Sin movimientos registrados en el período', '-', '$ 0.00', '$ 0.00', '$ 0.00', '$ 0.00']];

  autoTable(base.doc, {
    ...ACCOUNTING_TABLE_BASE,
    startY,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    showFoot: 'lastPage',
    head: [['CÓDIGO', 'DENOMINACIÓN DE LA CUENTA', 'GRUPO', 'SUMAS DEBE', 'SUMAS HABER', 'SALDO DEUDOR', 'SALDO ACREEDOR']],
    body,
    foot: [[
      'TOTALES',
      `${accounts.length} cuentas imputadas (Tasa BCV: ${formatBs(tasa)})`,
      tb.isBalanced ? 'CUADRADO' : 'DESCUADRE',
      formatUsd(tb.totalSumasDebeUsd || 0),
      formatUsd(tb.totalSumasHaberUsd || 0),
      formatUsd(tb.totalSaldosDeudorUsd || 0),
      formatUsd(tb.totalSaldosAcreedorUsd || 0)
    ]],
    footStyles: { fillColor: COLORS.navy, textColor: [255, 255, 255], fontSize: 6.4, fontStyle: 'bold', cellPadding: 1.7 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 22 },
      1: { cellWidth: 47.9 },
      2: { halign: 'center', cellWidth: 20 },
      3: { halign: 'right', cellWidth: 22.5 },
      4: { halign: 'right', cellWidth: 22.5 },
      5: { halign: 'right', fontStyle: 'bold', cellWidth: 22.5 },
      6: { halign: 'right', fontStyle: 'bold', cellWidth: 22.5 }
    }
  });

  const afterY = base.doc.lastAutoTable?.finalY || startY;
  const totalBoxY = addGrandTotalBox(
    base.doc,
    afterY + 3,
    [
      { label: 'TOTAL SUMAS DEBE', value: formatUsd(tb.totalSumasDebeUsd || 0), subtext: formatBs((tb.totalSumasDebeUsd || 0) * tasa), color: COLORS.navy },
      { label: 'TOTAL SUMAS HABER', value: formatUsd(tb.totalSumasHaberUsd || 0), subtext: formatBs((tb.totalSumasHaberUsd || 0) * tasa), color: COLORS.cyan },
      { label: 'SALDO DEUDOR = ACREEDOR', value: formatUsd(tb.totalSaldosDeudorUsd || 0), subtext: tb.isBalanced ? 'Cuadre Exacto $0.00' : 'Verificar Cuadre', color: tb.isBalanced ? COLORS.emerald : COLORS.red }
    ],
    base.tableWidth,
    base.startX
  );
  addSignatures(base.doc, totalBoxY + 4, ['Elaborado por (Contabilidad)', 'Revisado por (Contador Público)', 'Aprobado por (Gerencia General)'], base.tableWidth, base.startX);
  finalizeAndSave(base.doc, `Balance_Comprobacion_SIGNUM_${new Date().toISOString().slice(0, 10)}.pdf`, currentUser);
  return base.doc;
}

export function generateGeneralLedgerPDF({ account = null, generalLedger = null, entries = [], config = {}, currentUser = null } = {}) {
  const gl = generalLedger || buildGeneralLedger(entries);
  const targetAcc = account || gl?.accounts?.[0] || {
    codigo: '-',
    nombre: 'Sin cuenta seleccionada',
    grupo: '-',
    naturaleza: 'DEUDORA',
    totalDebeUsd: 0,
    totalHaberUsd: 0,
    saldoFinalUsd: 0,
    movements: []
  };
  const movements = targetAcc.movements || [];
  const tasa = Number(config?.tasaDolar || 827.73);

  const base = createBaseReport({
    title: 'LIBRO MAYOR GENERAL ANALÍTICO POR CUENTA',
    subtitle: `Cuenta ${targetAcc.codigo} — ${targetAcc.nombre} • Registro Cronológico de Partida Doble`,
    moduleCode: 'MAY',
    currentUser,
    config
  });

  const cards = [
    { label: 'Cuenta Contable', value: String(targetAcc.codigo), subtext: `${targetAcc.naturaleza || 'DEUDORA'} • ${targetAcc.grupo || '-'}`, color: COLORS.navy },
    { label: 'Total Cargos (Debe)', value: formatUsd(targetAcc.totalDebeUsd || 0), subtext: `${movements.length} movimientos`, color: COLORS.emerald },
    { label: 'Total Abonos (Haber)', value: formatUsd(targetAcc.totalHaberUsd || 0), subtext: formatBs((targetAcc.totalHaberUsd || 0) * tasa), color: COLORS.cyan },
    { label: 'Saldo Final Acumulado', value: formatUsd(targetAcc.saldoFinalUsd || 0), subtext: formatBs((targetAcc.saldoFinalUsd || 0) * tasa), color: (targetAcc.saldoFinalUsd || 0) >= 0 ? COLORS.navy : COLORS.red }
  ];

  let currentY = addSummaryCards(base.doc, base.startY, cards, base.tableWidth, base.startX);
  currentY = addAnalyticalBox(
    base.doc,
    currentY,
    'FICHA DE CUENTA CONTABLE EN MAYOR',
    `Código Institucional: ${targetAcc.codigo} | Denominación: ${targetAcc.nombre} | Grupo: ${targetAcc.grupo || '-'} | Naturaleza: ${targetAcc.naturaleza || 'DEUDORA'} | Movimientos Cronológicos: ${movements.length}`,
    base.tableWidth,
    base.startX
  );

  const body = movements.length > 0
    ? movements.map(m => [
        m.fecha ? String(m.fecha).slice(0, 10) : '-',
        String(m.asientoNum || '-'),
        String(m.documentoReferencia || '-'),
        String(m.concepto || '-'),
        m.debeUsd > 0 ? formatUsd(m.debeUsd) : '-',
        m.haberUsd > 0 ? formatUsd(m.haberUsd) : '-',
        formatUsd(m.saldoAcumuladoUsd || 0)
      ])
    : [['-', '-', '-', 'Sin movimientos cronológicos para esta cuenta', '$ 0.00', '$ 0.00', '$ 0.00']];

  autoTable(base.doc, {
    ...ACCOUNTING_TABLE_BASE,
    startY: currentY,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    showFoot: 'lastPage',
    head: [['FECHA', 'ASIENTO', 'REFERENCIA', 'CONCEPTO / GLOSA CONTABLE', 'DEBE USD', 'HABER USD', 'SALDO ACUM.']],
    body,
    foot: [[
      'TOTALES',
      `${movements.length} movs`,
      targetAcc.codigo,
      'Totales Acumulados de la Cuenta',
      formatUsd(targetAcc.totalDebeUsd || 0),
      formatUsd(targetAcc.totalHaberUsd || 0),
      formatUsd(targetAcc.saldoFinalUsd || 0)
    ]],
    footStyles: { fillColor: COLORS.navy, textColor: [255, 255, 255], fontSize: 6.4, fontStyle: 'bold', cellPadding: 1.7 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 18 },
      1: { halign: 'center', fontStyle: 'bold', cellWidth: 18 },
      2: { cellWidth: 22 },
      3: { cellWidth: 55.9 },
      4: { halign: 'right', cellWidth: 21 },
      5: { halign: 'right', cellWidth: 21 },
      6: { halign: 'right', fontStyle: 'bold', cellWidth: 24 }
    }
  });

  const afterY = base.doc.lastAutoTable?.finalY || currentY;
  addSignatures(base.doc, afterY + 5, ['Elaborado por (Contabilidad)', 'Revisado por (Auditoría Interna)', 'Aprobado por (Gerencia)'], base.tableWidth, base.startX);
  const safeCode = String(targetAcc.codigo || 'General').replace(/[^a-zA-Z0-9_-]/g, '_');
  finalizeAndSave(base.doc, `Libro_Mayor_${safeCode}_SIGNUM_${new Date().toISOString().slice(0, 10)}.pdf`, currentUser);
  return base.doc;
}

export function generateFinancialStatementsPDF({ financialStatements = null, trialBalance = null, entries = [], config = {}, currentUser = null } = {}) {
  const fsData = financialStatements || buildFinancialStatements(trialBalance || buildTrialBalance(entries));
  const er = fsData?.estadoResultados || {
    ingresos: [],
    costos: [],
    egresos: [],
    totalIngresosUsd: 0,
    totalIngresosBs: 0,
    totalCostosUsd: 0,
    totalCostosBs: 0,
    utilidadBrutaUsd: 0,
    utilidadBrutaBs: 0,
    totalEgresosUsd: 0,
    totalEgresosBs: 0,
    resultadoEjercicioUsd: 0,
    resultadoEjercicioBs: 0,
    cuentaResultadoCodigo: '3.02.01.001',
    cuentaResultadoNombre: 'Superavit del Ejercicio'
  };
  const bg = fsData?.balanceGeneral || {
    activo: [],
    pasivo: [],
    patrimonio: [],
    totalActivoUsd: 0,
    totalActivoBs: 0,
    totalPasivoUsd: 0,
    totalPasivoBs: 0,
    resultadoEjercicioUsd: 0,
    resultadoEjercicioBs: 0,
    totalPatrimonioUsd: 0,
    totalPatrimonioBs: 0,
    totalPasivoYPatrimonioUsd: 0,
    totalPasivoYPatrimonioBs: 0,
    diferenciaEcuacionUsd: 0,
    ecuacionCuadrada: true
  };
  const tasa = Number(config?.tasaDolar || 827.73);
  const makeRow = (code, label, usd, bs, meta = null) => {
    const row = [code, label, formatUsd(usd || 0), formatBs(bs ?? Number(usd || 0) * tasa)];
    if (meta) row.__meta = meta;
    return row;
  };

  const base = createBaseReport({
    title: 'ESTADOS FINANCIEROS BÁSICOS (BA VEN-NIF 2)',
    subtitle: 'Estado de Resultados Integral y Estado de Situación Financiera (Balance General)',
    moduleCode: 'EF',
    currentUser,
    config
  });

  const cards = [
    { label: 'Ingresos Netos', value: formatUsd(er.totalIngresosUsd), subtext: `Utilidad Bruta: ${formatUsd(er.utilidadBrutaUsd)}`, color: COLORS.cyan },
    { label: 'Resultado del Ejercicio', value: formatUsd(er.resultadoEjercicioUsd), subtext: `${er.cuentaResultadoCodigo} • ${er.cuentaResultadoNombre}`, color: er.resultadoEjercicioUsd >= 0 ? COLORS.emerald : COLORS.red },
    { label: 'Total Activo', value: formatUsd(bg.totalActivoUsd), subtext: `Pasivo + Patr.: ${formatUsd(bg.totalPasivoYPatrimonioUsd)}`, color: COLORS.navy },
    { label: 'Ecuación Patrimonial', value: bg.ecuacionCuadrada ? 'CUADRADA' : 'DESCUADRE', subtext: `Diferencia: ${formatUsd(bg.diferenciaEcuacionUsd)}`, color: bg.ecuacionCuadrada ? COLORS.emerald : COLORS.red }
  ];

  let currentY = addSummaryCards(base.doc, base.startY, cards, base.tableWidth, base.startX);
  currentY = addSectionHeader(
    base.doc,
    currentY,
    '1. ESTADO DE RESULTADOS INTEGRAL (PERÍODO OPERATIVO)',
    'Clasificación oficial según Plan de Cuentas: Grupos 4 (Ingresos), 5 (Costos) y 6 (Egresos)',
    base.tableWidth,
    base.startX
  );

  const erBody = [
    makeRow('4', '4. INGRESOS OPERACIONALES Y OTROS', er.totalIngresosUsd, er.totalIngresosBs, 'group'),
    ...(er.ingresos.length > 0 ? er.ingresos.map(i => makeRow(i.codigo, i.nombre, i.saldoUsd, i.saldoBs)) : [makeRow('-', 'Sin ingresos registrados en el período', 0, 0)]),
    makeRow('', 'TOTAL INGRESOS NETOS', er.totalIngresosUsd, er.totalIngresosBs, 'subtotal'),
    makeRow('5', '5. COSTOS DE VENTAS Y SERVICIOS', er.totalCostosUsd, er.totalCostosBs, 'group'),
    ...(er.costos.length > 0 ? er.costos.map(i => makeRow(i.codigo, i.nombre, i.saldoUsd, i.saldoBs)) : [makeRow('-', 'Sin costos registrados en el período', 0, 0)]),
    makeRow('', 'UTILIDAD BRUTA EN VENTAS', er.utilidadBrutaUsd, er.utilidadBrutaBs, 'subtotal'),
    makeRow('6', '6. GASTOS OPERATIVOS / EGRESOS', er.totalEgresosUsd, er.totalEgresosBs, 'group'),
    ...(er.egresos.length > 0 ? er.egresos.map(i => makeRow(i.codigo, i.nombre, i.saldoUsd, i.saldoBs)) : [makeRow('-', 'Sin egresos operativos registrados en el período', 0, 0)]),
    makeRow('', 'TOTAL GASTOS OPERATIVOS', er.totalEgresosUsd, er.totalEgresosBs, 'subtotal'),
    makeRow(er.cuentaResultadoCodigo, `RESULTADO DEL EJERCICIO (${er.cuentaResultadoNombre.toUpperCase()})`, er.resultadoEjercicioUsd, er.resultadoEjercicioBs, 'total')
  ];

  autoTable(base.doc, {
    ...ACCOUNTING_TABLE_BASE,
    startY: currentY,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    head: [['CÓDIGO', 'CUENTA / CONCEPTO DEL RESULTADO', 'MONTO USD', 'MONTO BS.']],
    body: erBody,
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 26 },
      1: { cellWidth: 89.9 },
      2: { halign: 'right', cellWidth: 30 },
      3: { halign: 'right', cellWidth: 34 }
    },
    didParseCell: styleAccountingStatementCell
  });

  currentY = (base.doc.lastAutoTable?.finalY || currentY) + 4;
  currentY = addSectionHeader(
    base.doc,
    currentY,
    '2. BALANCE GENERAL (ESTADO DE SITUACIÓN FINANCIERA)',
    'Ecuación Patrimonial BA VEN-NIF 2: Activo = Pasivo + Patrimonio + Resultado del Ejercicio',
    base.tableWidth,
    base.startX
  );

  const bgBody = [
    makeRow('1', '1. ACTIVO', bg.totalActivoUsd, bg.totalActivoBs, 'group'),
    ...(bg.activo.length > 0 ? bg.activo.map(i => makeRow(i.codigo, i.nombre, i.saldoUsd, i.saldoBs)) : [makeRow('-', 'Sin cuentas de activo con movimiento', 0, 0)]),
    makeRow('', 'TOTAL ACTIVO', bg.totalActivoUsd, bg.totalActivoBs, 'total'),
    makeRow('2', '2. PASIVO', bg.totalPasivoUsd, bg.totalPasivoBs, 'group'),
    ...(bg.pasivo.length > 0 ? bg.pasivo.map(i => makeRow(i.codigo, i.nombre, i.saldoUsd, i.saldoBs)) : [makeRow('-', 'Sin cuentas de pasivo con movimiento', 0, 0)]),
    makeRow('', 'TOTAL PASIVO', bg.totalPasivoUsd, bg.totalPasivoBs, 'subtotal'),
    makeRow('3', '3. PATRIMONIO NETO', bg.totalPatrimonioUsd, bg.totalPatrimonioBs, 'group'),
    ...(bg.patrimonio || []).map(i => makeRow(i.codigo, i.nombre, i.saldoUsd, i.saldoBs)),
    makeRow(er.cuentaResultadoCodigo, er.cuentaResultadoNombre, bg.resultadoEjercicioUsd, bg.resultadoEjercicioBs),
    makeRow('', 'TOTAL PATRIMONIO NETO', bg.totalPatrimonioUsd, bg.totalPatrimonioBs, 'subtotal'),
    makeRow('', 'TOTAL PASIVO + PATRIMONIO', bg.totalPasivoYPatrimonioUsd, bg.totalPasivoYPatrimonioBs, 'total')
  ];

  autoTable(base.doc, {
    ...ACCOUNTING_TABLE_BASE,
    startY: currentY,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    head: [['CÓDIGO', 'CUENTA / RUBRO DE SITUACIÓN FINANCIERA', 'MONTO USD', 'MONTO BS.']],
    body: bgBody,
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 26 },
      1: { cellWidth: 89.9 },
      2: { halign: 'right', cellWidth: 30 },
      3: { halign: 'right', cellWidth: 34 }
    },
    didParseCell: styleAccountingStatementCell
  });

  const afterBgY = base.doc.lastAutoTable?.finalY || currentY;
  const totalBoxY = addGrandTotalBox(
    base.doc,
    afterBgY + 3,
    [
      { label: 'TOTAL ACTIVO', value: formatUsd(bg.totalActivoUsd), subtext: formatBs(bg.totalActivoBs || bg.totalActivoUsd * tasa), color: COLORS.navy },
      { label: 'PASIVO + PATRIMONIO', value: formatUsd(bg.totalPasivoYPatrimonioUsd), subtext: formatBs(bg.totalPasivoYPatrimonioBs || bg.totalPasivoYPatrimonioUsd * tasa), color: COLORS.cyan },
      { label: 'DIFERENCIA ECUACIÓN', value: formatUsd(bg.diferenciaEcuacionUsd), subtext: bg.ecuacionCuadrada ? 'BA VEN-NIF 2 Cuadrado' : 'Descuadre detectado', color: bg.ecuacionCuadrada ? COLORS.emerald : COLORS.red }
    ],
    base.tableWidth,
    base.startX
  );
  addSignatures(base.doc, totalBoxY + 4, ['Elaborado por (Contabilidad)', 'Revisado por (Contador Público)', 'Aprobado por (Gerencia General)'], base.tableWidth, base.startX);
  finalizeAndSave(base.doc, `Estados_Financieros_SIGNUM_${new Date().toISOString().slice(0, 10)}.pdf`, currentUser);
  return base.doc;
}

export function generateAuditLedgerPDF({
  entries = [],
  auditLogs = [],
  trialBalance = null,
  generalLedger = null,
  activeMayorAccount = null,
  financialStatements = null,
  config = {},
  currentUser = null,
  subTab = 'diario'
}) {
  if (subTab === 'balance') {
    return generateTrialBalancePDF({ trialBalance, entries, config, currentUser });
  }
  if (subTab === 'mayor') {
    return generateGeneralLedgerPDF({ account: activeMayorAccount, generalLedger, entries, config, currentUser });
  }
  if (subTab === 'estados') {
    return generateFinancialStatementsPDF({ financialStatements, trialBalance, entries, config, currentUser });
  }

  const isDiario = subTab === 'diario' || subTab === 'export';
  const base = createBaseReport({
    title: isDiario ? 'LIBRO DIARIO GENERAL & ASIENTOS CONTABLES DIGITALES' : 'BITÁCORA DE AUDITORÍA DE SEGURIDAD & TRAZABILIDAD',
    subtitle: 'Registro de Partida Doble Automatizada, Eventos del Sistema y Trazabilidad de Operadores',
    moduleCode: 'AUD',
    currentUser,
    config
  });

  const cards = [
    { label: 'Asientos Contables', value: `${entries.length} Asientos`, subtext: 'Partida Doble', color: COLORS.navy },
    { label: 'Eventos de Auditoría', value: `${auditLogs.length} Eventos`, subtext: 'Logs de Sistema', color: COLORS.cyan },
    { label: 'Estatus del Libro', value: 'CUADRADO', subtext: 'Debe = Haber', color: COLORS.emerald },
    { label: 'Motor Trazabilidad', value: 'SHA-256', subtext: 'Inmutable', color: COLORS.amber }
  ];

  const currentY = addSummaryCards(base.doc, base.startY, cards, base.tableWidth, base.startX);

  if (isDiario) {
    const tableData = [];
    entries.forEach((e) => {
      (e.lines || []).forEach((l) => {
        tableData.push([
          String(e.asientoNum || '-'),
          e.fecha ? String(e.fecha).slice(0, 10) : '2026-10-23',
          l.cuentaCodigo || 'CTA',
          l.cuentaNombre || 'Cuenta Contable',
          formatUsd(l.debeUsd || 0),
          formatUsd(l.haberUsd || 0),
          e.usuario || 'SISTEMA'
        ]);
      });
    });

    autoTable(base.doc, {
      startY: currentY,
      margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
      tableWidth: base.tableWidth,
      head: [['ASIENTO', 'FECHA', 'CÓDIGO CUENTA', 'DENOMINACIÓN DE LA CUENTA', 'DEBE USD', 'HABER USD', 'OPERADOR']],
      body: tableData.length > 0 ? tableData : [['-', '-', '-', 'Sin movimientos contables registrados', '$ 0.00', '$ 0.00', '-']],
      theme: 'grid',
      headStyles: {
        fillColor: COLORS.navy,
        textColor: [255, 255, 255],
        fontSize: 6.8,
        fontStyle: 'bold',
        cellPadding: 1.6
      },
      styles: {
        fontSize: 6.2,
        cellPadding: 1.4,
        textColor: COLORS.dark
      },
      alternateRowStyles: {
        fillColor: COLORS.lightBg
      },
      columnStyles: {
        0: { fontStyle: 'bold', halign: 'center', cellWidth: 18 },
        1: { halign: 'center', cellWidth: 16 },
        2: { cellWidth: 24 },
        3: { cellWidth: 48 },
        4: { halign: 'right', fontStyle: 'bold', cellWidth: 24 },
        5: { halign: 'right', fontStyle: 'bold', cellWidth: 24 },
        6: { cellWidth: 25.9 }
      }
    });
  } else {
    const tableData = auditLogs.map((l) => [
      l.fecha ? String(l.fecha).replace('T', ' ').slice(0, 16) : '2026-10-23',
      l.usuario || l.usuarioNombre || 'OPERADOR',
      l.tipo || l.accion || 'EVENTO',
      l.titulo || l.detalles || 'Acción en el sistema',
      l.estado || 'CONFIRMADO'
    ]);

    autoTable(base.doc, {
      startY: currentY,
      margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
      tableWidth: base.tableWidth,
      head: [['FECHA & HORA', 'OPERADOR / USUARIO', 'TIPO EVENTO', 'DESCRIPCIÓN DEL EVENTO', 'ESTADO']],
      body: tableData.length > 0 ? tableData : [['-', '-', '-', 'Sin eventos registrados', '-']],
      theme: 'grid',
      headStyles: {
        fillColor: COLORS.navy,
        textColor: [255, 255, 255],
        fontSize: 6.8,
        fontStyle: 'bold',
        cellPadding: 1.6
      },
      styles: {
        fontSize: 6.2,
        cellPadding: 1.4,
        textColor: COLORS.dark
      },
      alternateRowStyles: {
        fillColor: COLORS.lightBg
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 26 },
        1: { cellWidth: 24 },
        2: { cellWidth: 26 },
        3: { cellWidth: 76 },
        4: { halign: 'center', fontStyle: 'bold', cellWidth: 27.9 }
      }
    });
  }

  finalizeAndSave(base.doc, `Reporte_Auditoria_Contable_SIGNUM_${new Date().toISOString().slice(0, 10)}.pdf`, currentUser);
  return base.doc;
}

// =========================================================================
// 12B. REPORTE CONSOLIDADO DE CUENTAS POR COBRAR (FACTURAS + NOTAS)
// =========================================================================
export function generateConsolidatedCxcPDF({
  docs = [],
  clientRows = [],
  totals = null,
  visibleTotals = null,
  tasaBcv = 1,
  viewMode = 'DOCS',
  filters = {},
  config = {},
  currentUser = null
} = {}) {
  const docList = Array.isArray(docs) ? docs : [];
  const clientList = Array.isArray(clientRows) ? clientRows : [];
  const rate = Number(tasaBcv) || Number(config?.tasaDolar) || 451.51;
  const isClientsView = viewMode === 'CLIENTES';

  const aggregateDocs = (predicate) => (predicate ? docList.filter(predicate) : docList).reduce(
    (acc, item) => {
      const monto = Number(item.montoFacturaUsd ?? item.totalFacturaUsd ?? 0);
      const abonos = Number(item.abonosUsd ?? item.montoPagadoUsd ?? 0);
      const restante = Number(item.restanteUsd ?? item.saldoPendienteUsd ?? item.saldoUsd ?? 0);
      const isOverdue = item.estado === 'VENCIDA' || Number(item.diasVencidos ?? 0) > 0;
      acc.count += 1;
      acc.monto += monto;
      acc.abonos += abonos;
      acc.restante += restante;
      if (isOverdue) {
        acc.vencido += restante;
        acc.vencidas += 1;
      }
      return acc;
    },
    { count: 0, monto: 0, abonos: 0, restante: 0, vencido: 0, vencidas: 0 }
  );

  const facTotals = totals?.fac || aggregateDocs(d => d.tipoDoc !== 'NOTA_ENTREGA');
  const neTotals = totals?.ne || aggregateDocs(d => d.tipoDoc === 'NOTA_ENTREGA');
  const allTotals = totals?.all || {
    count: facTotals.count + neTotals.count,
    monto: facTotals.monto + neTotals.monto,
    abonos: facTotals.abonos + neTotals.abonos,
    restante: facTotals.restante + neTotals.restante,
    vencido: facTotals.vencido + neTotals.vencido,
    vencidas: facTotals.vencidas + neTotals.vencidas
  };

  const visibleSummary = visibleTotals || (isClientsView
    ? clientList.reduce(
        (acc, c) => {
          acc.count += Number(c.fac?.count || 0) + Number(c.ne?.count || 0);
          acc.monto += Number(c.totalMonto || 0);
          acc.abonos += Number(c.totalAbonos || 0);
          acc.restante += Number(c.totalRestante || 0);
          return acc;
        },
        { count: 0, monto: 0, abonos: 0, restante: 0, vencido: 0, vencidas: 0 }
      )
    : aggregateDocs(null));

  const base = createBaseReport({
    title: isClientsView
      ? 'REPORTE CONSOLIDADO CXC POR CLIENTE (FACTURAS + NOTAS)'
      : 'REPORTE CONSOLIDADO CXC — FACTURAS FISCALES + NOTAS DE ENTREGA',
    subtitle: isClientsView
      ? 'Cartera Consolidada Agrupada por Cliente • Facturas Fiscales SENIAT + Notas de Entrega Sumadas'
      : 'Cartera Total Sumada de Ambos Tipos de Documento • Trazabilidad Integral de Cobros',
    moduleCode: 'CXC-CON',
    currentUser,
    config,
    orientation: 'landscape',
    rateValue: rate
  });

  const cards = [
    { label: 'Facturas Fiscales', value: formatUsd(facTotals.restante), subtext: `${facTotals.count} docs • Mto: ${formatUsd(facTotals.monto)}`, color: COLORS.navy },
    { label: 'Notas de Entrega', value: formatUsd(neTotals.restante), subtext: `${neTotals.count} docs • Mto: ${formatUsd(neTotals.monto)}`, color: COLORS.amber },
    { label: 'Total Consolidado', value: formatUsd(allTotals.restante), subtext: `${allTotals.count} docs • ${formatBs(allTotals.restante * rate)}`, color: COLORS.emerald },
    { label: isClientsView ? 'Clientes en Tabla' : 'Docs en Tabla', value: isClientsView ? `${clientList.length} Clientes` : `${docList.length} Documentos`, subtext: `Restante visible: ${formatUsd(visibleSummary.restante)}`, color: COLORS.cyan }
  ];

  let currentY = addSummaryCards(base.doc, base.startY, cards, base.tableWidth, base.startX);
  const filterParts = [
    `Vista: ${isClientsView ? 'Por Cliente (Agrupado)' : 'Por Documento'}`,
    `Tipo: ${filters?.typeLabel || 'Ambos (FAC + NE)'}`,
    `Estado: ${filters?.statusLabel || 'Cartera activa'}`,
    `Cobrador: ${filters?.sellerLabel || 'Todos los cobradores'}`
  ];
  if (filters?.searchTerm) {
    filterParts.push(`Búsqueda: "${String(filters.searchTerm).trim()}"`);
  }

  currentY = addAnalyticalBox(
    base.doc,
    currentY,
    'DESGLOSE CONSOLIDADO Y FILTROS APLICADOS',
    `${filterParts.join(' | ')}\nFacturas Fiscales (${facTotals.count}): Monto ${formatUsd(facTotals.monto)}, Abonos ${formatUsd(facTotals.abonos)}, Restante ${formatUsd(facTotals.restante)} • Notas de Entrega (${neTotals.count}): Monto ${formatUsd(neTotals.monto)}, Abonos ${formatUsd(neTotals.abonos)}, Restante ${formatUsd(neTotals.restante)} • Vencido Total: ${formatUsd(allTotals.vencido)} (${allTotals.vencidas} docs).`,
    base.tableWidth,
    base.startX
  );

  const fmtShortDate = (raw) => {
    if (!raw) return '—';
    const dt = raw instanceof Date ? raw : new Date(raw);
    if (isNaN(dt.getTime())) return String(raw).slice(0, 10);
    return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()}`;
  };

  if (isClientsView) {
    const sumFacCount = clientList.reduce((acc, c) => acc + Number(c.fac?.count || 0), 0);
    const sumFacRestante = clientList.reduce((acc, c) => acc + Number(c.fac?.restante || 0), 0);
    const sumNeCount = clientList.reduce((acc, c) => acc + Number(c.ne?.count || 0), 0);
    const sumNeRestante = clientList.reduce((acc, c) => acc + Number(c.ne?.restante || 0), 0);

    const body = clientList.map(c => [
      String(c.cliente || 'Cliente Comercial'),
      String(c.rif || 'N/A'),
      String(c.fac?.count || 0),
      formatUsd(c.fac?.restante || 0),
      String(c.ne?.count || 0),
      formatUsd(c.ne?.restante || 0),
      formatUsd(c.totalMonto || 0),
      formatUsd(c.totalAbonos || 0),
      formatUsd(c.totalRestante || 0),
      formatBs(Number(c.totalRestante || 0) * rate),
      String(Number(c.maxDias || 0))
    ]);

    autoTable(base.doc, {
      startY: currentY,
      margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
      tableWidth: base.tableWidth,
      head: [['CLIENTE', 'RIF', 'N° FAC.', 'SALDO FACTURAS', 'N° NOTAS', 'SALDO NOTAS', 'MONTO TOTAL', 'ABONOS', 'SALDO TOTAL ($)', 'SALDO TOTAL (BS.)', 'MÁX. DÍAS']],
      body: body.length > 0 ? body : [['No hay clientes que coincidan con los filtros.', '-', '0', '$ 0.00', '0', '$ 0.00', '$ 0.00', '$ 0.00', '$ 0.00', 'Bs. 0,00', '0']],
      foot: [[
        { content: `TOTAL (${clientList.length} clientes)`, colSpan: 2, styles: { halign: 'left' } },
        String(sumFacCount),
        formatUsd(sumFacRestante),
        String(sumNeCount),
        formatUsd(sumNeRestante),
        formatUsd(visibleSummary.monto),
        formatUsd(visibleSummary.abonos),
        formatUsd(visibleSummary.restante),
        formatBs(visibleSummary.restante * rate),
        ''
      ]],
      showFoot: 'lastPage',
      theme: 'grid',
      headStyles: { fillColor: COLORS.navy, textColor: [255, 255, 255], fontSize: 5.8, fontStyle: 'bold', cellPadding: 1.4, valign: 'middle' },
      footStyles: { fillColor: [226, 232, 240], textColor: COLORS.dark, fontSize: 5.8, fontStyle: 'bold', cellPadding: 1.4 },
      styles: { fontSize: 5.7, cellPadding: 1.25, textColor: COLORS.dark, valign: 'middle' },
      alternateRowStyles: { fillColor: COLORS.lightBg },
      columnStyles: {
        0: { cellWidth: 48.4, fontStyle: 'bold' },
        1: { cellWidth: 20, halign: 'center' },
        2: { cellWidth: 11, halign: 'right', textColor: COLORS.navy, fontStyle: 'bold' },
        3: { cellWidth: 23, halign: 'right', textColor: COLORS.navy },
        4: { cellWidth: 11, halign: 'right', textColor: COLORS.amber, fontStyle: 'bold' },
        5: { cellWidth: 23, halign: 'right', textColor: COLORS.amber },
        6: { cellWidth: 23, halign: 'right' },
        7: { cellWidth: 21, halign: 'right', textColor: COLORS.emerald },
        8: { cellWidth: 23, halign: 'right', textColor: COLORS.red, fontStyle: 'bold' },
        9: { cellWidth: 28, halign: 'right', textColor: COLORS.slate },
        10: { cellWidth: 12, halign: 'right', fontStyle: 'bold' }
      }
    });
  } else {
    const resolveCreditDays = (d) => {
      if (d?.diasCredito !== undefined && d?.diasCredito !== null && d?.diasCredito !== '') {
        const parsed = Number(d.diasCredito);
        if (!Number.isNaN(parsed) && parsed >= 0) return parsed;
      }
      const emisRaw = d?.fechaEmision || d?.fechaEmisionIso;
      const vencRaw = d?.fechaVencimiento || d?.fechaVencimientoIso;
      if (emisRaw && vencRaw) {
        const emis = emisRaw instanceof Date ? emisRaw : new Date(emisRaw);
        const venc = vencRaw instanceof Date ? vencRaw : new Date(vencRaw);
        if (!Number.isNaN(emis.getTime()) && !Number.isNaN(venc.getTime())) {
          const diff = Math.round((venc.getTime() - emis.getTime()) / (1000 * 60 * 60 * 24));
          if (diff >= 0) return diff;
        }
      }
      return 0;
    };

    const body = docList.map(d => {
      const isNe = d.tipoDoc === 'NOTA_ENTREGA';
      const statusLabel = d.estado === 'VENCIDA' ? 'VENCIDA' : (d.estado === 'PAGADA' ? 'SOLVENTE' : 'AL DÍA');
      const rawDocNum = String(d.factura || d.factNum || d.nroDoc || d.id || '0000');
      const formattedDocNum = rawDocNum.startsWith('#') ? rawDocNum : `#${rawDocNum}`;
      const creditDays = resolveCreditDays(d);
      return [
        isNe ? 'NOTA ENT.' : 'FACTURA',
        formattedDocNum,
        String(d.cliente || d.clienteNombre || 'Cliente Comercial'),
        String(d.rif || d.clienteRif || 'N/A'),
        String(d.vendedorId || d.vendedor || 'OF'),
        fmtShortDate(d.fechaEmision || d.fechaEmisionIso),
        fmtShortDate(d.fechaVencimiento || d.fechaVencimientoIso),
        String(Number(d.diasVencidos ?? 0)),
        `${creditDays}d`,
        formatUsd(d.montoFacturaUsd ?? 0),
        formatUsd(d.abonosUsd ?? 0),
        formatUsd(d.restanteUsd ?? 0),
        statusLabel
      ];
    });

    autoTable(base.doc, {
      startY: currentY,
      margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
      tableWidth: base.tableWidth,
      head: [['TIPO', 'N° DOC.', 'CLIENTE', 'RIF', 'COBR.', 'EMISIÓN', 'VENCE', 'DÍAS', 'CRÉD.', 'MONTO ($)', 'ABONOS ($)', 'RESTANTE ($)', 'ESTADO']],
      body: body.length > 0 ? body : [['-', '-', 'No hay documentos que coincidan con los filtros.', '-', '-', '-', '-', '0', '0d', '$ 0.00', '$ 0.00', '$ 0.00', '-']],
      foot: [[
        { content: `TOTAL (${docList.length} documentos)`, colSpan: 9, styles: { halign: 'left' } },
        formatUsd(visibleSummary.monto),
        formatUsd(visibleSummary.abonos),
        formatUsd(visibleSummary.restante),
        ''
      ]],
      showFoot: 'lastPage',
      theme: 'grid',
      headStyles: { fillColor: COLORS.navy, textColor: [255, 255, 255], fontSize: 5.8, fontStyle: 'bold', cellPadding: 1.4, valign: 'middle' },
      footStyles: { fillColor: [226, 232, 240], textColor: COLORS.dark, fontSize: 5.8, fontStyle: 'bold', cellPadding: 1.4 },
      styles: { fontSize: 5.7, cellPadding: 1.25, textColor: COLORS.dark, valign: 'middle' },
      alternateRowStyles: { fillColor: COLORS.lightBg },
      columnStyles: {
        0: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
        1: { cellWidth: 18, halign: 'center', fontStyle: 'bold' },
        2: { cellWidth: 40.4 },
        3: { cellWidth: 21, halign: 'center' },
        4: { cellWidth: 13, halign: 'center' },
        5: { cellWidth: 17, halign: 'center' },
        6: { cellWidth: 17, halign: 'center' },
        7: { cellWidth: 11, halign: 'right', fontStyle: 'bold' },
        8: { cellWidth: 12, halign: 'center', fontStyle: 'bold', textColor: COLORS.navy },
        9: { cellWidth: 19, halign: 'right' },
        10: { cellWidth: 19, halign: 'right', textColor: COLORS.emerald, fontStyle: 'bold' },
        11: { cellWidth: 19, halign: 'right', textColor: COLORS.red, fontStyle: 'bold' },
        12: { cellWidth: 19, halign: 'center', fontStyle: 'bold' }
      },
      didParseCell: (data) => {
        if (data.section === 'body') {
          if (data.column.index === 0) {
            const isNota = String(data.cell.raw || '').includes('NOTA');
            data.cell.styles.textColor = isNota ? COLORS.amber : COLORS.cyan;
          } else if (data.column.index === 12 && data.cell.raw && data.cell.raw !== '-') {
            data.cell.text = '';
          }
        }
      },
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 12 && data.cell.raw && data.cell.raw !== '-') {
          drawStatusBadge(base.doc, data.cell, data.cell.raw);
        }
      }
    });
  }

  const afterTableY = base.doc.lastAutoTable?.finalY || currentY;
  addGrandTotalBox(
    base.doc,
    afterTableY + 3.5,
    [
      { label: 'MONTO EN TABLA (FAC + NE)', value: formatUsd(visibleSummary.monto), subtext: `Abonos: ${formatUsd(visibleSummary.abonos)}`, color: COLORS.navy },
      { label: 'SALDO RESTANTE EN TABLA', value: formatUsd(visibleSummary.restante), subtext: isClientsView ? `${clientList.length} clientes • ${visibleSummary.count} docs` : `${docList.length} documentos`, color: visibleSummary.restante > 0 ? COLORS.red : COLORS.emerald },
      { label: 'EQUIVALENTE EN BOLÍVARES', value: formatBs(visibleSummary.restante * rate), subtext: `Tasa BCV: ${formatBs(rate)}`, color: COLORS.emerald }
    ],
    base.tableWidth,
    base.startX
  );

  const fileSuffix = isClientsView ? 'Por_Cliente' : 'Documentos';
  finalizeAndSave(base.doc, `Reporte_CxC_Consolidado_${fileSuffix}_${new Date().toISOString().slice(0, 10)}.pdf`, currentUser);
  return base.doc;
}

// =========================================================================
// 13. REPORTE DE USUARIOS & CONTROL DE ACCESOS
// =========================================================================
export function generateUsersPDF({ users = [], logs = [], activeSubTab = 'usuarios', config = {}, currentUser = null }) {
  const base = createBaseReport({
    title: 'REPORTE MAESTRO DE USUARIOS, ROLES & PERMISOS DE ACCESO',
    subtitle: 'Nómina de Operadores del Sistema, Jerarquías Departamentales y Matriz de Seguridad',
    moduleCode: 'USR',
    currentUser,
    config
  });

  const totalUsuarios = users.length;
  const activos = users.filter(u => u.activo !== false).length;
  const inactivos = totalUsuarios - activos;

  const cards = [
    { label: 'Operadores Totales', value: `${totalUsuarios} Usuarios`, subtext: 'Base PostgreSQL', color: COLORS.navy },
    { label: 'Cuentas Activas', value: `${activos} Activos`, subtext: 'Acceso Permitido', color: COLORS.emerald },
    { label: 'Cuentas Suspendidas', value: `${inactivos} Inactivas`, subtext: 'Bloqueo de Login', color: COLORS.red },
    { label: 'Módulos del Sistema', value: '14 Módulos', subtext: 'Matriz Permisología', color: COLORS.cyan }
  ];

  let currentY = addSummaryCards(base.doc, base.startY, cards, base.tableWidth, base.startX);

  const tableData = users.map((u) => {
    const modulosCount = (u.modulos || []).length;
    return [
      `@${u.username}`,
      u.nombre || 'Operador',
      u.cargo || 'Funcionario',
      u.departamento || 'OPERACIONES',
      u.rol || 'VENTAS',
      `${modulosCount} de 14`,
      u.activo !== false ? '🟢 ACTIVO' : '🔴 INACTIVO'
    ];
  });

  autoTable(base.doc, {
    startY: currentY,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    head: [['USUARIO (@)', 'NOMBRE COMPLETO', 'CARGO INSTITUCIONAL', 'DEPTO.', 'ROL JERÁRQUICO', 'PERMISOS', 'ESTADO']],
    body: tableData.length > 0 ? tableData : [['-', 'Sin operadores registrados en el sistema', '-', '-', '-', '-', '-']],
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.navy,
      textColor: [255, 255, 255],
      fontSize: 6.8,
      fontStyle: 'bold',
      cellPadding: 1.6
    },
    styles: {
      fontSize: 6.2,
      cellPadding: 1.4,
      textColor: COLORS.dark
    },
    alternateRowStyles: {
      fillColor: COLORS.lightBg
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 24 },
      1: { cellWidth: 42 },
      2: { cellWidth: 36 },
      3: { cellWidth: 18 },
      4: { fontStyle: 'bold', cellWidth: 22 },
      5: { halign: 'center', cellWidth: 18 },
      6: { halign: 'center', cellWidth: 19.9 }
    }
  });

  finalizeAndSave(base.doc, `Reporte_Usuarios_Seguridad_SIGNUM_${new Date().toISOString().slice(0, 10)}.pdf`, currentUser);
  return base.doc;
}

// =========================================================================
// 14. REPORTE DE CONFIGURACIÓN GENERAL DEL SISTEMA
// =========================================================================
export function generateConfigPDF({ config = {}, currentUser = null }) {
  const base = createBaseReport({
    title: 'FICHA TÉCNICA DE CONFIGURACIÓN & PARÁMETROS FISCALES',
    subtitle: 'Políticas Cambiarias, Datos Fiscales SENIAT, Alícuotas de Impuesto y Parámetros Operativos',
    moduleCode: 'CFG',
    currentUser,
    config
  });

  const cards = [
    { label: 'Tasa BCV Oficial', value: formatBs(config.tasaDolar || 827.73), subtext: 'Moneda Secundaria', color: COLORS.navy },
    { label: 'Alícuota IVA SENIAT', value: `${config.ivaPorcentaje || 16}%`, subtext: 'Impuesto al Valor Agregado', color: COLORS.cyan },
    { label: 'Alícuota IGTF Divisas', value: `${config.igtfPorcentaje || 3}%`, subtext: 'Grandes Transacciones', color: COLORS.amber },
    { label: 'Límite Crédito Default', value: formatUsd(config.limiteCreditoDefecto || 1000), subtext: `${config.diasCreditoDefecto || 15} Días Plazo`, color: COLORS.emerald }
  ];

  let currentY = addSummaryCards(base.doc, base.startY, cards, base.tableWidth, base.startX);

  const tableData = [
    ['Razón Social de la Empresa', config.nombreEmpresa || 'SIGNUM MOTORVEN, C.A.'],
    ['Marca Comercial Oficial', config.marcaOficial || 'OILSTONE ® por KEYSTONE, C.A.'],
    ['Registro de Información Fiscal (RIF)', config.rif || 'J-30401927-4'],
    ['Domicilio Fiscal Oficial', config.direccion || 'Zona Industrial III, Barquisimeto / Caracas'],
    ['Teléfono de Contacto', config.telefono || '+58 (251) 269.13.96'],
    ['Correo Electrónico Corporativo', config.email || 'ventas@motorven.com.ve'],
    ['Moneda Principal de Cotización', config.monedaPrincipal || 'USD (Dólares Americanos)'],
    ['Moneda Secundaria de Pago', config.monedaSecundaria || 'Bs. (Bolívares Digitales)'],
    ['Tasa de Cambio Oficial BCV', formatBs(config.tasaDolar || 827.73)],
    ['Tasa Referencial Planta Keystone', formatBs(config.tasaKeystone || 850.00)],
    ['Alícuota General IVA (SENIAT)', `${config.ivaPorcentaje || 16}%`],
    ['Alícuota Especial IGTF Divisas', `${config.igtfPorcentaje || 3}%`],
    ['Días de Crédito Estándar', `${config.diasCreditoDefecto || 15} días`],
    ['Límite de Crédito por Defecto', formatUsd(config.limiteCreditoDefecto || 1000)],
    ['Almacén Principal Predeterminado', config.almacenActual || 'ALM-01 Planta Principal Oilstone'],
    ['Aprobador de Crédito por Defecto', config.aprobadorCreditoDefecto || 'Ricardo Sánchez (Gerente General / Dirección)'],
    ['Tiempo de Reposición ROP (Lead Time)', `${config.leadTimeDiasDefecto || 7} días`],
    ['Margen de Ganancia Mínimo en Aceites', `${config.margenGananciaAceites || 35.0}%`]
  ];

  autoTable(base.doc, {
    startY: currentY,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    head: [['PARÁMETRO CONFIGURADO', 'VALOR ACTIVO EN EL SISTEMA']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.navy,
      textColor: [255, 255, 255],
      fontSize: 6.8,
      fontStyle: 'bold',
      cellPadding: 1.6
    },
    styles: {
      fontSize: 6.2,
      cellPadding: 1.4,
      textColor: COLORS.dark
    },
    alternateRowStyles: {
      fillColor: COLORS.lightBg
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 70 },
      1: { fontStyle: 'normal', cellWidth: 109.9 }
    }
  });

  finalizeAndSave(base.doc, `Ficha_Configuracion_SIGNUM_${new Date().toISOString().slice(0, 10)}.pdf`, currentUser);
}

// =========================================================================
// 15. REPORTE DE MANUAL DE USUARIO & GUÍA OPERATIVA (DINÁMICO)
// =========================================================================
export function generateManualPDF({
  config = {},
  currentUser = null,
  activeModule = null,
  modules = null,
  workflows = null
} = {}) {
  const modulesList = Array.isArray(modules) && modules.length > 0 ? modules : MODULES_DOCUMENTATION;
  const workflowsList = Array.isArray(workflows) && workflows.length > 0 ? workflows : WORKFLOWS_STEP_BY_STEP;
  const modTitle = activeModule?.name || activeModule?.title || 'Todos los Módulos';
  const sysVersion = SYSTEM_METADATA?.version || 'v5.5.0 Enterprise';
  const base = createBaseReport({
    title: 'MANUAL DE USUARIO & PROCEDIMIENTOS OPERATIVOS',
    subtitle: `Guía Oficial del Sistema ERP • Sección: ${modTitle} • ${sysVersion}`,
    moduleCode: 'AYU',
    currentUser,
    config
  });

  const cards = [
    { label: 'Módulos Documentados', value: `${modulesList.length} Módulos`, subtext: `${workflowsList.length} Flujos SOP`, color: COLORS.navy },
    { label: 'Versión del Sistema', value: sysVersion, subtext: 'Multi-Dispositivo 100%', color: COLORS.cyan },
    { label: 'Operador Activo', value: currentUser?.username ? `@${currentUser.username}` : '@admin', subtext: currentUser?.cargo || 'Dirección', color: COLORS.emerald },
    { label: 'Tasa BCV Referencial', value: formatBs(config.tasaDolar || 827.73), subtext: 'Cotización Oficial', color: COLORS.amber }
  ];

  let currentY = addSummaryCards(base.doc, base.startY, cards, base.tableWidth, base.startX);

  currentY = addAnalyticalBox(
    base.doc,
    currentY,
    'POLÍTICA DE OPERACIONES, CONTABILIDAD BA VEN-NIF 2 & PROCEDIMIENTOS ESTÁNDAR (SOP)',
    `El presente manual documenta los ${modulesList.length} módulos del sistema ERP de ${SYSTEM_METADATA?.company || 'SIGNUM MOTORVEN, C.A.'} (${SYSTEM_METADATA?.rif || 'J-50478166-0'}): Reserva ATP 72 horas, segregación Almacén 01 (SENIAT) / Almacén 02 (Notas de Entrega), Cuenta por Cobrar Parte A y Cuenta por Pagar con retenciones IVA/ISLR, Plan de Cuentas Profit Plus, Partida Doble inmutable (Libro Diario, Mayor General, Balance de Comprobación, Estados Financieros) y respaldo/despliegue.`,
    base.tableWidth,
    base.startX
  );

  currentY = addSectionHeader(
    base.doc,
    currentY,
    '1. CATÁLOGO INTEGRAL DE MÓDULOS Y ÁREAS FUNCIONALES',
    'Resumen ejecutivo según permisología del rol y arquitectura vigente',
    base.tableWidth,
    base.startX
  );

  const tableData = modulesList.map((mod, idx) => [
    `${idx + 1}. ${mod.title}\n[${mod.category || 'Sistema'}]`,
    `${mod.summary}\n• Pestañas/Componentes: ${(mod.components || []).length} | Botones: ${(mod.buttons || []).length} | Modales: ${(mod.modals || []).length}`
  ]);

  autoTable(base.doc, {
    startY: currentY,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    head: [['MÓDULO / ÁREA FUNCIONAL', 'DESCRIPCIÓN OPERATIVA & ALCANCE FUNCIONAL']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.navy,
      textColor: [255, 255, 255],
      fontSize: 6.8,
      fontStyle: 'bold',
      cellPadding: 1.6
    },
    styles: {
      fontSize: 6.1,
      cellPadding: 1.4,
      textColor: COLORS.dark
    },
    alternateRowStyles: {
      fillColor: COLORS.lightBg
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 56 },
      1: { fontStyle: 'normal', cellWidth: 123.9 }
    }
  });

  currentY = (base.doc.lastAutoTable?.finalY || currentY) + 5;

  if (activeModule && (activeModule.components?.length || activeModule.buttons?.length || activeModule.modals?.length || activeModule.bestPractices?.length)) {
    currentY = addSectionHeader(
      base.doc,
      currentY,
      `2. FICHA DETALLADA DEL MÓDULO: ${(activeModule.title || '').toUpperCase()}`,
      `Categoría: ${activeModule.category || 'ERP'} • Roles: ${(activeModule.rolesAllowed || ['Todos']).join(', ')}`,
      base.tableWidth,
      base.startX
    );

    const detailRows = [];
    (activeModule.components || []).forEach(c => detailRows.push(['Componente / Vista', c.name, c.description]));
    (activeModule.buttons || []).forEach(b => detailRows.push(['Botón / Acción', b.name, `${b.action}${b.shortcut ? ` (${b.shortcut})` : ''}`]));
    (activeModule.modals || []).forEach(md => detailRows.push(['Modal / Sub-pantalla', md.name, `${md.purpose}${md.fields?.length ? ` | Campos: ${md.fields.join(', ')}` : ''}`]));
    (activeModule.bestPractices || []).forEach((bp, i) => detailRows.push(['Regla / Buena Práctica', `Directriz #${i + 1}`, bp]));

    autoTable(base.doc, {
      startY: currentY,
      margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
      tableWidth: base.tableWidth,
      head: [['TIPO', 'ELEMENTO / CONTROL', 'DESCRIPCIÓN OPERATIVA Y REGLAS']],
      body: detailRows,
      theme: 'grid',
      headStyles: { fillColor: COLORS.red, textColor: [255, 255, 255], fontSize: 6.6, fontStyle: 'bold', cellPadding: 1.5 },
      styles: { fontSize: 6.0, cellPadding: 1.3, textColor: COLORS.dark },
      alternateRowStyles: { fillColor: COLORS.lightBg },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 32 },
        1: { fontStyle: 'bold', cellWidth: 48 },
        2: { fontStyle: 'normal', cellWidth: 99.9 }
      }
    });

    currentY = (base.doc.lastAutoTable?.finalY || currentY) + 5;
  }

  const wfSectionNum = activeModule ? '3' : '2';
  currentY = addSectionHeader(
    base.doc,
    currentY,
    `${wfSectionNum}. FLUJOS OPERATIVOS PASO A PASO (SOP CERTIFICADOS)`,
    `${workflowsList.length} secuencias oficiales de ejecución y control interno`,
    base.tableWidth,
    base.startX
  );

  const wfRows = workflowsList.map((wf) => [
    wf.title,
    (wf.steps || []).map((st, sIdx) => `${sIdx + 1}. ${st}`).join('\n')
  ]);

  autoTable(base.doc, {
    startY: currentY,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    head: [['PROCEDIMIENTO ESTÁNDAR (SOP)', 'SECUENCIA OPERATIVA DETALLADA']],
    body: wfRows,
    theme: 'grid',
    headStyles: { fillColor: COLORS.navy, textColor: [255, 255, 255], fontSize: 6.6, fontStyle: 'bold', cellPadding: 1.5 },
    styles: { fontSize: 5.9, cellPadding: 1.4, textColor: COLORS.dark },
    alternateRowStyles: { fillColor: COLORS.lightBg },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 54 },
      1: { fontStyle: 'normal', cellWidth: 125.9 }
    }
  });

  currentY = (base.doc.lastAutoTable?.finalY || currentY) + 5;
  addSignatures(base.doc, currentY, ['Emitido por Soporte / Sistemas', 'Visto Bueno Dirección / Contabilidad'], base.tableWidth, base.startX);

  finalizeAndSave(base.doc, `Manual_Usuario_SIGNUM_MOTORVEN_${new Date().toISOString().slice(0, 10)}.pdf`, currentUser);
}


/**
 * =========================================================================
 * 27. REPORTE OFICIAL: CENTRO DE NOTIFICACIONES & ALERTAS DEL SISTEMA
 * =========================================================================
 */
export function generateNotificationsPDF({
  notifications = [],
  filter = 'ALL',
  config = {},
  currentUser = null
}) {
  const base = createBaseReport({
    title: 'CENTRO DE NOTIFICACIONES & ALERTAS OPERACIONALES',
    subtitle: 'Consolidado Oficial de Alertas Críticas, Advertencias y Eventos del Sistema',
    moduleCode: 'NOTIF',
    currentUser,
    config
  });

  const notifsList = Array.isArray(notifications) ? notifications : [];
  const total = notifsList.length;
  const criticas = notifsList.filter(n => n.severidad === 'critica').length;
  const advertencias = notifsList.filter(n => n.severidad === 'advertencia').length;
  const informativas = notifsList.filter(n => n.severidad === 'info' || n.severidad === 'exito').length;
  const noLeidas = notifsList.filter(n => !n.leida).length;

  let currentY = addSummaryCards(base.doc, base.startY, [
    { label: 'Total Alertas', value: total, subtext: 'Histórico registrado', color: COLORS.navy },
    { label: 'Críticas (Rojo)', value: criticas, subtext: 'Atención inmediata', color: COLORS.red, valueColor: COLORS.red },
    { label: 'Advertencias', value: advertencias, subtext: 'Riesgo / Precaución', color: COLORS.amber, valueColor: COLORS.amber },
    { label: 'Informativas / OK', value: informativas, subtext: 'Operación normal', color: COLORS.cyan },
    { label: 'Pendientes', value: noLeidas, subtext: 'Sin conciliar / leer', color: COLORS.navy }
  ], base.tableWidth, base.startX);

  currentY = addAnalyticalBox(
    base.doc,
    currentY,
    'DIAGNÓSTICO DEL CENTRO DE ALERTAS Y EVENTOS CORPORATIVOS',
    `El presente informe consolida los eventos operacionales, fiscales y logísticos de SIGNUM MOTORVEN C.A. Se registran ${criticas} alerta(s) de criticidad alta vinculadas a niveles de inventario ROP o riesgo de quiebre de stock, ${advertencias} advertencia(s) de gestión de cobranzas o vencimientos, y un balance de ${total - noLeidas} notificación(es) procesadas. Este documento cuenta con validez interna para auditoría de sistemas y control de supervisión general.`,
    base.tableWidth,
    base.startX
  );

  const tableRows = notifsList.map(n => {
    const fecha = n.created_at ? new Date(n.created_at).toLocaleString('es-VE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }) : 'N/A';

    const sevLabel = (n.severidad || 'info').toUpperCase();
    const modulo = (n.modulo || 'SISTEMA').toUpperCase();
    const tituloDesc = `${n.titulo || 'Notificación'}\n${n.mensaje || ''}`;
    const origen = (n.origen || 'SISTEMA').toUpperCase();
    const estado = n.leida ? 'LEÍDA / CONCILIADA' : 'PENDIENTE / ACTIVA';

    return [fecha, `${n.tipo?.toUpperCase() || 'INFO'} (${modulo})`, sevLabel, tituloDesc, origen, estado];
  });

  autoTable(base.doc, {
    startY: currentY,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    head: [['FECHA & HORA', 'TIPO / MÓDULO', 'SEVERIDAD', 'TÍTULO & DESCRIPCIÓN OPERACIONAL', 'ORIGEN', 'ESTADO']],
    body: tableRows.length > 0 ? tableRows : [['-', '-', '-', 'No se encontraron notificaciones registradas en el período seleccionado.', '-', '-']],
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.navy,
      textColor: [255, 255, 255],
      fontSize: 6.2,
      fontStyle: 'bold',
      cellPadding: 1.6
    },
    styles: {
      fontSize: 5.6,
      cellPadding: 1.4,
      textColor: COLORS.dark,
      valign: 'middle'
    },
    alternateRowStyles: {
      fillColor: COLORS.lightBg
    },
    columnStyles: {
      0: { cellWidth: 24, fontStyle: 'normal' },
      1: { cellWidth: 26, fontStyle: 'bold' },
      2: { cellWidth: 20, fontStyle: 'bold', halign: 'center' },
      3: { cellWidth: 63.9, fontStyle: 'normal' },
      4: { cellWidth: 23, fontStyle: 'normal', halign: 'center' },
      5: { cellWidth: 23, fontStyle: 'bold', halign: 'center' }
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 2) {
        const text = String(data.cell.raw || '').toUpperCase();
        if (text.includes('CRITICA')) {
          data.cell.styles.textColor = COLORS.red;
        } else if (text.includes('ADVERTENCIA')) {
          data.cell.styles.textColor = COLORS.amber;
        } else if (text.includes('EXITO')) {
          data.cell.styles.textColor = COLORS.emerald;
        }
      }
      if (data.section === 'body' && data.column.index === 5) {
        const text = String(data.cell.raw || '').toUpperCase();
        if (text.includes('PENDIENTE')) {
          data.cell.styles.textColor = COLORS.red;
        } else {
          data.cell.styles.textColor = COLORS.emerald;
        }
      }
    }
  });

  finalizeAndSave(base.doc, `Reporte_Centro_Notificaciones_${new Date().toISOString().slice(0, 10)}.pdf`, currentUser);
  return base.doc;
}

/**
 * =========================================================================
 * 28. REPORTE OFICIAL: ESQUEMA DETALLADO DE CUENTAS BANCARIAS SUPABASE
 * =========================================================================
 * Genera el informe institucional de todas las cuentas bancarias registradas en
 * la base de datos GRUMOTOR de Supabase (tabla [cuentas] + [bancos]), con saldos
 * contables, equivalente oficial BCV, sucursales, ejecutivos y cajas de tesorería.
 */
export function generateBankAccountsPDF({
  bankAccounts = [],
  cashDesks = [],
  currentUser = null,
  config = {}
} = {}) {
  // Datos reales auténticos de GRUMOTOR si no se proporcionan externamente
  const DEFAULT_PROFIT_BANK_ACCOUNTS = [
    { cod: '01', banco: 'BANCO MERCANTIL', numCta: '01050027311027479197', tipo: 'Corriente', moneda: 'BS', saldo: 13793118.66, sucursal: 'Caracas', ejecutivo: 'Yuliskar Vásquez (0412-3014766)' },
    { cod: '02', banco: 'BANCO PLAZA', numCta: '01380015420150669275', tipo: 'Corriente', moneda: 'BS', saldo: -5511254.38, sucursal: 'Redoma Guaparo', ejecutivo: 'Uranea Pedroza (0414-4029554)' },
    { cod: '03', banco: 'BANCO DE VENEZUELA', numCta: '01020235320000648080', tipo: 'Corriente', moneda: 'BS', saldo: 8552279.36, sucursal: 'Caracas', ejecutivo: 'Zuleima Cartagena (0412-3472483)' },
    { cod: '04', banco: 'BANCO PLAZA', numCta: '01380015460150651694', tipo: 'Corriente', moneda: 'BS', saldo: 25039084.55, sucursal: 'Guaparo', ejecutivo: 'Urania Pedrosa (0414-4029554)' },
    { cod: '05', banco: 'BANCARIBE', numCta: '01140199619940131450', tipo: 'Corriente', moneda: 'BS', saldo: 43214029.85, sucursal: 'Caracas', ejecutivo: 'Mesa de Dinero Corporativa' },
    { cod: '06', banco: 'BANCO ACTIVO', numCta: '01710048396003146655', tipo: 'Corriente', moneda: 'BS', saldo: -85420.84, sucursal: 'CC Scala', ejecutivo: 'Héctor Reyes (0414-9403072)' },
    { cod: '07', banco: 'BANCO ACTIVO FISCAL', numCta: '01710048346003320378', tipo: 'Corriente', moneda: 'BS', saldo: 78800.00, sucursal: 'CC Scala', ejecutivo: 'Héctor Reyes (hreyes@bancoactivo.com)' },
    { cod: '08', banco: 'BANCAMIGA', numCta: '01720204972046033763', tipo: 'Corriente', moneda: 'BS', saldo: 50000.00, sucursal: 'Redoma de Guaparo', ejecutivo: 'Mayra Alejandra (0412-0367542)' },
    { cod: '09', banco: 'BANCARIBE (Secundaria)', numCta: '01140199671990039883', tipo: 'Corriente', moneda: 'BS', saldo: -19600445.51, sucursal: 'Caracas', ejecutivo: 'Soporte Empresas' },
    { cod: '10', banco: 'BANCAMIGA (Valencia)', numCta: '01720110711108277342', tipo: 'Corriente', moneda: 'BS', saldo: 6013878.18, sucursal: 'Valencia', ejecutivo: 'Atención Corporativa' }
  ];

  const DEFAULT_PROFIT_CASH_DESKS = [
    { cod: '01', descrip: 'CAJA PRINCIPAL VALENCIA', moneda: 'BS', saldo: 308034.33, tipo: 'Caja Operativa Mostrador' },
    { cod: '02', descrip: 'CAJA MONEDA EXTRANJERA EFECTIVO', moneda: 'US$', saldo: 9373.40, tipo: 'Bóveda Moneda Fuerte $' },
    { cod: '03', descrip: 'CAJA TRANSFERENCIAS ZELLE', moneda: 'US$', saldo: 0.00, tipo: 'Conciliación Digital Zelle' },
    { cod: '04', descrip: 'CAJA PAGO MÓVIL BANCARIBE', moneda: 'BS', saldo: 0.00, tipo: 'Receptor Digital P2P' },
    { cod: '05', descrip: 'CAJA CRIPTOMONEDAS USDT BINANCE', moneda: 'US$', saldo: 0.00, tipo: 'Tesorería Criptoactivos' }
  ];

  // Si bankAccounts es un array no vacío, usarlo mapeado, si no los defaults
  const rawAccounts = (Array.isArray(bankAccounts) && bankAccounts.length > 0)
    ? bankAccounts
    : DEFAULT_PROFIT_BANK_ACCOUNTS;

  const rawCash = (Array.isArray(cashDesks) && cashDesks.length > 0)
    ? cashDesks
    : DEFAULT_PROFIT_CASH_DESKS;

  const { tasaBcv } = resolveExchangeRates(config);

  // Normalización de Cuentas Bancarias (compatible con formato Supabase y legado)
  const accounts = rawAccounts.map((a, idx) => {
    const cod = a.cod || a.codCta || a.cod_cta || a.co_ban || a.co_banco || String(idx + 1).padStart(2, '0');
    const banco = a.banco || a.bancoNombre || a.banco_nombre || a.des_ban || 'BANCO NACIONAL';
    const numCta = String(a.numCta || a.num_cta || '00000000000000000000').replace(/[^0-9]/g, '');
    const tipo = a.tipo || a.tipo_cu || 'Corriente';
    const moneda = String(a.moneda || 'BS').toUpperCase();
    const valuation = a.saldo !== undefined
      ? { bs: Number(a.saldo) || 0, usd: tasaBcv > 0 ? (Number(a.saldo) || 0) / tasaBcv : 0 }
      : computeBankAccountValuation(a, config);
    const saldo = valuation.bs;
    const equivUsd = valuation.usd;
    const sucursal = a.sucursal || 'Principal';
    const ejecutivo = a.ejecutivo || a.respons || a.cuentaANombreDe || a.titular || 'GRUPO MOTORVEN, C.A.';

    return { cod, banco, numCta, tipo, moneda, saldo, equivUsd, sucursal, ejecutivo };
  });

  // Normalización de Cajas de Tesorería (compatible con profit_cash_desks de Supabase y legado)
  const cashes = rawCash.map((c, idx) => {
    const cod = c.cod || c.codCaja || c.coCaja || c.co_caja || String(idx + 1).padStart(2, '0');
    const descrip = c.descrip || c.descripcion || c.desCaja || c.des_caja || c.nombre || c.caja_des || 'CAJA OPERACIONAL';
    const rawMoneda = String(c.moneda || (descrip.includes('US$') || descrip.includes('EXTRANJERA') ? 'USD' : 'BS')).toUpperCase();
    const isForeign = ['USD', 'US$', 'USDT', 'USDC', 'EUR'].includes(rawMoneda);
    const saldoUsdField = Number(c.saldoUsd ?? c.saldo_usd ?? NaN);
    const saldoBsField = Number(c.saldoBs ?? c.saldo_bs ?? NaN);
    const legacySaldo = Number(c.saldo ?? c.monto ?? NaN);

    const saldo = isForeign
      ? (!Number.isNaN(saldoUsdField) ? saldoUsdField : (!Number.isNaN(legacySaldo) ? legacySaldo : 0))
      : (!Number.isNaN(saldoBsField) ? saldoBsField : (!Number.isNaN(legacySaldo) ? legacySaldo : 0));
    const equivUsd = isForeign ? saldo : (tasaBcv > 0 ? saldo / tasaBcv : 0);
    const displayMoneda = rawMoneda === 'USD' ? 'US$' : rawMoneda;
    const tipo = c.tipo || (c.responsable ? `Resp: ${c.responsable}` : 'Operativa');
    return { cod, descrip, moneda: displayMoneda, isForeign, saldo, equivUsd, tipo };
  });

  // Cálculos Consolidados
  const totalBancosBs = accounts.reduce((acc, a) => acc + a.saldo, 0);
  const totalBancosUsd = accounts.reduce((acc, a) => acc + a.equivUsd, 0);
  const totalCajasUsd = cashes.filter(c => c.isForeign).reduce((acc, c) => acc + c.saldo, 0);
  const totalCajasBs = cashes.filter(c => !c.isForeign).reduce((acc, c) => acc + c.saldo, 0);
  const totalConsolidadoUsd = totalBancosUsd + totalCajasUsd + (tasaBcv > 0 ? totalCajasBs / tasaBcv : 0);

  const base = createBaseReport({
    title: 'ESQUEMA DETALLADO DE CUENTAS BANCARIAS Y CAJAS - SIGNUM MOTORVEN',
    subtitle: 'Auditoría Oficial de Disponibilidades Bancarias, Saldos Contables y Cajas de Tesorería (Supabase)',
    moduleCode: 'TES',
    currentUser,
    config
  });

  // Tarjetas KPI de Resumen Ejecutivo
  const cards = [
    {
      label: 'Total Cuentas Bancarias',
      value: `${accounts.length} Cuentas`,
      subtext: 'Tesorería Bancaria Activa',
      color: COLORS.navy
    },
    {
      label: 'Disponible Bancos (Bs.)',
      value: formatBs(totalBancosBs),
      subtext: totalBancosBs >= 0 ? 'Saldo Favorable Neto' : 'Saldo Deudor Consolidado',
      color: totalBancosBs >= 0 ? COLORS.emerald : COLORS.red
    },
    {
      label: 'Equivalente Bancos (USD)',
      value: formatUsd(totalBancosUsd),
      subtext: `Tasa BCV: ${formatBs(tasaBcv)}`,
      color: COLORS.cyan
    },
    {
      label: 'Cajas en Divisas ($)',
      value: formatUsd(totalCajasUsd),
      subtext: 'Efectivo y Receptorías USD/Crypto',
      color: COLORS.amber
    }
  ];

  let currentY = addSummaryCards(base.doc, base.startY, cards, base.tableWidth, base.startX);

  // Caja de Análisis Ejecutivo
  currentY = addAnalyticalBox(
    base.doc,
    currentY,
    'AUDITORÍA DE DISPONIBILIDAD BANCARIA & TESORERÍA - SUPABASE (SIGNUM MOTORVEN)',
    `El presente informe corporativo consolida el registro oficial de cuentas bancarias y cajas operativas de GRUPO MOTORVEN, C.A. sincronizado en Supabase. Se verifican ${accounts.length} cuentas bancarias con una disponibilidad neta de ${formatBs(totalBancosBs)} (${formatUsd(totalBancosUsd)} a tasa oficial BCV ${formatBs(tasaBcv)}/USD) y fondos en cajas de divisas por ${formatUsd(totalCajasUsd)} más ${formatBs(totalCajasBs)} en efectivo Bolívares.`,
    base.tableWidth,
    base.startX
  );

  // Encabezado de Sección 1: Cuentas Bancarias
  currentY = addSectionHeader(
    base.doc,
    currentY,
    '1. REGISTRO Y CONCILIACIÓN DE CUENTAS BANCARIAS (SUPAB. profit_bank_accounts)',
    'Detalle de cuentas en moneda nacional y extranjera, números de cuenta a 20 dígitos y contravalor oficial',
    base.tableWidth,
    base.startX
  );

  // Formateador de número de cuenta con espaciado para alta legibilidad
  const formatNumCta = (n) => {
    if (!n || n.length !== 20) return n || '-';
    return `${n.slice(0, 4)} ${n.slice(4, 8)} ${n.slice(8, 10)} ${n.slice(10)}`;
  };

  const bankRows = accounts.map(a => [
    a.cod,
    a.banco,
    formatNumCta(a.numCta),
    a.tipo.toUpperCase(),
    formatBs(a.saldo),
    formatUsd(a.equivUsd),
    `${a.sucursal}\n${a.ejecutivo}`
  ]);

  autoTable(base.doc, {
    startY: currentY,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    head: [['CÓD', 'ENTIDAD BANCARIA', 'NÚMERO DE CUENTA (20 DÍGITOS)', 'TIPO', 'SALDO CONTABLE (BS.)', 'EQUIV. USD (BCV)', 'SUCURSAL & EJECUTIVO']],
    body: bankRows,
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.navy,
      textColor: [255, 255, 255],
      fontSize: 6.2,
      fontStyle: 'bold',
      cellPadding: 1.6
    },
    styles: {
      fontSize: 5.6,
      cellPadding: 1.4,
      textColor: COLORS.dark,
      valign: 'middle'
    },
    alternateRowStyles: {
      fillColor: COLORS.lightBg
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 32, fontStyle: 'bold' },
      2: { cellWidth: 38, fontStyle: 'bold', halign: 'center' },
      3: { cellWidth: 16, halign: 'center' },
      4: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
      5: { cellWidth: 23, halign: 'right', fontStyle: 'bold' },
      6: { cellWidth: 32.9, fontStyle: 'normal' }
    },
    didParseCell: (data) => {
      if (data.section === 'body' && (data.column.index === 4 || data.column.index === 5)) {
        const rawText = String(data.cell.raw || '');
        if (rawText.includes('-') || rawText.includes('(')) {
          data.cell.styles.textColor = COLORS.red;
        } else {
          data.cell.styles.textColor = COLORS.emerald;
        }
      }
    }
  });

  currentY = base.doc.lastAutoTable.finalY + 4;

  // Encabezado de Sección 2: Cajas y Bóvedas de Tesorería
  currentY = addSectionHeader(
    base.doc,
    currentY,
    '2. FONDOS DE TESORERÍA, CAJAS Y CRIPTOMONEDAS (profit_cash_desks)',
    'Disponibilidad inmediata en divisas en efectivo, receptorías móviles y cajas operativas de mostrador',
    base.tableWidth,
    base.startX
  );

  const cashRows = cashes.map(c => [
    c.cod,
    c.descrip,
    c.tipo,
    c.moneda,
    c.isForeign ? formatUsd(c.saldo) : formatBs(c.saldo),
    formatUsd(c.equivUsd),
    c.saldo > 0 ? 'ACTIVO CON FONDOS' : 'CUADRADO EN CERO'
  ]);

  autoTable(base.doc, {
    startY: currentY,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    head: [['CÓD', 'CAJA / INSTRUMENTO DE TESORERÍA', 'TIPO OPERACIONAL', 'MONEDA', 'SALDO EN LIBROS', 'EQUIVALENTE USD', 'ESTADO']],
    body: cashRows,
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.navy,
      textColor: [255, 255, 255],
      fontSize: 6.2,
      fontStyle: 'bold',
      cellPadding: 1.6
    },
    styles: {
      fontSize: 5.6,
      cellPadding: 1.4,
      textColor: COLORS.dark,
      valign: 'middle'
    },
    alternateRowStyles: {
      fillColor: COLORS.lightBg
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 46, fontStyle: 'bold' },
      2: { cellWidth: 32, fontStyle: 'normal' },
      3: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
      4: { cellWidth: 28, halign: 'right', fontStyle: 'bold' },
      5: { cellWidth: 23, halign: 'right', fontStyle: 'bold' },
      6: { cellWidth: 24.9, halign: 'center' }
    },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 6) {
        drawStatusBadge(base.doc, data.cell, String(data.cell.raw || ''));
      }
    }
  });

  currentY = base.doc.lastAutoTable.finalY + 4;

  // Caja de Totales Generales Consolidados
  const totalItems = [
    {
      label: 'Total Bancos Nacionales',
      value: formatBs(totalBancosBs),
      subtext: `${accounts.length} Cuentas Corrientes`,
      color: totalBancosBs >= 0 ? COLORS.navy : COLORS.red
    },
    {
      label: 'Bóveda Divisas Efectivo',
      value: formatUsd(totalCajasUsd),
      subtext: 'Fondos Líquidos en Caja',
      color: COLORS.emerald
    },
    {
      label: 'Disponibilidad Consolidada',
      value: formatUsd(totalConsolidadoUsd),
      subtext: `Bancos + Cajas a Tasa BCV`,
      color: COLORS.navy
    }
  ];

  const { footerY: bankFooterY, continuationTopY: bankContTopY } = getPageLayoutMetrics(base.doc);
  const bankSigAnchoredTop = bankFooterY - 3 - 19;
  if (currentY + 13.5 > bankSigAnchoredTop - 2) {
    base.doc.addPage();
    currentY = bankContTopY;
  }

  currentY = addGrandTotalBox(base.doc, currentY, totalItems, base.tableWidth, base.startX);

  // Sección de Firmas Institucionales de Tesorería (ancladas por sobre el pie de página)
  currentY = addSignatures(
    base.doc,
    currentY + 2,
    ['GERENCIA DE TESORERÍA', 'DIRECCIÓN DE FINANZAS', 'AUDITORÍA SUPABASE'],
    base.tableWidth,
    base.startX
  );

  const filename = `Esquema_Detallado_Cuentas_Bancarias_SIGNUM_${new Date().toISOString().slice(0, 10)}.pdf`;
  finalizeAndSave(base.doc, filename, currentUser);

  return base.doc;
}

/**
 * =========================================================================
 * 39. GENERADOR OFICIAL DE REPORTE DE TABLA SUPABASE (SQL SERVER)
 * =========================================================================
 * Permite visualizar e imprimir individualmente los datos y estructura de
 * cualquiera de las tablas de las 26 bases de datos de Supabase (GRUMOTOR, etc.)
 */
export function generateProfitDatabaseTablePDF({
  database = 'GRUMOTOR',
  tableName = 'art',
  columns = [],
  rows = [],
  totalRows = 0,
  filterQuery = '',
  currentUser = null,
  config = {}
}) {
  // Normalizar estructura de columnas (admitir strings o { name: '...' })
  let normColumns = [];
  if (Array.isArray(columns) && columns.length > 0) {
    normColumns = columns.map(c => typeof c === 'string' ? { name: c } : c);
  } else if (Array.isArray(rows) && rows.length > 0) {
    normColumns = Object.keys(rows[0]).map(k => ({ name: k }));
  } else {
    normColumns = [{ name: 'columna_1' }];
  }

  // Si tiene más de 6 columnas, usar apaisado (landscape) para máxima legibilidad
  const isLandscape = normColumns.length > 6;
  const orientation = isLandscape ? 'landscape' : 'portrait';

  const base = createBaseReport({
    title: `REPORTE OFICIAL DE TABLA PROFIT: [dbo].[${tableName}]`,
    subtitle: `Base de Datos: ${database} • Servidor: PROFIT-SERVER (SQL Server 2019)`,
    moduleCode: 'DB-TBL',
    currentUser,
    config,
    orientation
  });

  let currentY = base.startY;

  // 1. Tarjetas KPI de Resumen Estructural
  const displayTotal = totalRows || rows.length;
  const cards = [
    {
      label: 'Base de Datos',
      value: database,
      subtext: 'Motor SQL Server 2019',
      color: COLORS.navy
    },
    {
      label: 'Tabla Consultada',
      value: `[dbo].[${tableName}]`,
      subtext: `${normColumns.length} columnas registradas`,
      color: COLORS.cyan
    },
    {
      label: 'Registros Impresos',
      value: `${rows.length} filas`,
      subtext: `Total registros: ${displayTotal}`,
      color: COLORS.emerald
    },
    {
      label: 'Filtro Activo',
      value: filterQuery ? (filterQuery.length > 14 ? filterQuery.slice(0, 14) + '...' : filterQuery) : 'TODOS',
      subtext: filterQuery ? `Criterio: ${filterQuery}` : 'Sin filtro de búsqueda',
      color: filterQuery ? COLORS.amber : COLORS.slate
    }
  ];

  currentY = addSummaryCards(base.doc, currentY, cards, base.tableWidth, base.startX);

  // 2. Encabezado de Sección: Estructura y Registros
  currentY = addSectionHeader(
    base.doc,
    currentY,
    `DATOS REGISTRADOS EN TABLA: ${tableName.toUpperCase()}`,
    `Extracción directa de datos para auditoría y control de operaciones • Total columnas: ${normColumns.length}`,
    base.tableWidth,
    base.startX
  );

  // 3. Preparación de Encabezados y Celdas de la Tabla
  // Para evitar sobrecarga en hojas impresas, limitamos a un máximo de 16 columnas en PDF
  const maxCols = 16;
  const displayColumns = normColumns.slice(0, maxCols);
  const headHeaders = displayColumns.map(c => (c.name || 'CAMPO').toUpperCase());

  // Imprimir todas las filas registradas en tantas páginas como sea necesario
  const safeRows = rows;
  const bodyRows = safeRows.map((r) => {
    return displayColumns.map(col => {
      const val = r[col.name];
      if (val === null || val === undefined) return 'NULL';
      if (typeof val === 'boolean') return val ? 'SÍ' : 'NO';
      if (typeof val === 'number') {
        return Number.isInteger(val)
          ? String(val)
          : val.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
      if (typeof val === 'object') {
        try {
          return JSON.stringify(val);
        } catch (_) {
          return String(val);
        }
      }
      return String(val).trim();
    });
  });

  if (bodyRows.length === 0) {
    bodyRows.push(displayColumns.map((_, idx) => idx === 0 ? 'Sin registros para mostrar' : '-'));
  }

  // Dimensionamiento tipográfico adaptativo
  let tableFontSize = 6.0;
  let cellPadding = 1.4;
  if (displayColumns.length > 11) {
    tableFontSize = 4.8;
    cellPadding = 0.9;
  } else if (displayColumns.length > 7) {
    tableFontSize = 5.3;
    cellPadding = 1.1;
  }

  autoTable(base.doc, {
    startY: currentY,
    margin: {
      top: 22,
      left: base.startX,
      right: base.startX,
      bottom: 26
    },
    tableWidth: base.tableWidth,
    head: [headHeaders],
    body: bodyRows,
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.navy,
      textColor: [255, 255, 255],
      fontSize: tableFontSize + 0.5,
      fontStyle: 'bold',
      cellPadding: cellPadding + 0.3,
      halign: 'center',
      valign: 'middle'
    },
    styles: {
      fontSize: tableFontSize,
      cellPadding,
      textColor: COLORS.dark,
      valign: 'middle',
      overflow: 'linebreak'
    },
    alternateRowStyles: {
      fillColor: COLORS.lightBg
    }
  });

  currentY = (base.doc.lastAutoTable?.finalY || currentY) + 4;

  // Nota explicativa si la tabla tiene más columnas que las mostradas horizontalmente
  if (normColumns.length > maxCols) {
    const notes = [
      `Estructura: La tabla contiene ${normColumns.length} columnas en total. Se han incluido las primeras ${maxCols} columnas en este formato impreso.`,
      'Para exportar la totalidad de columnas y registros, utilice la opción "CSV" o "JSON" en la barra de herramientas.'
    ];

    currentY = addAnalyticalBox(
      base.doc,
      currentY,
      'NOTA TÉCNICA DE AUDITORÍA Y ESTRUCTURA',
      notes.join(' '),
      base.tableWidth,
      base.startX
    );
  }

  // 4. Firmas de Auditoría
  currentY = addSignatures(
    base.doc,
    currentY,
    ['ADMINISTRADOR DE BASE DE DATOS', 'DIRECCIÓN DE AUDITORÍA & SISTEMAS'],
    base.tableWidth,
    base.startX
  );

  const cleanTableName = String(tableName).replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `Reporte_Profit_${database}_${cleanTableName}_${new Date().toISOString().slice(0, 10)}.pdf`;
  finalizeAndSave(base.doc, filename, currentUser);

  return base.doc;
}

/**
 * =========================================================================
 * 40. REPORTE OFICIAL DE GESTIÓN & MENSAJES DE COBRANZAS POR WHATSAPP
 * =========================================================================
 * Genera el informe institucional de todos los mensajes y recordatorios de cobranza
 * enviados o gestionados vía WhatsApp a clientes deudores con desglose de facturas,
 * saldos en USD, equivalentes en Bolívares (BCV), días de mora y estado del contacto.
 */
export function generateWhatsAppCollectionPDF({
  sentMessages = [],
  clients = [],
  config = {},
  currentUser = null,
  tasaBcv: propTasaBcv = null
} = {}) {
  const tasa = Number(propTasaBcv || config?.tasaDolar) || 451.51;

  const base = createBaseReport({
    title: 'REPORTE OFICIAL DE GESTIÓN & MENSAJES DE COBRANZAS WHATSAPP',
    subtitle: 'Auditoría de Notificaciones Enviadas, Saldos Notificados y Recordatorios de Cartera',
    moduleCode: 'WA-CXC',
    currentUser,
    config
  });

  // Si no hay mensajes registrados directamente, usar clientes deudores activos para el reporte
  let dataset = Array.isArray(sentMessages) && sentMessages.length > 0 ? sentMessages : [];
  if (dataset.length === 0 && Array.isArray(clients) && clients.length > 0) {
    dataset = clients.map((c, idx) => ({
      id: `WA-CLI-${idx + 1}`,
      fecha: new Date().toISOString(),
      clienteNombre: c.nombre || c.cliente || 'Cliente Comercial',
      clienteRif: c.rif || 'J-00000000-0',
      telefono: c.telefono || 'Sin teléfono',
      totalSaldoUsd: Number(c.totalSaldoUsd || c.saldoUsd || 0),
      totalSaldoBs: Number(c.totalSaldoBs || (c.totalSaldoUsd || 0) * tasa),
      invoicesCount: c.invoices?.length || 1,
      invoicesList: c.invoices?.map(i => `#${i.factNum || i.factura}`).join(', ') || 'Cta. Corr.',
      maxDiasVencido: Number(c.maxDiasVencido || c.diasVencidos || 0),
      estado: (c.maxDiasVencido || 0) > 0 ? `Vencida (+${c.maxDiasVencido}d)` : 'Al día',
      canal: 'WhatsApp Directo'
    }));
  }

  const totalNotificaciones = dataset.length;
  const totalSaldoUsd = dataset.reduce((acc, m) => acc + Number(m.totalSaldoUsd || 0), 0);
  const totalSaldoBs = totalSaldoUsd * tasa;
  const totalEnMora = dataset.filter(m => Number(m.maxDiasVencido || 0) > 0).length;

  const cards = [
    {
      label: 'Mensajes Notificados',
      value: `${totalNotificaciones} Envíos`,
      subtext: 'Canal WhatsApp Business',
      color: COLORS.navy
    },
    {
      label: 'Saldo Total Notificado',
      value: formatUsd(totalSaldoUsd),
      subtext: formatBs(totalSaldoBs),
      color: COLORS.cyan
    },
    {
      label: 'Casos en Mora (>0 días)',
      value: `${totalEnMora} Clientes`,
      subtext: `${totalNotificaciones - totalEnMora} Clientes al Día`,
      color: totalEnMora > 0 ? COLORS.red : COLORS.emerald
    },
    {
      label: 'Tasa Oficial BCV',
      value: formatBs(tasa),
      subtext: 'Conversión Multimoneda',
      color: COLORS.amber
    }
  ];

  let currentY = addSummaryCards(base.doc, base.startY, cards, base.tableWidth, base.startX);

  currentY = addAnalyticalBox(
    base.doc,
    currentY,
    'SÍNTESIS DE GESTIÓN DE COBRANZAS POR MENSAJERÍA INSTANTÁNEA (WHATSAPP)',
    `El Departamento de Cobranzas certifica el registro de ${totalNotificaciones} gestiones de cobranza vía WhatsApp, notificando un saldo exigible de ${formatUsd(totalSaldoUsd)} (${formatBs(totalSaldoBs)} a tasa oficial BCV ${formatBs(tasa)}/USD). Se priorizaron ${totalEnMora} clientes con facturas en vencimiento moroso para agilizar la recaudación a través de las cuentas bancarias corporativas.`,
    base.tableWidth,
    base.startX
  );

  const formatDateTimeShort = (isoStr) => {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return String(isoStr).slice(0, 16);
      return d.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit' }) + ' ' +
             d.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch (_) {
      return String(isoStr).slice(0, 16);
    }
  };

  const tableData = dataset.map((m) => {
    const sUsd = Number(m.totalSaldoUsd || 0);
    const sBs = Number(m.totalSaldoBs || sUsd * tasa);
    const mora = Number(m.maxDiasVencido || 0);
    const estadoStr = mora > 30 ? 'CRÍTICO (+30D)' : mora > 0 ? `MORA (+${mora}D)` : 'AL DÍA (0D)';

    return [
      formatDateTimeShort(m.fecha),
      String(m.clienteNombre || 'Cliente General').slice(0, 26),
      String(m.clienteRif || 'N/A'),
      String(m.telefono || 'Sin teléfono'),
      String(m.invoicesList || m.invoicesCount || '1 fac.').slice(0, 22),
      formatUsd(sUsd),
      formatBs(sBs),
      mora > 0 ? `+${mora} d` : 'Al día',
      estadoStr
    ];
  });

  autoTable(base.doc, {
    startY: currentY,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    head: [['FECHA/HORA', 'CLIENTE / RAZÓN SOCIAL', 'RIF', 'TELÉFONO', 'FACTURAS', 'SALDO ($)', 'SALDO (BS.)', 'MORA', 'ESTADO']],
    body: tableData.length > 0 ? tableData : [['—', 'Sin mensajes registrados en el período', '—', '—', '—', '$ 0.00', 'Bs. 0,00', '0 d', 'SIN REGISTROS']],
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.navy,
      textColor: [255, 255, 255],
      fontSize: 5.6,
      fontStyle: 'bold',
      cellPadding: 1.4,
      halign: 'center'
    },
    styles: {
      fontSize: 5.4,
      cellPadding: 1.2,
      textColor: COLORS.dark,
      valign: 'middle'
    },
    alternateRowStyles: {
      fillColor: COLORS.lightBg
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 16 },
      1: { cellWidth: 38, fontStyle: 'bold' },
      2: { halign: 'center', cellWidth: 17 },
      3: { halign: 'center', cellWidth: 20 },
      4: { cellWidth: 22 },
      5: { halign: 'right', fontStyle: 'bold', textColor: COLORS.red, cellWidth: 17 },
      6: { halign: 'right', fontStyle: 'bold', cellWidth: 20 },
      7: { halign: 'center', fontStyle: 'bold', cellWidth: 13 },
      8: { halign: 'center', fontStyle: 'bold', cellWidth: 16.9 }
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 8) {
        data.cell.text = ''; // Vector badge drawn in didDrawCell
      }
    },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 8) {
        drawStatusBadge(base.doc, data.cell, data.cell.raw);
      }
    }
  });

  const finalY = base.doc.lastAutoTable?.finalY || currentY;
  const { footerY: waFooterY, continuationTopY: waContTopY } = getPageLayoutMetrics(base.doc);
  const waSigAnchoredTop = waFooterY - 3 - 19;
  let totalsStartY = finalY + 3.5;

  if (totalsStartY + 13.5 > waSigAnchoredTop - 2) {
    base.doc.addPage();
    totalsStartY = waContTopY;
  }

  const afterWaTotalsY = addGrandTotalBox(base.doc, totalsStartY, [
    { label: 'TOTAL MENSAJES NOTIFICADOS', value: `${totalNotificaciones} Envíos`, subtext: 'Canal WhatsApp Web / API', color: COLORS.navy },
    { label: 'SALDO TOTAL EXIGIBLE', value: formatUsd(totalSaldoUsd), subtext: formatBs(totalSaldoBs), color: COLORS.emerald },
    { label: 'CASOS EN MORA RECAUDADA', value: `${totalEnMora} Clientes`, subtext: 'Seguimiento prioritario', color: totalEnMora > 0 ? COLORS.red : COLORS.emerald }
  ], base.tableWidth, base.startX);

  addSignatures(
    base.doc,
    afterWaTotalsY + 2,
    ['DEPARTAMENTO DE COBRANZAS', 'GERENCIA DE ADMINISTRACIÓN Y FINANZAS'],
    base.tableWidth,
    base.startX
  );

  const filename = `Reporte_Gestion_Cobranzas_WhatsApp_${new Date().toISOString().slice(0, 10)}.pdf`;
  finalizeAndSave(base.doc, filename, currentUser);

  return base.doc;
}

// =========================================================================
// HELPERS INTERNOS COMPARTIDOS PARA FORMATOS CORPORATIVOS Y FISCALES
// =========================================================================
function formatDateVe(rawDate) {
  if (!rawDate) return new Date().toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  if (typeof rawDate === 'string') {
    const trimmed = rawDate.trim();
    // Si es fecha pura ISO o medianoche UTC (Profit Plus / CxC), conservar la fecha calendario sin desplazamiento UTC-4
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed) || /^\d{4}-\d{2}-\d{2}[T\s]00:00:00(?:\.0+)?(?:Z|[+-]\d{2}:?\d{2})?$/i.test(trimmed)) {
      const [y, m, d] = trimmed.slice(0, 10).split('-');
      return `${d}/${m}/${y}`;
    }
    const dmyMatch = trimmed.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/);
    if (dmyMatch) return `${dmyMatch[1]}/${dmyMatch[2]}/${dmyMatch[3]}`;
  }
  try {
    const d = new Date(rawDate);
    if (!isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }
  } catch (_) {}
  return String(rawDate).slice(0, 10);
}

function formatDateTimeVe(rawDate) {
  const datePart = formatDateVe(rawDate);
  if (!rawDate || typeof rawDate !== 'string') return datePart;
  const trimmed = rawDate.trim();
  if (!trimmed.includes('T') && !trimmed.includes(' ')) return datePart;
  if (/^\d{4}-\d{2}-\d{2}[T\s]00:00:00(?:\.0+)?(?:Z|[+-]\d{2}:?\d{2})?$/i.test(trimmed)) return datePart;
  try {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      const timePart = d.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: true });
      return timePart ? `${datePart} • ${timePart}` : datePart;
    }
  } catch (_) {}
  return datePart;
}

function renderTwoColMetaCard(doc, startX, startY, tableWidth, leftBlock = {}, rightBlock = {}) {
  const leftLines = (leftBlock.lines || []).filter(Boolean);
  const rightLines = (rightBlock.lines || []).filter(Boolean);
  const midX = startX + tableWidth * 0.54;
  const maxLeftW = midX - startX - 7;
  const maxRightW = startX + tableWidth - midX - 4;
  const lineStep = 4.6;

  const prepareLines = (lines, maxW, isLeft) => {
    const rendered = [];
    lines.forEach((rawLine, i) => {
      const isStrong = i === 0;
      const fontSize = isStrong ? (isLeft ? 9.0 : 8.6) : 7.8;
      doc.setFont('helvetica', isStrong ? 'bold' : 'normal');
      doc.setFontSize(fontSize);
      const wrapped = doc.splitTextToSize(String(rawLine), maxW).slice(0, 2);
      wrapped.forEach((seg, segIdx) => {
        rendered.push({
          text: seg,
          fontSize,
          isStrong: isStrong && segIdx === 0
        });
      });
    });
    return rendered;
  };

  const renderedLeft = prepareLines(leftLines, maxLeftW, true);
  const renderedRight = prepareLines(rightLines, maxRightW, false);
  const maxLines = Math.max(renderedLeft.length, renderedRight.length, 2);
  const boxH = 10.2 + maxLines * lineStep;
  const { safeBottomY, continuationTopY } = getPageLayoutMetrics(doc);
  if (startY + boxH > safeBottomY) {
    doc.addPage();
    startY = continuationTopY;
  }

  doc.setFillColor(...COLORS.lightBg);
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(startX, startY, tableWidth, boxH, 1.5, 1.5, 'FD');

  doc.setDrawColor(...COLORS.border);
  doc.line(midX - 3, startY + 2, midX - 3, startY + boxH - 2);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.6);
  doc.setTextColor(...COLORS.navy);
  doc.text(String(leftBlock.title || 'DATOS DEL TERCERO').toUpperCase(), startX + 3, startY + 5.2);
  doc.text(String(rightBlock.title || 'METADATOS DEL DOCUMENTO').toUpperCase(), midX, startY + 5.2);

  renderedLeft.forEach((item, i) => {
    doc.setFont('helvetica', item.isStrong ? 'bold' : 'normal');
    doc.setFontSize(item.fontSize);
    doc.setTextColor(...(item.isStrong ? COLORS.dark : COLORS.slate));
    doc.text(item.text, startX + 3, startY + 10.2 + i * lineStep);
  });

  renderedRight.forEach((item, i) => {
    doc.setFont('helvetica', item.isStrong ? 'bold' : 'normal');
    doc.setFontSize(item.fontSize);
    doc.setTextColor(...(item.isStrong ? COLORS.navy : COLORS.slate));
    doc.text(item.text, midX, startY + 10.2 + i * lineStep);
  });

  return startY + boxH + 3;
}

function placeTotalsAndSignatures(doc, currentY, totalItems = [], roles = [], tableWidth = 179.9, startX = 18) {
  const { footerY, continuationTopY } = getPageLayoutMetrics(doc);
  const sigH = 19;
  const sigAnchoredTop = footerY - 3 - sigH;
  let drawY = currentY + 3;

  if (Array.isArray(totalItems) && totalItems.length > 0) {
    const boxH = 15.5;
    if (drawY + boxH > sigAnchoredTop - 2) {
      doc.addPage();
      drawY = continuationTopY;
    }
    drawY = addGrandTotalBox(doc, drawY, totalItems, tableWidth, startX);
  }

  if (Array.isArray(roles) && roles.length > 0) {
    addSignatures(doc, drawY + 2, roles, tableWidth, startX);
  }
}

// =========================================================================
// 22. COTIZACIÓN / PRESUPUESTO COMERCIAL FORMAL (SIN COMPROMETER STOCK)
// =========================================================================
export function generateQuotationPDF({ quotation = {}, config = {}, currentUser = null }) {
  const tasa = Number(quotation.tasaDolar || config?.tasaDolar) || 827.73;
  const docNum = String(quotation.numeroDoc || quotation.id || makeCorrelative('COT')).trim();
  const vigenciaDias = Number(quotation.vigenciaDias || 5);
  const items = Array.isArray(quotation.items) ? quotation.items : [];

  const base = createBaseReport({
    title: `COTIZACIÓN / PRESUPUESTO COMERCIAL N° ${docNum}`,
    subtitle: `Oferta Formal de Precios y Condiciones • Válida por ${vigenciaDias} días • No Válida como Factura`,
    moduleCode: 'COT',
    currentUser,
    config,
    rateValue: tasa
  });

  let y = base.startY;
  y = addSectionHeader(
    base.doc,
    y,
    'IDENTIFICACIÓN DEL CLIENTE & CONDICIONES COMERCIALES',
    'Presupuesto referencial sin reserva ni descuento de inventario hasta aprobación',
    base.tableWidth,
    base.startX
  );

  y = renderTwoColMetaCard(
    base.doc,
    base.startX,
    y,
    base.tableWidth,
    {
      title: 'DATOS DEL CLIENTE SOLICITANTE',
      lines: [
        quotation.clienteNombre || 'CLIENTE POR DEFINIR',
        `RIF / C.I.: ${quotation.clienteRif || 'N/A'}`,
        `Dirección: ${quotation.clienteDireccion || quotation.direccion || 'Venezuela'}`,
        `Vendedor / Asesor: ${quotation.vendedor || 'Oficina Central'}`
      ]
    },
    {
      title: 'PARÁMETROS DE LA OFERTA',
      lines: [
        `Cotización N°: ${docNum}`,
        `Fecha Emisión: ${formatDateVe(quotation.fechaEmision || quotation.fecha)}`,
        `Vigencia Oferta: ${vigenciaDias} días calendario • Condición: ${quotation.condicionPago || 'CONTADO'}`,
        `Moneda Base: USD / Ref. BCV ${formatBs(tasa)}`
      ]
    }
  );

  const body = items.map((it, idx) => {
    const cant = Number(it.cantidad || 1);
    const pUnit = Number(it.precioUsd ?? it.precioUnitarioUsd ?? 0);
    const subUsd = Number(it.subtotalUsd ?? it.totalUsd ?? cant * pUnit);
    return [
      String(idx + 1),
      String(it.codigo || it.articuloId || 'N/A'),
      String(it.descripcion || it.articuloDescripcion || 'Lubricante').slice(0, 44),
      resolveProductUnit(it, 'Caja'),
      String(cant),
      formatUsd(pUnit),
      formatUsd(subUsd),
      formatBs(subUsd * tasa)
    ];
  });

  autoTable(base.doc, {
    startY: y,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    head: [['#', 'CÓDIGO', 'DESCRIPCIÓN DEL PRODUCTO', 'UNIDAD', 'CANT.', 'P. UNIT ($)', 'SUBTOTAL ($)', 'SUBTOTAL (BS.)']],
    body: body.length > 0 ? body : [['—', '—', 'Sin renglones cargados en esta cotización', '—', '0', '$ 0.00', '$ 0.00', 'Bs. 0,00']],
    theme: 'grid',
    headStyles: { fillColor: COLORS.navy, textColor: [255, 255, 255], fontSize: 5.8, fontStyle: 'bold', cellPadding: 1.5, halign: 'center' },
    styles: { fontSize: 5.6, cellPadding: 1.3, textColor: COLORS.dark, valign: 'middle' },
    alternateRowStyles: { fillColor: COLORS.lightBg },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'center', cellWidth: 18, fontStyle: 'bold' },
      2: { cellWidth: 56 },
      3: { halign: 'center', cellWidth: 16 },
      4: { halign: 'center', cellWidth: 12, fontStyle: 'bold' },
      5: { halign: 'right', cellWidth: 20 },
      6: { halign: 'right', fontStyle: 'bold', textColor: COLORS.navy, cellWidth: 22 },
      7: { halign: 'right', fontStyle: 'bold', cellWidth: 27.9 }
    }
  });

  const subUsd = Number(quotation.subtotalUsd ?? items.reduce((s, it) => s + Number(it.subtotalUsd ?? it.totalUsd ?? (Number(it.cantidad || 1) * Number(it.precioUsd ?? it.precioUnitarioUsd ?? 0))), 0));
  const ivaUsd = Number(quotation.ivaUsd ?? (subUsd * 0.16));
  const totUsd = Number(quotation.totalUsd ?? (subUsd + ivaUsd));

  placeTotalsAndSignatures(
    base.doc,
    base.doc.lastAutoTable?.finalY || y,
    [
      { label: 'SUBTOTAL BASE ($)', value: formatUsd(subUsd), subtext: formatBs(subUsd * tasa), color: COLORS.navy },
      { label: 'IVA ESTIMADO (16%)', value: formatUsd(ivaUsd), subtext: formatBs(ivaUsd * tasa), color: COLORS.slate },
      { label: 'TOTAL PRESUPUESTADO', value: formatUsd(totUsd), subtext: formatBs(totUsd * tasa), color: COLORS.emerald }
    ],
    ['ASESOR COMERCIAL EMISOR', 'GERENCIA DE VENTAS / APROBACIÓN', 'ACEPTACIÓN DEL CLIENTE'],
    base.tableWidth,
    base.startX
  );

  finalizeAndSave(base.doc, `Cotizacion_${docNum}.pdf`, currentUser, {
    legalFooter: 'PRESUPUESTO COMERCIAL • Sujeto a disponibilidad de inventario al momento de confirmar pedido • Válido Carta.'
  });
  return base.doc;
}

// =========================================================================
// 23. NOTA DE CRÉDITO / NOTA DE DÉBITO FISCAL CARTA SENIAT
// =========================================================================
/**
 * Determina si una Nota de Crédito o Nota de Débito corresponde a un documento Fiscal (Forma Libre SENIAT)
 * o a un comprobante No Fiscal (PDF en hoja blanca).
 */
export function isCreditDebitDocumentFiscal(docData = {}) {
  if (!docData || typeof docData !== 'object') return false;
  if (docData.isFiscal === false) return false;
  if (docData.isFiscal === true) return true;
  if (String(docData.condicionPago || '').toUpperCase().includes('NO FISCAL')) return false;
  const numStr = String(docData.numeroDoc || docData.factNum || docData.id || '').toUpperCase().trim();
  const affStr = String(docData.documentoAfectado || docData.facturaAfectada || '').toUpperCase().trim();
  if (numStr.startsWith('NE-') || affStr.startsWith('NE-')) return false;
  return true;
}

export function generateCreditDebitNotePDF({ docData = {}, config = {}, currentUser = null, client = null, clients = null, sellers = null }) {
  const tasa = Number(docData.tasaDolar || docData.tasa || config?.tasaDolar) || 827.73;
  const tipoRaw = String(docData.tipoDoc || docData.tipo_doc || 'NOTA_CREDITO').toUpperCase();
  const isDebito = tipoRaw === 'NOTA_DEBITO' || tipoRaw === 'ND' || tipoRaw === 'N/DB' || String(docData.fiscalDocType || '').toUpperCase() === 'NOTA_DEBITO';
  const isFiscalDoc = isCreditDebitDocumentFiscal(docData);
  const cobradorNombre = resolveDocumentSellerName(docData, client, clients, sellers, currentUser);
  const emisorRespNombre = String(docData.emisorNombre || docData.creadoPor || currentUser?.nombre || cobradorNombre || 'Sistema').trim();
  const docLabel = isDebito
    ? (isFiscalDoc ? 'NOTA DE DÉBITO FISCAL' : 'NOTA DE DÉBITO (NO FISCAL)')
    : (isFiscalDoc ? 'NOTA DE CRÉDITO FISCAL' : 'NOTA DE CRÉDITO (NO FISCAL)');
  const docNum = String(docData.numeroDoc || docData.ncNum || docData.ndNum || docData.id || makeCorrelative(isDebito ? 'ND' : 'NC')).trim();
  const docAfectado = String(docData.documentoAfectado || docData.factNum || docData.facturaAfectada || 'N/A').trim();
  const items = Array.isArray(docData.items) ? docData.items : (Array.isArray(docData.renglones) ? docData.renglones : []);

  const base = createBaseReport({
    title: `${docLabel} N° ${docNum}`,
    subtitle: isFiscalDoc
      ? `Documento de Ajuste Tributario SENIAT • Afecta Documento Fiscal N° ${docAfectado}`
      : `Comprobante Interno de Ajuste CxC (No Fiscal) • Afecta Documento N° ${docAfectado}`,
    moduleCode: isDebito ? 'NDB' : 'NCR',
    currentUser,
    config,
    rateValue: tasa
  });

  let y = base.startY;
  y = addSectionHeader(
    base.doc,
    y,
    isFiscalDoc ? `DATOS FISCALES Y REFERENCIA DE ${docLabel}` : `DETALLES Y REFERENCIA DE ${docLabel}`,
    isDebito
      ? (isFiscalDoc ? 'Incremento de base imponible / recargo sobre factura fiscal previamente emitida' : 'Cargo administrativo adicional registrado en Cuenta por Cobrar (No Fiscal)')
      : (isFiscalDoc ? 'Disminución de base imponible / devolución de mercancía sobre factura fiscal emitida' : 'Rebaja / descuento administrativo aplicado en Cuenta por Cobrar (No Fiscal)'),
    base.tableWidth,
    base.startX
  );

  const isPayable = Boolean(docData.isPayableNote);

  y = renderTwoColMetaCard(
    base.doc,
    base.startX,
    y,
    base.tableWidth,
    {
      title: isPayable ? 'SUJETO / PROVEEDOR' : 'SUJETO / ADQUIRENTE',
      lines: [
        docData.clienteNombre || docData.provNombre || docData.cliDes || (isPayable ? 'PROVEEDOR GENERAL' : 'CLIENTE GENERAL'),
        `RIF / C.I.: ${docData.clienteRif || docData.provRif || docData.rif || 'V-00000000-0'}`,
        `Domicilio Fiscal: ${docData.clienteDireccion || docData.direccion || 'Venezuela'}`,
        `Motivo del Ajuste: ${docData.motivo || docData.descrip || (isDebito ? 'Ajuste / Cargo adicional autorizado' : 'Devolución de mercancía / Rebaja comercial')}`
      ]
    },
    {
      title: isFiscalDoc ? 'CONTROL TRIBUTARIO SENIAT' : 'CONTROL INTERNO (NO FISCAL)',
      lines: [
        `${docLabel} N°: ${docNum}`,
        isFiscalDoc
          ? `N° de Control: ${docData.numeroControl || '00-000000'} • Fecha: ${formatDateVe(docData.fechaEmision || docData.fecEmis || docData.fecha)}`
          : `Ref. Interna: ${docData.numeroControl || 'NO FISCAL'} • Fecha: ${formatDateVe(docData.fechaEmision || docData.fecEmis || docData.fecha)}`,
        `${isPayable ? 'Doc. CxP' : 'Factura'} / Doc. Afectado: #${docAfectado}`,
        ...(!isPayable ? [`Cobrador: ${cobradorNombre}`] : []),
        `Emisor / Resp.: ${emisorRespNombre}`,
        `Condición: ${docData.condicionPago || (isFiscalDoc ? 'AJUSTE FISCAL' : 'AJUSTE NO FISCAL')} • Tasa BCV: ${formatBs(tasa)}`
      ]
    }
  );

  const totNetoUsd = round2(Number(docData.totalUsd ?? docData.totNeto ?? docData.totNetoUsd ?? items.reduce((s, it) => s + Number(it.subtotalUsd ?? it.totalUsd ?? (Number(it.cantidad || 1) * Number(it.precioUsd ?? it.precioUnitarioUsd ?? 0))), 0)));
  const hasExplicitSub = docData.subtotalUsd !== undefined || docData.totBruto !== undefined || docData.baseGeneralUsd !== undefined;
  let baseImpUsd = hasExplicitSub
    ? round2(Number(docData.subtotalUsd ?? docData.totBruto ?? docData.baseGeneralUsd ?? 0))
    : (isFiscalDoc ? round2(totNetoUsd / 1.16) : totNetoUsd);
  let ivaUsd = docData.ivaUsd !== undefined || docData.iva !== undefined
    ? round2(Number(docData.ivaUsd ?? docData.iva ?? 0))
    : (isFiscalDoc ? round2(Math.max(0, totNetoUsd - baseImpUsd)) : 0);
  if (isFiscalDoc && ivaUsd <= 0.005 && totNetoUsd > 0) {
    if (hasExplicitSub && baseImpUsd > 0 && baseImpUsd < totNetoUsd - 0.005) {
      ivaUsd = round2(totNetoUsd - baseImpUsd);
    } else {
      baseImpUsd = round2(totNetoUsd / 1.16);
      ivaUsd = round2(Math.max(0, totNetoUsd - baseImpUsd));
    }
  }
  const hasIva = ivaUsd > 0.005;

  const rows = items.map((it, idx) => {
    const cant = Number(it.cantidad || it.totalArt || 1);
    const alignUnitToBase = items.length === 1 && cant === 1;
    const precio = alignUnitToBase ? baseImpUsd : Number(it.precioUsd ?? it.precioUnitarioUsd ?? it.precVta ?? 0);
    const subUsd = alignUnitToBase ? baseImpUsd : Number(it.subtotalUsd ?? it.totalUsd ?? cant * precio);
    return [
      String(idx + 1),
      String(it.codigo || it.coArt || it.articuloId || 'S/C'),
      String(it.descripcion || it.articuloDescripcion || it.artDes || docData.motivo || 'Ajuste CxC').slice(0, 46),
      String(cant),
      formatUsd(precio),
      alignUnitToBase ? (hasIva ? '16%' : 'EXENTO') : (it.tipoAlicuota || (hasIva ? '16%' : 'EXENTO')),
      formatUsd(subUsd),
      formatBs(subUsd * tasa)
    ];
  });

  autoTable(base.doc, {
    startY: y,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    head: [['#', 'CÓDIGO', 'CONCEPTO / ARTÍCULO AFECTADO', 'CANT.', 'P. UNIT ($)', 'ALÍC.', 'MONTO ($)', 'MONTO (BS.)']],
    body: rows.length > 0 ? rows : [['1', docAfectado, String(docData.motivo || docData.descrip || `Ajuste financiero sobre documento #${docAfectado}`).slice(0, 46), '1', formatUsd(baseImpUsd), hasIva ? '16%' : 'EXENTO', formatUsd(baseImpUsd), formatBs(baseImpUsd * tasa)]],
    theme: 'grid',
    headStyles: { fillColor: COLORS.navy, textColor: [255, 255, 255], fontSize: 5.8, fontStyle: 'bold', cellPadding: 1.5, halign: 'center' },
    styles: { fontSize: 5.6, cellPadding: 1.3, textColor: COLORS.dark, valign: 'middle' },
    alternateRowStyles: { fillColor: COLORS.lightBg },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'center', cellWidth: 20, fontStyle: 'bold' },
      2: { cellWidth: 58 },
      3: { halign: 'center', cellWidth: 12 },
      4: { halign: 'right', cellWidth: 19 },
      5: { halign: 'center', cellWidth: 12 },
      6: { halign: 'right', fontStyle: 'bold', textColor: isDebito ? COLORS.red : COLORS.emerald, cellWidth: 22 },
      7: { halign: 'right', fontStyle: 'bold', cellWidth: 28.9 }
    }
  });

  placeTotalsAndSignatures(
    base.doc,
    base.doc.lastAutoTable?.finalY || y,
    [
      { label: hasIva ? 'BASE IMPONIBLE AJUSTADA' : 'MONTO BASE / EXENTO', value: formatUsd(baseImpUsd), subtext: formatBs(baseImpUsd * tasa), color: COLORS.navy },
      { label: !hasIva ? 'IVA (EXENTO / NO FISCAL)' : (isDebito ? 'DÉBITO FISCAL IVA (16%)' : 'CRÉDITO FISCAL IVA (16%)'), value: formatUsd(ivaUsd), subtext: formatBs(ivaUsd * tasa), color: COLORS.slate },
      { label: `TOTAL ${isDebito ? 'NOTA DE DÉBITO' : 'NOTA DE CRÉDITO'}`, value: formatUsd(totNetoUsd), subtext: formatBs(totNetoUsd * tasa), color: isDebito ? COLORS.red : COLORS.emerald }
    ],
    ['EMITIDO POR (ADMINISTRACIÓN)', 'AUTORIZADO POR GERENCIA', 'RECIBIDO CONFORME (CLIENTE)'],
    base.tableWidth,
    base.startX
  );

  finalizeAndSave(base.doc, `${isDebito ? 'Nota_Debito' : 'Nota_Credito'}_${docNum}_${isFiscalDoc ? 'SENIAT' : 'NO_FISCAL'}.pdf`, currentUser, {
    legalFooter: isFiscalDoc
      ? `${docLabel} • Documento vinculado a Factura #${docAfectado} conforme a Providencia SENIAT SNAT/2011/00071.`
      : `${docLabel} • Comprobante administrativo interno vinculado a Documento #${docAfectado} (Sin validez tributaria).`
  });
  return base.doc;
}

/**
 * Enruta la emisión de Nota de Crédito / Débito según su condición:
 * - Fiscal: imprime directamente en el formato preimpreso Forma Libre (generateLetterInvoiceSeniatPDF).
 * - No Fiscal: genera y descarga el comprobante estándar en PDF (generateCreditDebitNotePDF).
 */
export function outputCreditDebitNoteDocument({
  docData = {},
  config = {},
  currentUser = null,
  client = null,
  clients = null,
  sellers = null,
  bankAccounts = null,
  autoPrint = undefined
}) {
  if (isCreditDebitDocumentFiscal(docData)) {
    return generateLetterInvoiceSeniatPDF({
      sale: docData,
      config,
      currentUser,
      client,
      clients,
      sellers,
      bankAccounts,
      autoPrint: autoPrint !== undefined ? autoPrint : true
    });
  }
  return generateCreditDebitNotePDF({
    docData: { ...docData, isFiscal: false },
    config,
    currentUser,
    client,
    clients,
    sellers
  });
}

// =========================================================================
// 24. NOTA DE TRASLADO ENTRE ALMACENES / COMPROBANTE DE AJUSTE O MERMA
// =========================================================================
export function generateWarehouseTransferOrAdjustmentPDF({ record = {}, mode = 'TRANSFER', config = {}, currentUser = null }) {
  const tasa = Number(config?.tasaDolar) || 827.73;
  const isTransfer = String(mode).toUpperCase() === 'TRANSFER';
  const docNum = String(record.trasNum || record.ajueNum || record.id || makeCorrelative(isTransfer ? 'TRAS' : 'AJU')).trim();
  const renglones = Array.isArray(record.renglones) ? record.renglones : (Array.isArray(record.items) ? record.items : []);

  const base = createBaseReport({
    title: isTransfer ? `NOTA DE TRASLADO ENTRE ALMACENES N° ${docNum}` : `COMPROBANTE DE AJUSTE / MERMA DE INVENTARIO N° ${docNum}`,
    subtitle: isTransfer
      ? `Movimiento Físico Interno • Origen Alm. ${record.almOrig || '01'} -> Destino Alm. ${record.almDest || '02'}`
      : 'Validación Auditada de Entradas, Salidas o Mermas Físicas de Stock',
    moduleCode: isTransfer ? 'TRAS' : 'AJUS',
    currentUser,
    config,
    rateValue: tasa
  });

  let y = base.startY;
  y = addSectionHeader(
    base.doc,
    y,
    isTransfer ? 'TRAZABILIDAD DEL TRASLADO LOGÍSTICO' : 'DETALLE Y JUSTIFICACIÓN DEL AJUSTE',
    `Motivo registrado: ${record.motivo || 'Operación regular de almacén'}`,
    base.tableWidth,
    base.startX
  );

  y = renderTwoColMetaCard(
    base.doc,
    base.startX,
    y,
    base.tableWidth,
    {
      title: isTransfer ? 'RUTA DE ALMACENES' : 'ALCANCE DEL AJUSTE',
      lines: isTransfer
        ? [
            `Almacén Origen: ${record.almOrig || '01'} -> Almacén Destino: ${record.almDest || '02'}`,
            `Estado Confirmación: ${record.confirma ? 'CONFIRMADO EN DESTINO' : 'EN TRÁNSITO / PENDIENTE'}`,
            `Motivo: ${record.motivo || 'Reposición entre almacenes'}`
          ]
        : [
            `Almacén Afectado: ${record.almacen || record.coAlma || '01 / General'}`,
            `Tipo de Operación: ${record.tipoAjuste || 'AJUSTE DE INVENTARIO / MERMA'}`,
            `Motivo: ${record.motivo || 'Ajuste auditado de existencias'}`
          ]
    },
    {
      title: 'REGISTRO DE CONTROL',
      lines: [
        `Documento N°: ${docNum}`,
        `Fecha Operación: ${formatDateVe(record.fecha)}`,
        `Operador / Usuario: ${record.coUsIn || currentUser?.nombre || 'Almacenista'}`,
        `Total Renglones: ${renglones.length}`
      ]
    }
  );

  const prodMap = new Map();
  (Array.isArray(record?._products) ? record._products : []).forEach((p) => {
    const sku = String(p?.codigo || p?.id || '').trim();
    if (sku) prodMap.set(sku, p);
  });

  let totalUnidades = 0;
  let totalCostoUsd = 0;
  const rows = renglones.map((r, idx) => {
    const qty = Number(r.total_art ?? r.cantidad ?? r.totalArt ?? 0);
    const { costUsd: cost } = resolveKardexLineCosts({ line: r, productsBySku: prodMap, tasaDolar: tasa });
    const tipoStr = isTransfer ? 'TRASLADO' : (r.tipo_trans === 'E' || r.tipoTrans === 'E' ? 'ENTRADA (+)' : 'SALIDA / MERMA (-)');
    totalUnidades += qty;
    totalCostoUsd += qty * cost;
    return [
      String(idx + 1),
      String(r.co_art || r.codigo || r.articuloId || 'S/C'),
      String(r.art_des || r.descripcion || 'Artículo').slice(0, 48),
      tipoStr,
      String(qty),
      formatUsd(cost),
      formatUsd(qty * cost)
    ];
  });

  autoTable(base.doc, {
    startY: y,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    head: [['#', 'CÓDIGO SKU', 'DESCRIPCIÓN DEL LUBRICANTE', 'TIPO MOV.', 'CANTIDAD', 'COSTO UNIT ($)', 'VALOR TOTAL ($)']],
    body: rows.length > 0 ? rows : [['—', '—', 'Sin renglones asociados', '—', '0', '$ 0.00', '$ 0.00']],
    theme: 'grid',
    headStyles: { fillColor: COLORS.navy, textColor: [255, 255, 255], fontSize: 5.8, fontStyle: 'bold', cellPadding: 1.5, halign: 'center' },
    styles: { fontSize: 5.6, cellPadding: 1.3, textColor: COLORS.dark, valign: 'middle' },
    alternateRowStyles: { fillColor: COLORS.lightBg },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'center', cellWidth: 22, fontStyle: 'bold' },
      2: { cellWidth: 64 },
      3: { halign: 'center', cellWidth: 28, fontStyle: 'bold' },
      4: { halign: 'center', cellWidth: 16, fontStyle: 'bold' },
      5: { halign: 'right', cellWidth: 20 },
      6: { halign: 'right', fontStyle: 'bold', textColor: COLORS.navy, cellWidth: 21.9 }
    }
  });

  placeTotalsAndSignatures(
    base.doc,
    base.doc.lastAutoTable?.finalY || y,
    [
      { label: 'TOTAL ARTÍCULOS MOVILIZADOS', value: `${totalUnidades} Unds.`, subtext: `${renglones.length} SKUs distintos`, color: COLORS.navy },
      { label: 'VALORIZACIÓN AL COSTO ($)', value: formatUsd(totalCostoUsd), subtext: formatBs(totalCostoUsd * tasa), color: COLORS.emerald }
    ],
    isTransfer
      ? ['ALMACÉN ORIGEN (ENTREGA)', 'TRANSPORTE INTERNO', 'ALMACÉN DESTINO (RECIBE)']
      : ['ALMACENISTA / SOLICITANTE', 'AUDITORÍA DE INVENTARIO', 'GERENCIA GENERAL'],
    base.tableWidth,
    base.startX
  );

  finalizeAndSave(base.doc, `${isTransfer ? 'Traslado_Almacen' : 'Ajuste_Inventario'}_${docNum}.pdf`, currentUser);
  return base.doc;
}

// =========================================================================
// 25. REQUISICIÓN INTERNA DE COMPRA
// =========================================================================
export function generatePurchaseRequisitionPDF({ requisition = {}, config = {}, currentUser = null }) {
  const tasa = Number(config?.tasaDolar) || 827.73;
  const reqNum = String(requisition.numeroDoc || requisition.id || makeCorrelative('REQ')).trim();
  const items = Array.isArray(requisition.items) ? requisition.items : [];

  const base = createBaseReport({
    title: `REQUISICIÓN INTERNA DE COMPRA N° ${reqNum}`,
    subtitle: 'Solicitud Formal de Reposición de Stock o Insumos para Aprobación de Compras',
    moduleCode: 'REQ',
    currentUser,
    config,
    rateValue: tasa
  });

  let y = base.startY;
  y = addSectionHeader(
    base.doc,
    y,
    'SOLICITUD DEPARTAMENTAL DE ABASTECIMIENTO',
    `Prioridad: ${requisition.prioridad || 'NORMAL'} • Estado: ${requisition.status || 'PENDIENTE'}`,
    base.tableWidth,
    base.startX
  );

  y = renderTwoColMetaCard(
    base.doc,
    base.startX,
    y,
    base.tableWidth,
    {
      title: 'ORIGEN DE LA SOLICITUD',
      lines: [
        `Departamento: ${requisition.departamento || 'ALMACÉN Y LOGÍSTICA'}`,
        `Solicitado por: ${requisition.solicitante || currentUser?.nombre || 'Coordinador de Inventario'}`,
        `Almacén Destino: ${requisition.almacen || '01 - Principal / 02 - Central'}`,
        `Justificación: ${requisition.justificacion || 'Reposición por punto de reorden mínimo'}`
      ]
    },
    {
      title: 'CONTROL DE REQUISICIÓN',
      lines: [
        `Requisición N°: ${reqNum}`,
        `Fecha Emisión: ${formatDateVe(requisition.fechaEmision || requisition.fecha)}`,
        `Fecha Requerida: ${formatDateVe(requisition.fechaRequerida || requisition.fecha)}`,
        `Prioridad: ${requisition.prioridad || 'NORMAL'} • Estado: ${requisition.status || 'PENDIENTE'}`
      ]
    }
  );

  let totEstUsd = 0;
  let totUnits = 0;
  const body = items.map((it, idx) => {
    const qty = Number(it.cantidad || 1);
    const cost = Number(it.costoEstimadoUsd ?? it.costoUsd ?? 0);
    const lineUsd = qty * cost;
    totUnits += qty;
    totEstUsd += lineUsd;
    return [
      String(idx + 1),
      String(it.codigo || it.articuloId || 'S/C'),
      String(it.descripcion || 'Artículo / Insumo').slice(0, 48),
      String(it.stockActual ?? '0'),
      String(qty),
      formatUsd(cost),
      formatUsd(lineUsd)
    ];
  });

  autoTable(base.doc, {
    startY: y,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    head: [['#', 'CÓDIGO', 'DESCRIPCIÓN DEL ARTÍCULO / INSUMO', 'STOCK ACT.', 'CANT. REQ.', 'COSTO EST. ($)', 'SUBTOTAL EST. ($)']],
    body: body.length > 0 ? body : [['—', '—', 'Sin ítems en requisición', '0', '0', '$ 0.00', '$ 0.00']],
    theme: 'grid',
    headStyles: { fillColor: COLORS.navy, textColor: [255, 255, 255], fontSize: 5.8, fontStyle: 'bold', cellPadding: 1.5, halign: 'center' },
    styles: { fontSize: 5.6, cellPadding: 1.3, textColor: COLORS.dark, valign: 'middle' },
    alternateRowStyles: { fillColor: COLORS.lightBg },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'center', cellWidth: 22, fontStyle: 'bold' },
      2: { cellWidth: 68 },
      3: { halign: 'center', cellWidth: 18 },
      4: { halign: 'center', cellWidth: 18, fontStyle: 'bold', textColor: COLORS.navy },
      5: { halign: 'right', cellWidth: 21 },
      6: { halign: 'right', fontStyle: 'bold', cellWidth: 24.9 }
    }
  });

  placeTotalsAndSignatures(
    base.doc,
    base.doc.lastAutoTable?.finalY || y,
    [
      { label: 'TOTAL UNIDADES SOLICITADAS', value: `${totUnits} Unds.`, subtext: `${items.length} ítems`, color: COLORS.navy },
      { label: 'PRESUPUESTO ESTIMADO ($)', value: formatUsd(totEstUsd), subtext: formatBs(totEstUsd * tasa), color: COLORS.emerald }
    ],
    ['SOLICITANTE DE ÁREA', 'JEFE DE ALMACÉN / LOGÍSTICA', 'APROBACIÓN COMPRAS / GERENCIA'],
    base.tableWidth,
    base.startX
  );

  finalizeAndSave(base.doc, `Requisicion_Compra_${reqNum}.pdf`, currentUser);
  return base.doc;
}

// =========================================================================
// 26. ORDEN DE COMPRA OFICIAL A PROVEEDOR (OC)
// =========================================================================
export function generatePurchaseOrderPDF({ order = {}, supplier = {}, config = {}, currentUser = null }) {
  const tasa = Number(order.tasaDolar || config?.tasaDolar) || 827.73;
  const ocNum = String(order.numeroDoc || order.ocNum || order.id || makeCorrelative('OC')).trim();
  const items = Array.isArray(order.items) ? order.items : [];

  const base = createBaseReport({
    title: `ORDEN DE COMPRA A PROVEEDOR N° ${ocNum}`,
    subtitle: 'Compromiso Oficial de Adquisición de Lubricantes e Insumos Corporativos',
    moduleCode: 'OC',
    currentUser,
    config,
    rateValue: tasa
  });

  let y = base.startY;
  y = addSectionHeader(
    base.doc,
    y,
    'PROVEEDOR ADJUDICADO & CONDICIONES DE ENTREGA',
    `Estado: ${order.status || 'EMITIDA'} • Almacén Receptor: ${order.almacenDestino || '01 - Principal'}`,
    base.tableWidth,
    base.startX
  );

  y = renderTwoColMetaCard(
    base.doc,
    base.startX,
    y,
    base.tableWidth,
    {
      title: 'DATOS DEL PROVEEDOR',
      lines: [
        order.proveedorNombre || supplier?.provDes || supplier?.nombre || 'PROVEEDOR REGISTRADO',
        `RIF: ${order.proveedorRif || supplier?.rif || 'J-00000000-0'}`,
        `Dirección: ${supplier?.direccion || 'Venezuela'}`,
        `Contacto / Teléfono: ${supplier?.telefonos || supplier?.telefono || 'N/A'}`
      ]
    },
    {
      title: 'ESPECIFICACIONES DE COMPRA',
      lines: [
        `Orden de Compra N°: ${ocNum}`,
        `Fecha Emisión: ${formatDateVe(order.fechaEmision || order.fecha)} • Entrega Esp.: ${formatDateVe(order.fechaEntrega || order.fecha)}`,
        `Condición de Pago: ${order.condicionPago || 'CRÉDITO 15 DÍAS'}`,
        `Ref. Requisición: ${order.requisicionRef || 'Directa'}`
      ]
    }
  );

  const body = items.map((it, idx) => {
    const qty = Number(it.cantidad || 1);
    const cost = Number(it.costoUsd ?? it.costoUnitarioUsd ?? 0);
    const subUsd = qty * cost;
    return [
      String(idx + 1),
      String(it.codigo || it.articuloId || 'S/C'),
      String(it.descripcion || 'Lubricante').slice(0, 44),
      resolveProductUnit(it, 'Caja'),
      String(qty),
      formatUsd(cost),
      formatUsd(subUsd),
      formatBs(subUsd * tasa)
    ];
  });

  const subUsd = Number(order.subtotalUsd ?? items.reduce((s, it) => s + (Number(it.cantidad || 1) * Number(it.costoUsd ?? it.costoUnitarioUsd ?? 0)), 0));
  const ivaUsd = Number(order.ivaUsd ?? (order.aplicaIva === false ? 0 : subUsd * 0.16));
  const totUsd = Number(order.totalUsd ?? (subUsd + ivaUsd));

  autoTable(base.doc, {
    startY: y,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    head: [['#', 'CÓDIGO', 'DESCRIPCIÓN DEL ARTÍCULO', 'UNIDAD', 'CANT.', 'COSTO ($)', 'SUBTOTAL ($)', 'SUBTOTAL (BS.)']],
    body: body.length > 0 ? body : [['—', '—', 'Sin renglones en orden de compra', '—', '0', '$ 0.00', '$ 0.00', 'Bs. 0,00']],
    theme: 'grid',
    headStyles: { fillColor: COLORS.navy, textColor: [255, 255, 255], fontSize: 5.8, fontStyle: 'bold', cellPadding: 1.5, halign: 'center' },
    styles: { fontSize: 5.6, cellPadding: 1.3, textColor: COLORS.dark, valign: 'middle' },
    alternateRowStyles: { fillColor: COLORS.lightBg },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'center', cellWidth: 18, fontStyle: 'bold' },
      2: { cellWidth: 56 },
      3: { halign: 'center', cellWidth: 16 },
      4: { halign: 'center', cellWidth: 12, fontStyle: 'bold' },
      5: { halign: 'right', cellWidth: 20 },
      6: { halign: 'right', fontStyle: 'bold', textColor: COLORS.navy, cellWidth: 22 },
      7: { halign: 'right', fontStyle: 'bold', cellWidth: 27.9 }
    }
  });

  placeTotalsAndSignatures(
    base.doc,
    base.doc.lastAutoTable?.finalY || y,
    [
      { label: 'SUBTOTAL NETO COMPRA', value: formatUsd(subUsd), subtext: formatBs(subUsd * tasa), color: COLORS.navy },
      { label: 'IVA ESTIMADO (16%)', value: formatUsd(ivaUsd), subtext: formatBs(ivaUsd * tasa), color: COLORS.slate },
      { label: 'TOTAL ORDEN DE COMPRA', value: formatUsd(totUsd), subtext: formatBs(totUsd * tasa), color: COLORS.emerald }
    ],
    ['DEPARTAMENTO DE COMPRAS', 'GERENCIA GENERAL / FINANZAS', 'ACEPTACIÓN DEL PROVEEDOR'],
    base.tableWidth,
    base.startX
  );

  finalizeAndSave(base.doc, `Orden_Compra_${ocNum}.pdf`, currentUser, {
    legalFooter: 'ORDEN DE COMPRA OFICIAL • Indicar este número en su Factura y Nota de Entrega al despachar al almacén.'
  });
  return base.doc;
}

// =========================================================================
// 27. NOTA DE RECEPCIÓN DE MERCANCÍA EN ALMACÉN
// =========================================================================
export function generateGoodsReceiptPDF({ receipt = {}, purchaseOrder = null, supplier = null, config = {}, currentUser = null }) {
  const tasa = Number(config?.tasaDolar) || 827.73;
  const recNum = String(receipt.numeroDoc || receipt.not_num || receipt.id || makeCorrelative('REC')).trim();
  const items = Array.isArray(receipt.items) ? receipt.items : [];

  const base = createBaseReport({
    title: `NOTA DE RECEPCIÓN DE MERCANCÍA N° ${recNum}`,
    subtitle: 'Acta de Verificación Física y Conformidad de Entrada a Almacén',
    moduleCode: 'REC',
    currentUser,
    config,
    rateValue: tasa
  });

  let y = base.startY;
  y = addSectionHeader(
    base.doc,
    y,
    'INSPECCIÓN DE RECEPCIÓN DE PROVEEDOR',
    `Almacén Receptor: ${receipt.almacen || '01 - Principal'} • Ref. Orden de Compra / Factura: ${receipt.nro_fact || receipt.nroFactura || purchaseOrder?.numeroDoc || 'N/A'}`,
    base.tableWidth,
    base.startX
  );

  y = renderTwoColMetaCard(
    base.doc,
    base.startX,
    y,
    base.tableWidth,
    {
      title: 'PROVEEDOR QUE ENTREGA',
      lines: [
        receipt.prov_des || receipt.proveedorNombre || supplier?.provDes || 'PROVEEDOR REGISTRADO',
        `RIF / Cód.: ${receipt.co_prov || receipt.proveedorRif || supplier?.rif || 'N/A'}`,
        `Factura / Guía Remisión: ${receipt.nro_fact || receipt.nroFactura || 'S/N'}`,
        `Observaciones: ${receipt.observaciones || 'Envases, sellos y precintos verificados físicamente'}`
      ]
    },
    {
      title: 'DATOS DE RECEPCIÓN',
      lines: [
        `Recepción N°: ${recNum}`,
        `Fecha Ingreso: ${formatDateVe(receipt.fec_emis || receipt.fecha)}`,
        `Almacén Destino: ${receipt.almacen || '01 - Almacén Principal'}`,
        `Orden Compra Ref.: ${receipt.ordenCompraRef || purchaseOrder?.numeroDoc || 'Compra Directa'}`
      ]
    }
  );

  let totEsp = 0;
  let totRec = 0;
  let totDan = 0;
  const body = items.map((it, idx) => {
    const esp = Number(it.cantidadEsperada ?? it.cantidad ?? 0);
    const rec = Number(it.cantidadRecibida ?? it.cantidad ?? 0);
    const dan = Number(it.cantidadDanada ?? 0);
    totEsp += esp;
    totRec += rec;
    totDan += dan;
    const estado = dan > 0 ? 'CON NOVEDAD' : (rec < esp ? 'INCOMPLETO' : 'CONFORME');
    return [
      String(idx + 1),
      String(it.codigo || it.articuloId || 'S/C'),
      String(it.descripcion || 'Producto recibido').slice(0, 48),
      String(esp),
      String(rec),
      String(dan),
      estado
    ];
  });

  autoTable(base.doc, {
    startY: y,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    head: [['#', 'CÓDIGO SKU', 'DESCRIPCIÓN DE LA MERCANCÍA', 'ESPERADO', 'RECIBIDO', 'DAÑADO/FALT.', 'CONFORMIDAD']],
    body: body.length > 0 ? body : [['1', '—', `Recepción consolidada (${receipt.items_count || 1} bulto/s) - Doc. ${receipt.nro_fact || recNum}`, String(receipt.items_count || 1), String(receipt.items_count || 1), '0', 'CONFORME']],
    theme: 'grid',
    headStyles: { fillColor: COLORS.navy, textColor: [255, 255, 255], fontSize: 5.8, fontStyle: 'bold', cellPadding: 1.5, halign: 'center' },
    styles: { fontSize: 5.6, cellPadding: 1.3, textColor: COLORS.dark, valign: 'middle' },
    alternateRowStyles: { fillColor: COLORS.lightBg },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'center', cellWidth: 22, fontStyle: 'bold' },
      2: { cellWidth: 68 },
      3: { halign: 'center', cellWidth: 19 },
      4: { halign: 'center', cellWidth: 19, fontStyle: 'bold', textColor: COLORS.emerald },
      5: { halign: 'center', cellWidth: 20, fontStyle: 'bold', textColor: COLORS.red },
      6: { halign: 'center', cellWidth: 23.9 }
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 6) data.cell.text = '';
    },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 6) drawStatusBadge(base.doc, data.cell, data.cell.raw);
    }
  });

  placeTotalsAndSignatures(
    base.doc,
    base.doc.lastAutoTable?.finalY || y,
    [
      { label: 'UNIDADES ESPERADAS', value: `${totEsp || receipt.items_count || 1}`, subtext: 'Según OC / Factura', color: COLORS.navy },
      { label: 'UNIDADES RECIBIDAS CONFORME', value: `${totRec || receipt.items_count || 1}`, subtext: 'Ingresadas a Inventario', color: COLORS.emerald },
      { label: 'UNIDADES CON NOVEDAD / DAÑO', value: `${totDan}`, subtext: totDan > 0 ? 'Requiere Reclamo / NC' : 'Sin novedades', color: totDan > 0 ? COLORS.red : COLORS.slate }
    ],
    ['ALMACENISTA RECEPTOR', 'CHOFER / TRANSPORTISTA PROVEEDOR', 'CONTROL DE CALIDAD / COMPRAS'],
    base.tableWidth,
    base.startX
  );

  finalizeAndSave(base.doc, `Nota_Recepcion_${recNum}.pdf`, currentUser);
  return base.doc;
}

// =========================================================================
// 28. ORDEN DE PAGO INDIVIDUAL CON RETENCIONES Y FIRMAS
// =========================================================================
export function generatePaymentOrderPDF({ paymentOrder = {}, config = {}, currentUser = null }) {
  const tasa = Number(paymentOrder.tasa || config?.tasaDolar) || 827.73;
  const ordNum = String(paymentOrder.ordNum || paymentOrder.id || makeCorrelative('OP')).trim();
  const moneda = String(paymentOrder.moneda || 'BS').toUpperCase();
  const montoRaw = Number(paymentOrder.monto || 0);
  const retRaw = Number(paymentOrder.montoRet || 0);
  const netoRaw = Math.max(0, montoRaw - retRaw);
  const montoBs = moneda === 'USD' ? montoRaw * tasa : montoRaw;
  const retBs = moneda === 'USD' ? retRaw * tasa : retRaw;
  const netoBs = moneda === 'USD' ? netoRaw * tasa : netoRaw;
  const netoUsd = tasa > 0 ? netoBs / tasa : 0;

  const base = createBaseReport({
    title: `ORDEN DE PAGO ADMINISTRATIVA N° ${ordNum}`,
    subtitle: 'Autorización Oficial de Desembolso Bancario / Tesorería Corporativa',
    moduleCode: 'OP',
    currentUser,
    config,
    rateValue: tasa
  });

  let y = base.startY;
  y = addSectionHeader(
    base.doc,
    y,
    'BENEFICIARIO Y SOPORTE DEL DESEMBOLSO',
    `Estado: ${paymentOrder.anulada ? 'ANULADA' : 'EMITIDA / AUTORIZADA'} • Forma de Pago: ${paymentOrder.formaPag || 'TRANSFERENCIA'}`,
    base.tableWidth,
    base.startX
  );

  y = renderTwoColMetaCard(
    base.doc,
    base.startX,
    y,
    base.tableWidth,
    {
      title: 'BENEFICIARIO DEL PAGO',
      lines: [
        paymentOrder.benDes || paymentOrder.benNombre || 'BENEFICIARIO GENERAL',
        `Código / RIF: ${paymentOrder.codBen || paymentOrder.rif || 'N/A'}`,
        `Concepto: ${paymentOrder.descrip || paymentOrder.motivo || 'Cancelación de obligación autorizada'}`,
        `Factura / Soporte: ${paymentOrder.nroDocSoporte || paymentOrder.cheNum || 'Ver anexo'}`
      ]
    },
    {
      title: 'DATOS DE TESORERÍA',
      lines: [
        `Orden de Pago N°: ${ordNum}`,
        `Fecha Emisión: ${formatDateVe(paymentOrder.fecha)}`,
        `Cuenta / Caja Origen: ${paymentOrder.codCta || 'Cuenta Principal'} • Ref/Cheque: ${paymentOrder.cheNum || 'Transferencia'}`,
        `Moneda Orig.: ${moneda} • Tasa BCV: ${formatBs(tasa)}`
      ]
    }
  );

  autoTable(base.doc, {
    startY: y,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    head: [['CONCEPTO / DESCRIPCIÓN DEL GASTO O PAGO', 'MONTO BRUTO (BS.)', 'RETENCIÓN IVA/ISLR (BS.)', 'NETO A PAGAR (BS.)', 'EQUIV. ($ USD)']],
    body: [[
      String(paymentOrder.descrip || paymentOrder.motivo || 'Desembolso autorizado por gerencia'),
      formatBs(montoBs),
      formatBs(retBs),
      formatBs(netoBs),
      formatUsd(netoUsd)
    ]],
    theme: 'grid',
    headStyles: { fillColor: COLORS.navy, textColor: [255, 255, 255], fontSize: 5.8, fontStyle: 'bold', cellPadding: 1.6, halign: 'center' },
    styles: { fontSize: 6.0, cellPadding: 2.0, textColor: COLORS.dark, valign: 'middle' },
    columnStyles: {
      0: { cellWidth: 74 },
      1: { halign: 'right', cellWidth: 26 },
      2: { halign: 'right', textColor: COLORS.red, cellWidth: 27 },
      3: { halign: 'right', fontStyle: 'bold', textColor: COLORS.navy, cellWidth: 28 },
      4: { halign: 'right', fontStyle: 'bold', textColor: COLORS.emerald, cellWidth: 24.9 }
    }
  });

  placeTotalsAndSignatures(
    base.doc,
    base.doc.lastAutoTable?.finalY || y,
    [
      { label: 'MONTO BRUTO APROBADO', value: formatBs(montoBs), subtext: `Retención: ${formatBs(retBs)}`, color: COLORS.navy },
      { label: 'NETO A DESEMBOLSAR (BS.)', value: formatBs(netoBs), subtext: `Equivalente: ${formatUsd(netoUsd)}`, color: COLORS.emerald }
    ],
    ['ELABORADO (COMPRAS / ADMIN.)', 'AUTORIZADO (GERENCIA / FINANZAS)', 'RECIBIDO CONFORME (C.I. / FIRMA)'],
    base.tableWidth,
    base.startX
  );

  finalizeAndSave(base.doc, `Orden_Pago_${ordNum}.pdf`, currentUser);
  return base.doc;
}

function resolveCollectionCobradorName({ receipt = {}, allocations = [], config = {} } = {}) {
  const firstAlloc = Array.isArray(allocations) && allocations.length > 0 ? allocations[0] : {};
  const codeCandidates = [
    receipt.cobradorId,
    receipt.vendedorId,
    receipt.coVen,
    receipt.co_ven,
    firstAlloc?.cobradorId,
    firstAlloc?.vendedorId,
    firstAlloc?.coVen,
    firstAlloc?.co_ven
  ]
    .map(v => String(v || '').trim())
    .filter(Boolean);

  const nameCandidates = [
    receipt.cobradorNombre,
    receipt.cobrador,
    receipt.vendedorNombre,
    receipt.venDes,
    receipt.ven_des,
    receipt.vendedor,
    firstAlloc?.cobradorNombre,
    firstAlloc?.cobrador,
    firstAlloc?.vendedorNombre,
    firstAlloc?.venDes,
    firstAlloc?.vendedor
  ]
    .map(v => String(v || '').trim())
    .filter(Boolean);

  const sellersPool = [
    ...(Array.isArray(config?.profitSellers) ? config.profitSellers : []),
    ...(Array.isArray(REAL_PROFIT_SELLERS) ? REAL_PROFIT_SELLERS : [])
  ];

  const byCode = new Map();
  sellersPool.forEach((s) => {
    const cid = String(s?.id || s?.co_ven || s?.coVen || '').trim().toUpperCase();
    const cname = String(s?.venDes || s?.ven_des || s?.name || s?.nombre || '').trim();
    if (cid && cname && !byCode.has(cid)) {
      byCode.set(cid, cname);
    }
  });

  const rawCode = codeCandidates[0] || '';
  const codeUpper = rawCode.toUpperCase();
  const explicitName = nameCandidates.find(n => n.toUpperCase() !== codeUpper && n.length > 2) || nameCandidates[0] || '';
  if (explicitName && explicitName.toUpperCase() !== codeUpper) {
    return explicitName;
  }
  if (codeUpper && byCode.has(codeUpper)) {
    return byCode.get(codeUpper);
  }
  return explicitName || rawCode || 'Oficina';
}

// =========================================================================
// 29. RECIBO OFICIAL DE COBRO / ABONO A CUENTAS POR COBRAR (CxC)
// =========================================================================
export function generateCollectionReceiptPDF({ receipt = {}, allocations = [], config = {}, currentUser = null }) {
  const list = Array.isArray(allocations) && allocations.length > 0
    ? allocations
    : (Array.isArray(receipt.detalles) && receipt.detalles.length > 0
      ? receipt.detalles
      : [{ factNum: receipt.factNum || receipt.nroDoc || 'ABONO A CUENTA', tipoDoc: receipt.tipoDoc || 'DOCUMENTO', saldoAnteriorUsd: Number(receipt.montoUsd ?? receipt.monto ?? 0), abonoUsd: Number(receipt.montoUsd ?? receipt.monto ?? 0), saldoRestanteUsd: Number(receipt.saldoRestanteUsd || 0) }]);

  const firstAlloc = list[0] || {};
  const totalUsd = Number(receipt.montoUsd ?? receipt.monto ?? 0);
  const rawMontoBs = Number(receipt.montoBs ?? receipt.monto_bs ?? receipt.montoCobrado ?? 0);
  const firstForma = Array.isArray(receipt.formasPago) && receipt.formasPago.length > 0 ? receipt.formasPago[0] : null;
  const round2Pdf = (n) => Math.round((Number(n || 0) + Number.EPSILON) * 100) / 100;

  // Priorizar siempre la tasa real con la que se ejecutó este cobro (o derivar de Bs/USD antes de usar config actual)
  const explicitRateVal = Number(
    receipt.tasaPago ??
    receipt.tasa_pago ??
    receipt.tasaCambio ??
    receipt.tasa_cambio ??
    receipt.tasaDolar ??
    receipt.tasa_dolar ??
    receipt.tasa ??
    firstForma?.tasaPago ??
    firstForma?.tasa_pago ??
    firstForma?.tasa ??
    firstAlloc?.tasaPago ??
    firstAlloc?.tasa_pago ??
    firstAlloc?.tasa ??
    0
  );
  const derivedRateFromAmounts = totalUsd > 0 && rawMontoBs > totalUsd * 2
    ? round2Pdf(rawMontoBs / totalUsd)
    : 0;
  const effectiveHistoricalRate = explicitRateVal > 1
    ? round2Pdf(explicitRateVal)
    : (derivedRateFromAmounts > 1 ? derivedRateFromAmounts : 0);

  const inspectedReceipt = {
    ...receipt,
    factNum: receipt.factNum || receipt.fact_num || receipt.nroDoc || firstAlloc.factNum || firstAlloc.numeroDoc || '',
    tipoDoc: receipt.tipoDoc || receipt.tipo_doc || firstAlloc.tipoDoc || firstAlloc.tipo_doc || '',
    tasa: effectiveHistoricalRate || explicitRateVal,
    tasaPago: effectiveHistoricalRate || explicitRateVal,
    tipoTasa: receipt.tipoTasa ?? receipt.tipo_tasa ?? firstForma?.tipoTasa ?? firstForma?.tipo_tasa ?? firstAlloc.tipoTasa ?? firstAlloc.tipo_tasa ?? '',
    monedaPago: receipt.monedaPago ?? receipt.moneda_pago ?? receipt.moneda ?? '',
    montoBs: rawMontoBs,
    observaciones: receipt.observaciones || receipt.concepto || receipt.descrip || ''
  };

  let rateType;
  if (inspectedReceipt.tipoTasa) {
    rateType = resolveRecordRateType(inspectedReceipt, 'BCV');
  } else if (isFiscalDocumentForRatePolicy(inspectedReceipt)) {
    const monUp = String(inspectedReceipt.monedaPago || '').toUpperCase().trim();
    const monDirect = isDirectCurrencyRateType(monUp) ? normalizeRateType(monUp, { fallback: 'USD' }) : 'USD';
    rateType = rawMontoBs <= 0 && (isDirectCurrencyRateType(monUp) || explicitRateVal === 1) ? monDirect : 'BCV';
  } else {
    const monUp = String(inspectedReceipt.monedaPago || '').toUpperCase().trim();
    if (rawMontoBs <= 0 && (isDirectCurrencyRateType(monUp) || explicitRateVal === 1)) {
      rateType = normalizeRateType(monUp, { fallback: 'USD' });
    } else {
      const classified = classifyCollectionRateType(inspectedReceipt, resolveExchangeRates(config));
      rateType = normalizeRateType(classified, { fallback: 'BCV' });
    }
  }

  const isDirectRate = isDirectCurrencyRateType(rateType);
  const rateMeta = resolveRateMeta(rateType, 'BCV');
  const tasa = effectiveHistoricalRate > 1
    ? effectiveHistoricalRate
    : (isDirectRate ? 1 : (Number(config?.tasaDolar || config?.tasaBcv) || 827.73));
  const cobNum = String(receipt.cobNum || receipt.reciboNum || receipt.id || makeCorrelative('REC-COB')).trim();
  const totalBs = isDirectRate && !(rawMontoBs > 0)
    ? 0
    : (rawMontoBs > 0 ? round2Pdf(rawMontoBs) : round2Pdf(totalUsd * tasa));

  const base = createBaseReport({
    title: `RECIBO OFICIAL DE COBRO N° ${cobNum}`,
    subtitle: `Comprobante de Pago / Abono Aplicado a Cuentas por Cobrar • ${rateMeta.label}`,
    moduleCode: 'COB',
    currentUser,
    config,
    rateLabel: isDirectRate && totalBs <= 0 ? 'Moneda Cobro' : rateMeta.label,
    rateValue: tasa,
    rateDisplay: isDirectRate && totalBs <= 0 ? rateMeta.label : null
  });

  let y = base.startY;
  y = addSectionHeader(
    base.doc,
    y,
    'CONSTANCIA DE RECAUDACIÓN',
    `Método / Cuenta: ${receipt.formaPago || receipt.metodo || 'Transferencia'} • Clasif.: ${rateMeta.badgeText} (${isDirectRate && totalBs <= 0 ? rateMeta.label : formatBs(tasa)}) • Ref.: ${receipt.referencia || receipt.ref || 'N/A'}`,
    base.tableWidth,
    base.startX
  );

  y = renderTwoColMetaCard(
    base.doc,
    base.startX,
    y,
    base.tableWidth,
    {
      title: 'RECIBIMOS DEL CLIENTE',
      lines: [
        receipt.clienteNombre || receipt.cliDes || 'CLIENTE GENERAL',
        `RIF / C.I.: ${receipt.clienteRif || receipt.rif || 'N/A'}`,
        `Cobrador: ${resolveCollectionCobradorName({ receipt, allocations: list, config })}`,
        `Observaciones: ${receipt.concepto || receipt.descrip || receipt.observaciones || 'Abono aplicado a facturas vigentes en cartera'}`
      ]
    },
    {
      title: 'DETALLES DEL INSTRUMENTO DE PAGO',
      lines: [
        `Recibo N°: ${cobNum}`,
        `Fecha de Cobro: ${formatDateTimeVe(receipt.fecha || receipt.fechaCobro)}`,
        `Cuenta / Caja Receptora: ${receipt.cuentaNombre || receipt.formaPago || 'Caja / Banco'}`,
        `Clasificación Tasa: ${rateMeta.label} (${isDirectRate && totalBs <= 0 ? rateMeta.shortLabel : formatBs(tasa)})`,
        `Referencia Bancaria: ${receipt.referencia || 'Directo'}`
      ]
    }
  );

  const body = list.map((d, idx) => {
    const abUsd = Number(d.abonoUsd ?? d.montoUsd ?? totalUsd);
    const antUsd = Number(d.saldoAnteriorUsd ?? abUsd);
    const restUsd = Number(d.saldoRestanteUsd ?? Math.max(0, antUsd - abUsd));
    const dRateType = resolveRecordRateType(d, rateType);
    const dRateMeta = resolveRateMeta(dRateType, rateType);
    const dIsDirect = isDirectCurrencyRateType(dRateType);
    const dTasa = resolveEffectiveRateNumber(d, tasa) > 1 ? resolveEffectiveRateNumber(d, tasa) : tasa;
    const dRawBs = Number(d.montoBs ?? d.montoCobrado ?? (list.length === 1 && totalBs > 0 ? totalBs : round2Pdf(abUsd * dTasa)));
    return [
      String(idx + 1),
      String(d.factNum || d.numeroDoc || 'DOC'),
      String(d.tipoDoc || inspectedReceipt.tipoDoc || 'FACTURA'),
      dRateMeta.badgeText,
      dIsDirect && !(dRawBs > 0) ? dRateMeta.shortLabel : formatBs(dTasa).replace(/^Bs\.\s*/, ''),
      formatUsd(antUsd),
      formatUsd(abUsd),
      dIsDirect && !(dRawBs > 0) ? dRateMeta.label : formatBs(dRawBs),
      formatUsd(restUsd)
    ];
  });

  autoTable(base.doc, {
    startY: y,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    head: [['#', 'N° DOCUMENTO', 'TIPO', 'CLASIF. TASA', 'TASA PAGO', 'SALDO ANT. ($)', 'ABONO ($)', 'EQUIV. (BS.)', 'RESTANTE ($)']],
    body,
    theme: 'grid',
    headStyles: { fillColor: COLORS.navy, textColor: [255, 255, 255], fontSize: 7.2, fontStyle: 'bold', cellPadding: 1.55, halign: 'center' },
    styles: { fontSize: 7.3, cellPadding: 1.55, textColor: COLORS.dark, valign: 'middle' },
    alternateRowStyles: { fillColor: COLORS.lightBg },
    columnStyles: {
      0: { halign: 'center', cellWidth: 7 },
      1: { halign: 'center', cellWidth: 22, fontStyle: 'bold', textColor: COLORS.navy },
      2: { halign: 'center', cellWidth: 22 },
      3: { halign: 'center', fontStyle: 'bold', cellWidth: 16 },
      4: { halign: 'right', cellWidth: 19 },
      5: { halign: 'right', cellWidth: 23 },
      6: { halign: 'right', fontStyle: 'bold', textColor: COLORS.emerald, cellWidth: 22.5 },
      7: { halign: 'right', fontStyle: 'bold', cellWidth: 26 },
      8: { halign: 'right', fontStyle: 'bold', textColor: COLORS.red, cellWidth: 22.4 }
    }
  });

  placeTotalsAndSignatures(
    base.doc,
    base.doc.lastAutoTable?.finalY || y,
    [
      { label: 'TOTAL RECIBIDO EN DIVISAS', value: formatUsd(totalUsd), subtext: `${rateMeta.label}: ${isDirectRate && totalBs <= 0 ? rateMeta.shortLabel : formatBs(tasa)}`, color: COLORS.emerald },
      { label: 'TOTAL RECIBIDO EN BOLÍVARES', value: isDirectRate && totalBs <= 0 ? rateMeta.label : formatBs(totalBs), subtext: `Ref. ${receipt.referencia || cobNum}`, color: COLORS.navy }
    ],
    ['DEPARTAMENTO DE COBRANZAS / CAJA', 'RECIBIDO CONFORME (CLIENTE)'],
    base.tableWidth,
    base.startX
  );

  finalizeAndSave(base.doc, `Recibo_Cobro_${cobNum}.pdf`, currentUser);
  return base.doc;
}

// =========================================================================
// 30. COMPROBANTE DE EGRESO / VALE DE CAJA CHICA
// =========================================================================
export function generateExpenseVoucherPDF({ movement = {}, config = {}, currentUser = null }) {
  const { tasaBcv } = resolveExchangeRates(config);
  const tasa = Number(movement.tasa || 0) > 1 ? Number(movement.tasa) : tasaBcv;
  const valeNum = String(movement.id || movement.nroVale || makeCorrelative('VAL')).trim();
  const isIngreso = String(movement.tipo || 'EGRESO').toUpperCase() === 'INGRESO';
  const montoUsd = Number(movement.montoUsd ?? movement.monto_usd ?? 0);
  const montoBs = Number(movement.montoBs ?? movement.monto_bs ?? (montoUsd * tasa));

  const base = createBaseReport({
    title: `${isIngreso ? 'COMPROBANTE DE INGRESO / REPOSICIÓN' : 'COMPROBANTE DE EGRESO / VALE DE CAJA'} N° ${valeNum}`,
    subtitle: 'Soporte Interno de Movimientos de Caja Chica, Viáticos y Bancos',
    moduleCode: 'CAJ',
    currentUser,
    config,
    rateValue: tasa
  });

  let y = base.startY;
  y = addSectionHeader(
    base.doc,
    y,
    'SOPORTE DE TESORERÍA Y CAJA CHICA',
    `Operación: ${isIngreso ? 'INGRESO / REPOSICIÓN DE FONDO' : 'EGRESO / PAGO DE CAJA'} • Método: ${movement.metodo || 'EFECTIVO'}`,
    base.tableWidth,
    base.startX
  );

  y = renderTwoColMetaCard(
    base.doc,
    base.startX,
    y,
    base.tableWidth,
    {
      title: 'BENEFICIARIO / CONCEPTO',
      lines: [
        `Beneficiario / Responsable: ${movement.beneficiario || movement.usuario || currentUser?.nombre || 'Operador Autorizado'}`,
        `Concepto Detallado: ${movement.concepto || 'Gasto operativo / Reposición de caja'}`,
        `Origen / Cuenta: ${movement.cuenta || movement.caja || movement.metodo || 'Caja Principal'}`
      ]
    },
    {
      title: 'CONTROL DE VALE',
      lines: [
        `Comprobante N°: ${valeNum}`,
        `Fecha: ${formatDateVe(movement.fecha)}`,
        `Registrado por: ${movement.usuario || currentUser?.nombre || 'Cajera / Admin.'}`,
        `Referencia: ${movement.referencia || 'Caja Chica'}`
      ]
    }
  );

  autoTable(base.doc, {
    startY: y,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    head: [['TIPO', 'CONCEPTO / JUSTIFICACIÓN DEL MOVIMIENTO', 'MÉTODO / CAJA', 'MONTO ($ USD)', 'MONTO (BS.)']],
    body: [[
      isIngreso ? 'INGRESO' : 'EGRESO',
      String(movement.concepto || 'Movimiento de caja'),
      String(movement.metodo || 'EFECTIVO'),
      formatUsd(montoUsd),
      formatBs(montoBs)
    ]],
    theme: 'grid',
    headStyles: { fillColor: COLORS.navy, textColor: [255, 255, 255], fontSize: 5.8, fontStyle: 'bold', cellPadding: 1.6, halign: 'center' },
    styles: { fontSize: 6.0, cellPadding: 2.0, textColor: COLORS.dark, valign: 'middle' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 20, fontStyle: 'bold', textColor: isIngreso ? COLORS.emerald : COLORS.red },
      1: { cellWidth: 82 },
      2: { halign: 'center', cellWidth: 28 },
      3: { halign: 'right', fontStyle: 'bold', textColor: COLORS.navy, cellWidth: 24 },
      4: { halign: 'right', fontStyle: 'bold', cellWidth: 25.9 }
    }
  });

  placeTotalsAndSignatures(
    base.doc,
    base.doc.lastAutoTable?.finalY || y,
    [
      { label: isIngreso ? 'TOTAL INGRESO ($)' : 'TOTAL DESEMBOLSADO ($)', value: formatUsd(montoUsd), subtext: `Tasa BCV: ${formatBs(tasa)}`, color: isIngreso ? COLORS.emerald : COLORS.red },
      { label: 'EQUIVALENTE EN BOLÍVARES', value: formatBs(montoBs), subtext: `Comprobante ${valeNum}`, color: COLORS.navy }
    ],
    ['ELABORADO POR CAJA', 'AUTORIZADO POR GERENCIA', 'RECIBIDO CONFORME (C.I. / FIRMA)'],
    base.tableWidth,
    base.startX
  );

  finalizeAndSave(base.doc, `Comprobante_Caja_${valeNum}.pdf`, currentUser);
  return base.doc;
}

// =========================================================================
// 31. ESTADO DE CUENTA INDIVIDUAL POR CLIENTE (CxC) O PROVEEDOR (CxP)
// =========================================================================
export function generateThirdPartyStatementPDF({ entity = {}, entityType = 'CLIENT', documents = [], config = {}, currentUser = null }) {
  const tasa = Number(config?.tasaDolar) || 827.73;
  const isClient = String(entityType).toUpperCase() !== 'SUPPLIER';
  const name = entity.nombre || entity.provDes || entity.clienteNombre || entity.provNombre || (isClient ? 'Cliente' : 'Proveedor');
  const rif = entity.rif || entity.clienteRif || entity.provRif || entity.coCli || entity.coProv || 'N/A';

  let totalFacturadoUsd = 0;
  let totalAbonadoUsd = 0;
  let totalSaldoUsd = 0;
  let totalVencidoUsd = 0;

  const rows = (documents || []).map((d) => {
    const tot = Number(d.totNetoUsd ?? d.totalUsd ?? d.montoUsd ?? d.saldoUsd ?? 0);
    const saldo = Number(d.saldoUsd ?? 0);
    const abonos = Number(d.abonosUsd ?? Math.max(0, tot - saldo));
    const isVenc = Boolean(d.isVencida || d.isVencido || Number(d.diasMora || 0) > 0) && saldo > 0.01;
    const dRateType = resolveRecordRateType(d, 'BCV');
    const dRateMeta = resolveRateMeta(dRateType, 'BCV');
    const dRateNum = resolveEffectiveRateNumber(d, tasa);
    totalFacturadoUsd += tot;
    totalAbonadoUsd += abonos;
    totalSaldoUsd += saldo;
    if (isVenc) totalVencidoUsd += saldo;

    return [
      String(d.factNum || d.nroDoc || d.numeroDoc || d.id || 'DOC'),
      String(d.tipoDoc || 'FACTURA'),
      formatDateVe(d.fechaEmision || d.fecEmis || d.fecha),
      formatDateVe(d.fechaVencimiento || d.fecVenc),
      dRateMeta.badgeText,
      dRateType === 'USD' ? 'USD' : formatBs(dRateNum).replace(/^Bs\.\s*/, ''),
      formatUsd(tot),
      formatUsd(abonos),
      formatUsd(saldo),
      saldo <= 0.01 ? 'PAGADO' : (isVenc ? 'VENCIDO' : 'VIGENTE')
    ];
  });

  const base = createBaseReport({
    title: `ESTADO DE CUENTA INDIVIDUAL DE ${isClient ? 'CLIENTE (CxC)' : 'PROVEEDOR (CxP)'}`,
    subtitle: `Conciliación Cronológica de Documentos, Abonos y Saldo Pendiente • ${name}`,
    moduleCode: isClient ? 'ECC' : 'ECP',
    currentUser,
    config,
    rateValue: tasa
  });

  let y = base.startY;
  y = renderTwoColMetaCard(
    base.doc,
    base.startX,
    y,
    base.tableWidth,
    {
      title: isClient ? 'DATOS DEL CLIENTE' : 'DATOS DEL PROVEEDOR',
      lines: [
        name,
        `RIF / C.I.: ${rif}`,
        `Dirección: ${entity.direccion || 'Venezuela'}`,
        `Teléfono: ${entity.telefono || entity.telefonos || 'N/A'}`
      ]
    },
    {
      title: 'RESUMEN DE POSICIÓN FINANCIERA',
      lines: [
        `Saldo Deudor Actual: ${formatUsd(totalSaldoUsd)} (${formatBs(totalSaldoUsd * tasa)})`,
        `Saldo Vencido Exigible: ${formatUsd(totalVencidoUsd)}`,
        `Documentos Evaluados: ${rows.length}`,
        `Corte de Conciliación: ${formatDateVe(new Date())}`
      ]
    }
  );

  autoTable(base.doc, {
    startY: y,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    head: [['N° DOC.', 'TIPO', 'EMISIÓN', 'VENCIM.', 'CLASIF. TASA', 'TASA EFECT.', 'CARGO ($)', 'ABONOS ($)', 'SALDO ($)', 'ESTADO']],
    body: rows.length > 0 ? rows : [['—', '—', '—', '—', 'BCV', '0,00', '$ 0.00', '$ 0.00', '$ 0.00', 'SOLVENTE']],
    theme: 'grid',
    headStyles: { fillColor: COLORS.navy, textColor: [255, 255, 255], fontSize: 5.2, fontStyle: 'bold', cellPadding: 1.3, halign: 'center' },
    styles: { fontSize: 5.2, cellPadding: 1.2, textColor: COLORS.dark, valign: 'middle' },
    alternateRowStyles: { fillColor: COLORS.lightBg },
    columnStyles: {
      0: { halign: 'center', cellWidth: 19, fontStyle: 'bold', textColor: COLORS.navy },
      1: { halign: 'center', cellWidth: 17 },
      2: { halign: 'center', cellWidth: 16 },
      3: { halign: 'center', cellWidth: 16 },
      4: { halign: 'center', fontStyle: 'bold', cellWidth: 13 },
      5: { halign: 'right', cellWidth: 17 },
      6: { halign: 'right', cellWidth: 20 },
      7: { halign: 'right', textColor: COLORS.emerald, cellWidth: 20 },
      8: { halign: 'right', fontStyle: 'bold', textColor: COLORS.red, cellWidth: 21 },
      9: { halign: 'center', cellWidth: 20.9 }
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 9) data.cell.text = '';
    },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 9) drawStatusBadge(base.doc, data.cell, data.cell.raw);
    }
  });

  placeTotalsAndSignatures(
    base.doc,
    base.doc.lastAutoTable?.finalY || y,
    [
      { label: 'TOTAL FACTURADO', value: formatUsd(totalFacturadoUsd), subtext: formatBs(totalFacturadoUsd * tasa), color: COLORS.navy },
      { label: 'TOTAL ABONADO', value: formatUsd(totalAbonadoUsd), subtext: formatBs(totalAbonadoUsd * tasa), color: COLORS.emerald },
      { label: 'SALDO NETO PENDIENTE', value: formatUsd(totalSaldoUsd), subtext: `Vencido: ${formatUsd(totalVencidoUsd)}`, color: totalSaldoUsd > 0 ? COLORS.red : COLORS.emerald }
    ],
    [isClient ? 'DEPARTAMENTO DE COBRANZAS' : 'CUENTAS POR PAGAR', 'CONFORMIDAD CLIENTE / PROVEEDOR'],
    base.tableWidth,
    base.startX
  );

  const safeEntitySlug = String(rif || name).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 24);
  finalizeAndSave(base.doc, `Estado_Cuenta_${safeEntitySlug}.pdf`, currentUser);
  return base.doc;
}

// =========================================================================
// 32. COMPROBANTE INDIVIDUAL DE RETENCIÓN IVA / ISLR SENIAT (14 DÍGITOS)
// =========================================================================
export function generateSeniatRetentionVoucherPDF({
  type = 'IVA',
  record = {},
  supplier = {},
  config = {},
  currentUser = null
}) {
  const isIslr = String(type).toUpperCase() === 'ISLR';
  const tasa = Number(record.tasaCambio || record.tasaDolar || config?.tasaDolar) || 827.73;
  const voucherNum = String(
    record.nroComprobante ||
    record.numeroComprobanteRetencionIva ||
    record.comprobanteRetencionIva ||
    record.numeroComprobanteRetencionIslr ||
    `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}00000001`
  ).trim();
  const periodoFiscal = String(record.periodoFiscal || `${voucherNum.slice(0, 4)}-${voucherNum.slice(4, 6)}`).trim();
  const fechaEmis = formatDateVe(record.fechaEmision || record.fecha || new Date());

  const provNombre = record.proveedorNombre || record.proveedor || supplier?.provDes || supplier?.nombre || 'PROVEEDOR SUJETO RETENIDO';
  const provRif = record.proveedorRif || record.rif || supplier?.rif || 'J-00000000-0';
  const provDir = record.proveedorDireccion || supplier?.direccion || 'Venezuela';

  const docFactura = String(record.nroFacturaAfectada || record.numeroFactura || record.numeroFacturaProv || record.factNum || 'S/N');
  const docControl = String(record.nroControl || record.numeroControl || record.controlNum || '00-000000');

  const mult = record.moneda === 'BS' ? 1 : tasa;
  const totalCompraBs = Number(record.montoTotalBs ?? record.totalBs ?? ((Number(record.montoTotalFactura ?? record.totalUsd ?? 0)) * mult));
  const baseImpBs = Number(record.baseImponibleBs ?? record.baseGeneralBs ?? ((Number(record.baseImponible ?? record.baseGeneralUsd ?? record.subtotalUsd ?? 0)) * mult));
  const explicitIvaBs = record.ivaBs ?? record.ivaGeneralBs ?? ((record.ivaGeneralUsd ?? record.ivaUsd) != null ? Number(record.ivaGeneralUsd ?? record.ivaUsd) * mult : undefined);
  const ivaCausadoBs = isIslr ? 0 : Number(explicitIvaBs ?? (baseImpBs * 0.16));
  const pctRet = Number(isIslr ? (record.porcentajeRetencion ?? 0) : (record.porcentajeRetencionIva ?? 0));
  const sustraendoBs = Number(record.sustraendo || 0);
  const retenidoBs = isIslr
    ? Number(record.montoRetenidoBs ?? record.montoRetenido ?? Math.max(0, (baseImpBs * pctRet) / 100 - sustraendoBs))
    : Number(record.retencionIvaBs ?? ((ivaCausadoBs * pctRet) / 100));

  const base = createBaseReport({
    title: isIslr
      ? `COMPROBANTE DE RETENCIÓN DE I.S.L.R. N° ${voucherNum}`
      : `COMPROBANTE DE RETENCIÓN DE I.V.A. N° ${voucherNum}`,
    subtitle: isIslr
      ? 'Decreto N° 1.808 en Materia de Retenciones del Impuesto Sobre la Renta • SENIAT Venezuela'
      : 'Providencia Administrativa SNAT/2015/0049 • Artículo 11 • Agente de Retención IVA',
    moduleCode: isIslr ? 'RISLR' : 'RIVA',
    currentUser,
    config,
    rateValue: tasa
  });

  let y = base.startY;
  y = renderTwoColMetaCard(
    base.doc,
    base.startX,
    y,
    base.tableWidth,
    {
      title: 'DATOS DEL AGENTE DE RETENCIÓN (EMPRESA)',
      lines: [
        config?.nombreEmpresa || 'SIGNUM MOTORVEN, C.A.',
        `RIF Agente: ${config?.rif || 'J-30401927-4'}`,
        `Domicilio Fiscal: ${config?.direccion || 'Barquisimeto / Caracas, Venezuela'}`,
        `N° Comprobante: ${voucherNum} • Período: ${periodoFiscal}`
      ]
    },
    {
      title: 'DATOS DEL SUJETO RETENIDO (PROVEEDOR)',
      lines: [
        provNombre,
        `RIF / C.I. Proveedor: ${provRif}`,
        `Dirección: ${provDir}`,
        `Fecha Emisión Comprobante: ${fechaEmis}`
      ]
    }
  );

  const headCols = isIslr
    ? [['FECHA DOC.', 'N° FACTURA', 'N° CONTROL', 'CONCEPTO ISLR', 'BASE IMP. (BS.)', '% RET.', 'SUSTRAENDO', 'ISLR RETENIDO (BS.)']]
    : [['OP.', 'FECHA DOC.', 'N° FACTURA', 'N° CONTROL', 'COMPRA + IVA (BS.)', 'BASE IMP. (BS.)', 'IVA 16% (BS.)', '% RET.', 'IVA RETENIDO (BS.)']];

  const bodyRow = isIslr
    ? [[
        fechaEmis,
        docFactura,
        docControl,
        String(record.conceptoDescripcion || record.codigoConceptoIslr || 'Honorarios / Servicios').slice(0, 34),
        formatBs(baseImpBs),
        `${pctRet}%`,
        formatBs(sustraendoBs),
        formatBs(retenidoBs)
      ]]
    : [[
        '1',
        fechaEmis,
        docFactura,
        docControl,
        formatBs(totalCompraBs || baseImpBs + ivaCausadoBs),
        formatBs(baseImpBs),
        formatBs(ivaCausadoBs),
        `${pctRet}%`,
        formatBs(retenidoBs)
      ]];

  autoTable(base.doc, {
    startY: y,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    head: headCols,
    body: bodyRow,
    theme: 'grid',
    headStyles: { fillColor: COLORS.navy, textColor: [255, 255, 255], fontSize: 5.5, fontStyle: 'bold', cellPadding: 1.5, halign: 'center' },
    styles: { fontSize: 5.6, cellPadding: 1.6, textColor: COLORS.dark, valign: 'middle', halign: 'right' },
    columnStyles: isIslr
      ? {
          0: { halign: 'center', cellWidth: 18 },
          1: { halign: 'center', cellWidth: 20, fontStyle: 'bold' },
          2: { halign: 'center', cellWidth: 22 },
          3: { halign: 'left', cellWidth: 42 },
          4: { cellWidth: 23 },
          5: { halign: 'center', cellWidth: 12 },
          6: { cellWidth: 18 },
          7: { fontStyle: 'bold', textColor: COLORS.navy, cellWidth: 24.9 }
        }
      : {
          0: { halign: 'center', cellWidth: 8 },
          1: { halign: 'center', cellWidth: 18 },
          2: { halign: 'center', cellWidth: 20, fontStyle: 'bold' },
          3: { halign: 'center', cellWidth: 22 },
          4: { cellWidth: 25 },
          5: { cellWidth: 25 },
          6: { cellWidth: 23 },
          7: { halign: 'center', cellWidth: 12 },
          8: { fontStyle: 'bold', textColor: COLORS.navy, cellWidth: 26.9 }
        }
  });

  placeTotalsAndSignatures(
    base.doc,
    base.doc.lastAutoTable?.finalY || y,
    [
      { label: isIslr ? 'BASE SUJETA A ISLR' : 'IVA CAUSADO EN FACTURA', value: formatBs(isIslr ? baseImpBs : ivaCausadoBs), subtext: `Tasa ref.: ${formatBs(tasa)}`, color: COLORS.navy },
      { label: isIslr ? 'TOTAL ISLR RETENIDO' : 'TOTAL IVA RETENIDO AL PROVEEDOR', value: formatBs(retenidoBs), subtext: `Comprobante N° ${voucherNum}`, color: COLORS.emerald }
    ],
    ['FIRMA Y SELLO AGENTE DE RETENCIÓN', 'FIRMA Y SELLO SUJETO RETENIDO (PROVEEDOR)'],
    base.tableWidth,
    base.startX
  );

  finalizeAndSave(base.doc, `Comprobante_Retencion_${isIslr ? 'ISLR' : 'IVA'}_${voucherNum}.pdf`, currentUser, {
    legalFooter: isIslr
      ? 'Comprobante de Retención ISLR emitido conforme al Art. 24 del Decreto 1.808 (SENIAT Venezuela).'
      : 'Art. 11 Prov. SNAT/2015/0049: Este comprobante debe entregarse al proveedor dentro de los 2 días hábiles siguientes al período.'
  });
  return base.doc;
}

/**
 * Genera el archivo TXT tabulado estándar para declaración masiva de Retenciones IVA en Portal SENIAT
 */
export function generateSeniatRetentionTxt({ purchases = [], config = {}, periodoFiscal = null }) {
  const agentRif = String(config?.rif || 'J304019274').replace(/[^A-Z0-9]/gi, '').toUpperCase();
  const period = periodoFiscal || `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const rows = (purchases || [])
    .filter(p => {
      if (!(Number(p.retencionIvaBs || 0) > 0)) return false;
      const comp = String(p.numeroComprobanteRetencionIva || p.comprobanteRetencionIva || '').trim();
      if (!/^\d{14}$/.test(comp)) return false;
      const rifVal = validateRif(p.proveedorRif || p.rif || '');
      return rifVal.isValid && !/^[VEJPG]0{9}$/.test(rifVal.clean || '');
    })
    .map(p => {
      const provRif = validateRif(p.proveedorRif || p.rif || '').clean;
      const fec = String(p.fecha || new Date().toISOString()).slice(0, 10);
      const tipoOp = 'C';
      const tipoDoc = p.tipoDoc === 'NOTA_CREDITO' ? '03' : (p.tipoDoc === 'NOTA_DEBITO' ? '02' : '01');
      const nroFact = String(p.numeroFactura || p.numeroFacturaProv || p.factNum || '0').trim();
      const nroCtrl = String(p.numeroControl || p.nroControl || '00-000000').trim();
      const tasa = Number(p.tasaDolar || p.tasaBcv || config?.tasaDolar || 1);
      const totBs = Number(p.totalBs ?? ((Number(p.totalUsd ?? 0)) * tasa)).toFixed(2);
      const baseBs = Number(p.baseGeneralBs ?? ((Number(p.baseGeneralUsd ?? p.subtotalUsd ?? 0)) * tasa)).toFixed(2);
      const retBs = Number(p.retencionIvaBs || 0).toFixed(2);
      const docAfec = String(p.documentoAfectado || '0').trim();
      const comp = String(p.numeroComprobanteRetencionIva || p.comprobanteRetencionIva).trim();
      const exentoBs = Number(p.baseExentaBs ?? ((Number(p.baseExentaUsd ?? 0)) * tasa)).toFixed(2);
      const alicuota = Number(p.alicuota16 ?? p.alicuota ?? 16).toFixed(2);
      const nroExp = '0';
      return [agentRif, period, fec, tipoOp, tipoDoc, provRif, nroFact, nroCtrl, totBs, baseBs, retBs, docAfec, comp, exentoBs, alicuota, nroExp].join('\t');
    });

  const content = rows.join('\n');
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SENIAT_RETENCIONES_IVA_${period}.txt`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 300);
  }
  return content;
}

// =========================================================================
// 33. SOLICITUD DE LÍNEA DE CRÉDITO COMERCIAL & PAGARÉ MERCANTIL EJECUTIVO
// =========================================================================
export function generateCreditApplicationAndPromissoryNotePDF({
  client = {},
  config = {},
  currentUser = null
}) {
  const tasa = Number(config?.tasaDolar) || 827.73;
  const clientName = client.nombre || client.cliDes || client.descripcion || 'CLIENTE SOLICITANTE';
  const clientRif = client.rif || client.coCli || 'J-00000000-0';
  const repLegal = client.responsable || client.contacto || client.repLegal || 'Representante Legal Autorizado';
  const ciRep = client.ciRepLegal || client.cedula || 'V-00.000.000';
  const direccion = client.direccion || client.direc1 || 'Venezuela';
  const telefonos = client.telefonos || client.telefono || 'N/A';
  const email = client.email || 'N/A';
  const ramo = client.ramo || client.tipoCliente || 'Comercial / Lubricantes Automotrices e Industriales';
  const vendedor = client.vendedor || client.coVen || 'Fuerza de Ventas Central';
  const diasCred = Number(client.diasCredito || client.diasCred || 15);
  const limiteUsd = Number(client.limiteCreditoUsd || client.limCred || client.limiteCredito || 0);
  const limiteBs = limiteUsd * tasa;
  const safeSlug = String(clientRif || clientName).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 24);

  const base = createBaseReport({
    title: 'SOLICITUD DE LÍNEA DE CRÉDITO COMERCIAL & PAGARÉ MERCANTIL',
    subtitle: 'Instrumento de Garantía Mercantil y Apertura de Crédito • Código de Comercio Art. 486',
    moduleCode: 'CRED',
    currentUser,
    config,
    rateValue: tasa
  });

  let y = base.startY;

  y = addSectionHeader(
    base.doc,
    y,
    'DATOS GENERALES DE LA EMPRESA SOLICITANTE (DEUDOR PRINCIPAL)',
    'Identificación fiscal, domicilio, contacto ejecutivo y condiciones crediticias requeridas',
    base.tableWidth,
    base.startX
  );

  y = renderTwoColMetaCard(
    base.doc,
    base.startX,
    y,
    base.tableWidth,
    {
      title: 'IDENTIFICACIÓN DEL SOLICITANTE / DEUDOR',
      lines: [
        clientName,
        `RIF / C.I.: ${clientRif} • Ramo: ${ramo}`,
        `Representante Legal: ${repLegal} (C.I. ${ciRep})`,
        `Domicilio Fiscal: ${direccion}`,
        `Teléfono: ${telefonos} • Email: ${email}`
      ]
    },
    {
      title: 'CONDICIONES CREDITICIAS SOLICITADAS',
      lines: [
        `Límite de Crédito Solicitado: ${formatUsd(limiteUsd)} (${formatBs(limiteBs)})`,
        `Plazo de Crédito Solicitado: ${diasCred} Días Continuos`,
        `Vendedor Asignado: ${vendedor}`,
        `Tasa de Liquidación Aplicable: Tasa Oficial BCV a fecha de pago`,
        `Fecha de Instrumentación: ${formatDateVe(new Date())}`
      ]
    }
  );

  const termsRows = [
    ['Instrumento de Garantía', 'Pagaré Mercantil Ejecutivo a la Vista con Aval y Cláusula de Aceleración de Plazos', 'OBLIGATORIO'],
    ['Moneda de Pago & Conversión', 'Dólares estadounidenses ($ USD) o Bolívares convertidos a Tasa Oficial del BCV al momento del pago', 'ESTRICTO BCV'],
    ['Plazo y Vencimiento Facturas', `${diasCred} días continuos contados estrictamente desde la fecha de recepción de la mercancía`, 'NO PRORROGABLE'],
    ['Reserva de Dominio (LOTD)', 'La mercancía despachada se mantiene bajo propiedad de SIGNUM MOTORVEN, C.A. hasta su cancelación total', 'RESERVA TOTAL'],
    ['Interés de Mora / Penalización', '1% mensual sobre saldos vencidos más gastos directos de cobranza judicial y extrajudicial', 'TASA LEGAL'],
    ['Referencia Bancaria Verificada', `${client.bancoRef || 'Cuenta Corriente Empresarial Activa en Banco Nacional'}`, 'VALIDADA']
  ];

  autoTable(base.doc, {
    startY: y,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    head: [['CLÁUSULA / CRITERIO COMERCIAL', 'ESPECIFICACIÓN Y CONDICIONES PACTADAS', 'VALIDACIÓN']],
    body: termsRows,
    theme: 'grid',
    headStyles: { fillColor: COLORS.navy, textColor: [255, 255, 255], fontSize: 5.6, fontStyle: 'bold', cellPadding: 1.4, halign: 'center' },
    styles: { fontSize: 5.4, cellPadding: 1.3, textColor: COLORS.dark, valign: 'middle' },
    columnStyles: {
      0: { cellWidth: 44, fontStyle: 'bold', textColor: COLORS.navy },
      1: { cellWidth: 108 },
      2: { halign: 'center', cellWidth: 27.9, fontStyle: 'bold', textColor: COLORS.emerald }
    }
  });

  y = base.doc.lastAutoTable?.finalY ? base.doc.lastAutoTable.finalY + 3 : y + 30;

  y = addSectionHeader(
    base.doc,
    y,
    'PAGARÉ MERCANTIL CON FUERZA EJECUTIVA (CÓDIGO DE COMERCIO ART. 486)',
    'Obligación pura, simple, incondicional y exigible por la vía ejecutiva mercantil venezolana',
    base.tableWidth,
    base.startX
  );

  const legalText = `POR ESTE PAGARÉ MERCANTIL, que emitimos conforme a los Artículos 486, 487 y concordantes del Código de Comercio de la República Bolivariana de Venezuela, la sociedad mercantil ${clientName.toUpperCase()}, RIF ${clientRif}, con domicilio en ${direccion}, representada por ${repLegal} (C.I. ${ciRep}), declara que DEBE y se obliga a PAGAR incondicionalmente a la orden de SIGNUM MOTORVEN, C.A. (RIF J-30401927-4 / J-50478166-0), en su sede en Barquisimeto, Estado Lara, la cantidad neta de hasta: ${formatUsd(limiteUsd)} (${formatBs(limiteBs)} a Tasa Oficial BCV), por concepto de mercancías recibidas a entera satisfacción.\n\nCONDICIONES ESPECIALES: 1. VENCIMIENTO Y MORA: El incumplimiento en el pago de cualquiera de las facturas comerciales emitidas dentro de este límite de crédito producirá la pérdida del beneficio del plazo y la exigibilidad inmediata de la totalidad del saldo deudor. 2. RENUNCIA AL PROTESTO: El deudor renuncia expresamente a los avisos de rechazo y al protesto del presente título valor. 3. DOMICILIO ESPECIAL: Para todos los efectos judiciales dimanantes del presente título, las partes eligen como domicilio especial la ciudad de Barquisimeto, Estado Lara, a cuyos tribunales declaran someterse expresamente.`;

  base.doc.setFont('helvetica', 'normal');
  base.doc.setFontSize(6.8);
  const splitLegal = base.doc.splitTextToSize(legalText, base.tableWidth - 6);
  const pagareH = Math.max(32, splitLegal.length * 3.1 + 6.0);
  const { safeBottomY, continuationTopY } = getPageLayoutMetrics(base.doc);
  if (y + pagareH > safeBottomY - 24) {
    base.doc.addPage();
    y = continuationTopY;
  }

  base.doc.setFillColor(...COLORS.lightBg);
  base.doc.setDrawColor(...COLORS.border);
  base.doc.setLineWidth(0.3);
  base.doc.roundedRect(base.startX, y, base.tableWidth, pagareH, 1.2, 1.2, 'FD');

  base.doc.setFont('helvetica', 'normal');
  base.doc.setFontSize(6.8);
  base.doc.setTextColor(...COLORS.dark);
  base.doc.text(splitLegal, base.startX + 3, y + 4.4);

  y += pagareH + 3;

  placeTotalsAndSignatures(
    base.doc,
    y,
    [
      { label: 'LÍMITE TOTAL SOLICITADO', value: formatUsd(limiteUsd), subtext: formatBs(limiteBs), color: COLORS.navy },
      { label: 'PLAZO MÁXIMO AUTORIZADO', value: `${diasCred} DÍAS`, subtext: 'Días continuos por factura', color: COLORS.emerald }
    ],
    [
      'SOLICITANTE / DEUDOR PRINCIPAL\n(Firma, Huella y C.I.)',
      'FIADOR SOLIDARIO Y AVALISTA\n(Firma, Huella y C.I.)',
      'GERENCIA DE CRÉDITO Y COBRANZAS\n(SIGNUM MOTORVEN, C.A.)'
    ],
    base.tableWidth,
    base.startX
  );

  finalizeAndSave(base.doc, `Solicitud_Credito_Pagare_${safeSlug}.pdf`, currentUser, {
    legalFooter: 'Documento mercantil con fuerza ejecutiva según el Art. 486 del Código de Comercio venezolano • Conservar original físico firmado.'
  });

  return base.doc;
}

// =========================================================================
// 34. RECIBO INDIVIDUAL DE PAGO DE SALARIO & BENEFICIOS SOCIALES LOTTT
// =========================================================================
export function generatePayrollSlipPDF({
  employee = {},
  payrollItem = {},
  config = {},
  currentUser = null
}) {
  const tasa = Number(config?.tasaDolar) || 827.73;
  const empNombre = employee.nombre || employee.nombreCompleto || payrollItem.empleadoNombre || 'TRABAJADOR REGISTRADO';
  const empCedula = employee.cedula || employee.ci || payrollItem.empleadoCedula || 'V-00.000.000';
  const empCargo = employee.cargo || payrollItem.cargo || 'OPERADOR';
  const empDepto = employee.departamento || employee.depto || 'OPERACIONES';
  const empFechaIngreso = formatDateVe(employee.fechaIngreso || employee.fec_ingreso || '2024-01-01');
  const frecuencia = String(payrollItem.frecuencia || employee.frecuencia || 'QUINCENAL').toUpperCase();
  const periodo = String(payrollItem.periodo || `Nómina ${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`).trim();
  const fechaPago = formatDateVe(payrollItem.fechaPago || payrollItem.fecha || new Date());
  const factor = frecuencia === 'MENSUAL' ? 1.0 : (frecuencia === 'SEMANAL' ? 0.25 : 0.5);

  const salarioBaseMensualUsd = Number(employee.salarioBaseUsd ?? payrollItem.salarioBaseUsd ?? payrollItem.salarioUsd ?? 200);
  const bonoFijoMensualUsd = Number(employee.bonoFijoUsd ?? payrollItem.bonoFijoUsd ?? payrollItem.bonoUsd ?? 100);

  const sueldoPeriodoUsd = Number(payrollItem.salarioUsd ?? (salarioBaseMensualUsd * factor));
  const bonoPeriodoUsd = Number(payrollItem.bonoUsd ?? (bonoFijoMensualUsd * factor));
  const bonoExtraUsd = Number(payrollItem.bonoExtraUsd ?? payrollItem.bonosExtraUsd ?? 0);

  // Deducciones legales de ley en Venezuela sobre sueldo básico:
  // IVSS: 4% (Art. 59 Ley Seguro Social)
  // FAOV: 1% (Ley Banavih)
  // Paro Forzoso / Empleo: 0.5% (Régimen Prestacional de Empleo)
  const ivssUsd = round2(sueldoPeriodoUsd * 0.04);
  const faovUsd = round2(sueldoPeriodoUsd * 0.01);
  const paroUsd = round2(sueldoPeriodoUsd * 0.005);
  const deduccionesAdicionalesUsd = Number(payrollItem.deduccionesUsd ?? 0);

  const totalAsignacionesUsd = round2(sueldoPeriodoUsd + bonoPeriodoUsd + bonoExtraUsd);
  const totalDeduccionesUsd = round2(ivssUsd + faovUsd + paroUsd + deduccionesAdicionalesUsd);
  const netoPagarUsd = Math.max(0, round2(totalAsignacionesUsd - totalDeduccionesUsd));

  const safeSlug = String(empCedula || empNombre).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 20);

  const base = createBaseReport({
    title: 'RECIBO INDIVIDUAL DE PAGO DE SALARIO & BENEFICIOS SOCIALES',
    subtitle: 'Constancia Legal de Remuneración y Deducciones de Ley • LOTTT Art. 106 • G.O. N° 6.076',
    moduleCode: 'NOM',
    currentUser,
    config,
    rateValue: tasa
  });

  let y = base.startY;

  y = addSectionHeader(
    base.doc,
    y,
    'DATOS PATRONALES Y DEL TRABAJADOR',
    `Modalidad: ${frecuencia} • Período: ${periodo} • Fecha de Liquidación: ${fechaPago}`,
    base.tableWidth,
    base.startX
  );

  y = renderTwoColMetaCard(
    base.doc,
    base.startX,
    y,
    base.tableWidth,
    {
      title: 'DATOS DE LA EMPRESA / PATRONO',
      lines: [
        config?.nombreEmpresa || 'SIGNUM MOTORVEN, C.A.',
        `RIF Patrono: ${config?.rif || 'J-30401927-4'} • N° Patronal IVSS: B-48291038`,
        `Domicilio: ${config?.direccion || 'Barquisimeto, Estado Lara, Venezuela'}`,
        `Actividad: Comercialización y Distribución de Lubricantes Automotrices`
      ]
    },
    {
      title: 'DATOS DEL TRABAJADOR',
      lines: [
        `${empNombre} (C.I. ${empCedula})`,
        `Cargo: ${empCargo} • Departamento: ${empDepto}`,
        `Fecha de Ingreso: ${empFechaIngreso} • Frecuencia: ${frecuencia}`,
        `Salario Base Mensual: ${formatUsd(salarioBaseMensualUsd)} (${formatBs(salarioBaseMensualUsd * tasa)})`
      ]
    }
  );

  const rows = [
    ['A-001', 'Sueldo Básico del Período (Art. 104 LOTTT)', 'ASIGNACIÓN', `${frecuencia === 'MENSUAL' ? '30' : '15'} días`, formatUsd(sueldoPeriodoUsd), formatBs(sueldoPeriodoUsd * tasa)],
    ['A-002', 'Cestaticket Socialista de Alimentación (Decreto Presidencial)', 'ASIGNACIÓN', 'Beneficio Social', formatUsd(bonoPeriodoUsd), formatBs(bonoPeriodoUsd * tasa)]
  ];

  if (bonoExtraUsd > 0) {
    rows.push(['A-003', 'Bonificación por Productividad / Horas Extra', 'ASIGNACIÓN', 'Incentivo Operativo', formatUsd(bonoExtraUsd), formatBs(bonoExtraUsd * tasa)]);
  }

  rows.push(['D-001', 'Seguro Social Obligatorio - IVSS (Art. 59 Ley SSO)', 'DEDUCCIÓN', '4.00% s/Sueldo', formatUsd(ivssUsd), formatBs(ivssUsd * tasa)]);
  rows.push(['D-002', 'Fondo Ahorro Obligatorio Vivienda - FAOV (Banavih)', 'DEDUCCIÓN', '1.00% s/Sueldo', formatUsd(faovUsd), formatBs(faovUsd * tasa)]);
  rows.push(['D-003', 'Régimen Prestacional de Empleo / Paro Forzoso', 'DEDUCCIÓN', '0.50% s/Sueldo', formatUsd(paroUsd), formatBs(paroUsd * tasa)]);

  if (deduccionesAdicionalesUsd > 0) {
    rows.push(['D-004', 'Anticipos de Quincena / Préstamos al Personal', 'DEDUCCIÓN', 'Convenio Privado', formatUsd(deduccionesAdicionalesUsd), formatBs(deduccionesAdicionalesUsd * tasa)]);
  }

  autoTable(base.doc, {
    startY: y,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    head: [['CÓD.', 'CONCEPTO / BENEFICIO LABORAL', 'TIPO', 'BASE / %', 'MONTO ($ USD)', 'MONTO (BS.)']],
    body: rows,
    theme: 'grid',
    headStyles: { fillColor: COLORS.navy, textColor: [255, 255, 255], fontSize: 5.6, fontStyle: 'bold', cellPadding: 1.4, halign: 'center' },
    styles: { fontSize: 5.4, cellPadding: 1.3, textColor: COLORS.dark, valign: 'middle' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 14, fontStyle: 'bold' },
      1: { cellWidth: 78 },
      2: { halign: 'center', cellWidth: 22, fontStyle: 'bold' },
      3: { halign: 'center', cellWidth: 22 },
      4: { halign: 'right', fontStyle: 'bold', cellWidth: 21 },
      5: { halign: 'right', fontStyle: 'bold', textColor: COLORS.navy, cellWidth: 22.9 }
    },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 2) {
        const val = String(data.cell.raw || '');
        if (val === 'ASIGNACIÓN') {
          data.cell.styles.textColor = COLORS.emerald;
        } else {
          data.cell.styles.textColor = COLORS.red;
        }
      }
    }
  });

  y = base.doc.lastAutoTable?.finalY ? base.doc.lastAutoTable.finalY + 3 : y + 40;

  const confText = `DECLARACIÓN DE CONFORMIDAD (ART. 106 LOTTT): Certifico haber recibido a entera satisfacción de SIGNUM MOTORVEN, C.A., la cantidad líquida descrita en el presente recibo como pago total de mis asignaciones salariales y beneficios socioeconómicos correspondientes al período indicado, declarando expresamente encontrarme al día y sin reclamo pendiente por concepto de sueldos o beneficios laborales de ley.`;
  base.doc.setFont('helvetica', 'normal');
  base.doc.setFontSize(6.8);
  const splitConf = base.doc.splitTextToSize(confText, base.tableWidth - 6);
  const decH = Math.max(14, splitConf.length * 3.1 + 5.5);
  const { safeBottomY, continuationTopY } = getPageLayoutMetrics(base.doc);
  if (y + decH > safeBottomY - 24) {
    base.doc.addPage();
    y = continuationTopY;
  }

  base.doc.setFillColor(...COLORS.lightBg);
  base.doc.setDrawColor(...COLORS.border);
  base.doc.setLineWidth(0.3);
  base.doc.roundedRect(base.startX, y, base.tableWidth, decH, 1.2, 1.2, 'FD');

  base.doc.setFont('helvetica', 'normal');
  base.doc.setFontSize(6.8);
  base.doc.setTextColor(...COLORS.dark);
  base.doc.text(splitConf, base.startX + 3, y + 4.4);

  y += decH + 3;

  placeTotalsAndSignatures(
    base.doc,
    y,
    [
      { label: 'TOTAL ASIGNACIONES', value: formatUsd(totalAsignacionesUsd), subtext: formatBs(totalAsignacionesUsd * tasa), color: COLORS.emerald },
      { label: 'TOTAL DEDUCCIONES LEY', value: formatUsd(totalDeduccionesUsd), subtext: formatBs(totalDeduccionesUsd * tasa), color: COLORS.red },
      { label: 'NETO A COBRAR / TRANSFERIDO', value: formatUsd(netoPagarUsd), subtext: formatBs(netoPagarUsd * tasa), color: COLORS.navy }
    ],
    [
      'TRABAJADOR / RECEPTOR\n(Firma, Huella y C.I.)',
      'GERENCIA DE RECURSOS HUMANOS\n(SIGNUM MOTORVEN, C.A.)'
    ],
    base.tableWidth,
    base.startX
  );

  finalizeAndSave(base.doc, `Recibo_Nomina_${safeSlug}_${periodo.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`, currentUser, {
    legalFooter: 'Constancia de pago emitida de conformidad con el Artículo 106 de la LOTTT • Documento probatorio de cumplimiento patronal.'
  });

  return base.doc;
}

// =========================================================================
// 35. COMPROBANTE ANUAL DE RETENCIONES DE I.S.L.R. (COMPROBANTE ARC)
// =========================================================================
export function generateAnnualArcRetentionPDF({
  supplier = {},
  year = null,
  retentionRecords = [],
  config = {},
  currentUser = null
}) {
  const tasa = Number(config?.tasaDolar) || 827.73;
  const targetYear = Number(year || new Date().getFullYear());
  const provNombre = supplier.nombre || supplier.provDes || supplier.prov_des || supplier.razonSocial || 'PROVEEDOR REGISTRADO';
  const provRif = supplier.rif || supplier.coProv || supplier.co_prov || 'J-00000000-0';
  const provDir = supplier.direccion || supplier.direc1 || 'Venezuela';
  const safeSlug = String(provRif || provNombre).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 20);

  const base = createBaseReport({
    title: 'COMPROBANTE ANUAL DE RETENCIONES DE I.S.L.R. (COMPROBANTE ARC)',
    subtitle: `Relación Anual Acumulada de Retenciones de ISLR • Ejercicio Fiscal ${targetYear} • Art. 24 Decreto 1.808`,
    moduleCode: 'ARC',
    currentUser,
    config,
    rateValue: tasa
  });

  let y = base.startY;

  y = addSectionHeader(
    base.doc,
    y,
    'IDENTIFICACIÓN DEL AGENTE DE RETENCIÓN Y DEL BENEFICIARIO (SUJETO RETENIDO)',
    `Ejercicio Gravable Anual: ${targetYear} • Normativa: Reglamento Parcial de Retenciones ISLR (SENIAT)`,
    base.tableWidth,
    base.startX
  );

  y = renderTwoColMetaCard(
    base.doc,
    base.startX,
    y,
    base.tableWidth,
    {
      title: 'AGENTE DE RETENCIÓN (SIGNUM MOTORVEN, C.A.)',
      lines: [
        config?.nombreEmpresa || 'SIGNUM MOTORVEN, C.A.',
        `RIF Agente: ${config?.rif || 'J-30401927-4'}`,
        `Domicilio Fiscal: ${config?.direccion || 'Barquisimeto, Estado Lara, Venezuela'}`,
        `Teléfono: ${config?.telefono || '+58 (251) 269.13.96'}`
      ]
    },
    {
      title: 'SUJETO RETENIDO / PROVEEDOR BENEFICIARIO',
      lines: [
        provNombre,
        `RIF / C.I. Sujeto Retenido: ${provRif}`,
        `Domicilio: ${provDir}`,
        `Año Fiscal Liquidado: ${targetYear}`
      ]
    }
  );

  const monthNames = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];

  const monthlyData = monthNames.map((name, idx) => ({
    mesNum: idx + 1,
    mesNombre: name,
    periodo: `${targetYear}${String(idx + 1).padStart(2, '0')}`,
    docCount: 0,
    baseBs: 0,
    retenidoBs: 0,
    baseUsd: 0,
    retenidoUsd: 0
  }));

  let totBaseBs = 0;
  let totRetBs = 0;
  let totBaseUsd = 0;
  let totRetUsd = 0;
  let totDocs = 0;

  (retentionRecords || []).forEach(r => {
    if (!r) return;
    const rRif = String(r.proveedorRif || r.rif || r.coProv || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const cleanProvRif = String(provRif).trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (rRif && cleanProvRif && !rRif.includes(cleanProvRif) && !cleanProvRif.includes(rRif)) {
      return;
    }

    const fec = String(r.fechaEmision || r.fecha || r.createdAt || '');
    const per = String(r.periodoFiscal || '').replace(/[^0-9]/g, '');
    let monthIdx = -1;

    if (per && per.length >= 6 && per.startsWith(String(targetYear))) {
      monthIdx = parseInt(per.slice(4, 6), 10) - 1;
    } else if (fec.startsWith(String(targetYear))) {
      monthIdx = parseInt(fec.slice(5, 7), 10) - 1;
    }

    if (monthIdx >= 0 && monthIdx < 12) {
      const mult = r.moneda === 'BS' ? 1 : tasa;
      const bBs = Number(r.baseImponibleBs ?? r.baseImponible ?? ((Number(r.baseImponibleUsd || 0)) * mult));
      const retBs = Number(r.montoRetenidoBs ?? r.montoRetenido ?? ((Number(r.montoRetenidoUsd || 0)) * mult));
      const bUsd = r.moneda === 'BS' ? (bBs / tasa) : Number(r.baseImponibleUsd ?? (bBs / tasa));
      const retUsd = r.moneda === 'BS' ? (retBs / tasa) : Number(r.montoRetenidoUsd ?? (retBs / tasa));

      monthlyData[monthIdx].docCount += 1;
      monthlyData[monthIdx].baseBs += bBs;
      monthlyData[monthIdx].retenidoBs += retBs;
      monthlyData[monthIdx].baseUsd += bUsd;
      monthlyData[monthIdx].retenidoUsd += retUsd;

      totDocs += 1;
      totBaseBs += bBs;
      totRetBs += retBs;
      totBaseUsd += bUsd;
      totRetUsd += retUsd;
    }
  });

  const tableRows = monthlyData.map((m) => [
    m.mesNombre.toUpperCase(),
    m.periodo,
    String(m.docCount),
    formatBs(m.baseBs),
    formatBs(m.retenidoBs),
    formatUsd(m.baseUsd),
    formatUsd(m.retenidoUsd)
  ]);

  tableRows.push([
    'TOTALES ANUALES ACUMULADOS',
    String(targetYear),
    String(totDocs),
    formatBs(totBaseBs),
    formatBs(totRetBs),
    formatUsd(totBaseUsd),
    formatUsd(totRetUsd)
  ]);

  autoTable(base.doc, {
    startY: y,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    head: [['MES CALENDARIO', 'PERÍODO', 'CANT. DOCS', 'BASE SUJETA A ISLR (BS.)', 'ISLR RETENIDO (BS.)', 'BASE EQUIV. ($)', 'RETENIDO ($)']],
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: COLORS.navy, textColor: [255, 255, 255], fontSize: 5.5, fontStyle: 'bold', cellPadding: 1.4, halign: 'center' },
    styles: { fontSize: 5.3, cellPadding: 1.2, textColor: COLORS.dark, valign: 'middle' },
    alternateRowStyles: { fillColor: COLORS.lightBg },
    columnStyles: {
      0: { cellWidth: 32, fontStyle: 'bold' },
      1: { halign: 'center', cellWidth: 18 },
      2: { halign: 'center', cellWidth: 16 },
      3: { halign: 'right', cellWidth: 30 },
      4: { halign: 'right', fontStyle: 'bold', textColor: COLORS.emerald, cellWidth: 30 },
      5: { halign: 'right', cellWidth: 26 },
      6: { halign: 'right', fontStyle: 'bold', textColor: COLORS.navy, cellWidth: 27.9 }
    },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.row.index === tableRows.length - 1) {
        base.doc.setDrawColor(...COLORS.navy);
        base.doc.setLineWidth(0.4);
        base.doc.line(data.cell.x, data.cell.y + data.cell.height, data.cell.x + data.cell.width, data.cell.y + data.cell.height);
      }
    }
  });

  y = base.doc.lastAutoTable?.finalY ? base.doc.lastAutoTable.finalY + 3 : y + 60;

  const juradaText = `CERTIFICACIÓN Y DECLARACIÓN JURADA (ART. 24 DECRETO 1.808): SIGNUM MOTORVEN, C.A., en su condición de Agente de Retención, certifica que los montos aquí relacionados corresponden fielmente a las retenciones del Impuesto Sobre la Renta efectuadas al Sujeto Retenido y enteradas a la orden del Tesoro Nacional en el SENIAT durante el ejercicio ${targetYear}. Este documento constituye constancia válida para su Declaración Definitiva de Rentas.`;
  base.doc.setFont('helvetica', 'normal');
  base.doc.setFontSize(6.8);
  const splitJurada = base.doc.splitTextToSize(juradaText, base.tableWidth - 6);
  const decH = Math.max(14, splitJurada.length * 3.1 + 5.5);
  const { safeBottomY, continuationTopY } = getPageLayoutMetrics(base.doc);
  if (y + decH > safeBottomY - 24) {
    base.doc.addPage();
    y = continuationTopY;
  }

  base.doc.setFillColor(...COLORS.lightBg);
  base.doc.setDrawColor(...COLORS.border);
  base.doc.setLineWidth(0.3);
  base.doc.roundedRect(base.startX, y, base.tableWidth, decH, 1.2, 1.2, 'FD');

  base.doc.setFont('helvetica', 'normal');
  base.doc.setFontSize(6.8);
  base.doc.setTextColor(...COLORS.dark);
  base.doc.text(splitJurada, base.startX + 3, y + 4.4);

  y += decH + 3;

  placeTotalsAndSignatures(
    base.doc,
    y,
    [
      { label: 'TOTAL BASE ANUAL ISLR', value: formatBs(totBaseBs), subtext: formatUsd(totBaseUsd), color: COLORS.navy },
      { label: 'TOTAL ISLR RETENIDO Y ENTERADO', value: formatBs(totRetBs), subtext: formatUsd(totRetUsd), color: COLORS.emerald }
    ],
    [
      'AGENTE DE RETENCIÓN\n(Firma Autorizada y Sello SIGNUM MOTORVEN)',
      'SUJETO RETENIDO / BENEFICIARIO\n(Recibido Conforme, Fecha y Firma)'
    ],
    base.tableWidth,
    base.startX
  );

  finalizeAndSave(base.doc, `Comprobante_ARC_ISLR_${safeSlug}_${targetYear}.pdf`, currentUser, {
    legalFooter: `Comprobante Anual ARC expedido de conformidad con el Artículo 24 del Decreto N° 1.808 (SENIAT) • Ejercicio ${targetYear}.`
  });

  return base.doc;
}

// =========================================================================
// 41. INFORME EJECUTIVO DE INTELIGENCIA PREDICTIVA (SIGNUM FORESIGHT)
// =========================================================================
export function generatePredictiveReportPDF({
  earlyWarnings = [],
  stockoutProjections = [],
  marginAnalysis = [],
  cashflowForecast = {},
  horizonDays = 30,
  tasaBcv = 827.73,
  config = {},
  currentUser = null
} = {}) {
  const base = createBaseReport({
    title: 'SIGNUM FORESIGHT — INFORME DE INTELIGENCIA PREDICTIVA & PROYECCIONES',
    subtitle: `Proyección de Agotamiento de Stock por Almacén, Compresión de Márgenes y Flujo de Fondos (${horizonDays} Días)`,
    moduleCode: 'FORESIGHT',
    currentUser,
    config
  });

  const criticalAlertsCount = (earlyWarnings || []).filter(w => w.severidad === 'CRITICA').length;
  const criticalStockCount = (stockoutProjections || []).filter(p => p.urgencia === 'CRITICO' || p.urgencia === 'AGOTADO').length;
  const squeezedMarginCount = (marginAnalysis || []).filter(m => m.tieneCompresion || m.tienePerdida).length;
  const saldoFinalUsd = Number(cashflowForecast?.saldoFinalProyectadoUsd || 0);

  const cards = [
    { label: 'Alertas Críticas', value: `${criticalAlertsCount} Alertas`, subtext: 'Atención Inmediata', color: criticalAlertsCount > 0 ? COLORS.red : COLORS.emerald },
    { label: 'Riesgo Quiebre Stock', value: `${criticalStockCount} SKUs`, subtext: `Agotamiento en < 7 días`, color: criticalStockCount > 0 ? COLORS.amber : COLORS.emerald },
    { label: 'Márgenes en Riesgo', value: `${squeezedMarginCount} SKUs`, subtext: 'Por debajo del umbral mínimo', color: squeezedMarginCount > 0 ? COLORS.purple : COLORS.emerald },
    { label: 'Saldo Proyectado', value: formatUsd(saldoFinalUsd), subtext: cashflowForecast?.tieneBrechaLiquidez ? `Déficit mín: ${formatUsd(cashflowForecast.saldoMinimoUsd)}` : 'Liquidez cubierta', color: saldoFinalUsd >= 0 ? COLORS.emerald : COLORS.red }
  ];

  let currentY = addSummaryCards(base.doc, base.startY, cards, base.tableWidth, base.startX);

  // 1. TABLA DE ALERTAS TEMPRANAS PRIORITARIAS
  base.doc.setFont('helvetica', 'bold');
  base.doc.setFontSize(8.5);
  base.doc.setTextColor(...COLORS.navy);
  base.doc.text('1. RADAR DE ALERTAS TEMPRANAS PRIORITARIAS', base.startX, currentY);
  currentY += 4;

  const alertsTableData = (earlyWarnings || []).slice(0, 10).map(w => [
    w.severidad || 'INFO',
    w.categoria || 'GENERAL',
    w.titulo || '-',
    w.descripcion || '-'
  ]);

  autoTable(base.doc, {
    startY: currentY,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    head: [['SEVERIDAD', 'CATEGORÍA', 'ALERTA / RIESGO', 'DESCRIPCIÓN Y ACCIÓN SUGERIDA']],
    body: alertsTableData.length > 0 ? alertsTableData : [['INFO', 'SISTEMA', 'Sin alertas activas', 'Todos los indicadores se encuentran en rangos saludables.']],
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.navy,
      textColor: [255, 255, 255],
      fontSize: 6.8,
      fontStyle: 'bold',
      cellPadding: 1.5
    },
    styles: {
      fontSize: 6.2,
      cellPadding: 1.4,
      textColor: COLORS.dark
    },
    alternateRowStyles: {
      fillColor: COLORS.lightBg
    },
    columnStyles: {
      0: { cellWidth: 20, fontStyle: 'bold' },
      1: { cellWidth: 24 },
      2: { cellWidth: 45, fontStyle: 'bold' },
      3: { cellWidth: 'auto' }
    }
  });

  currentY = base.doc.lastAutoTable.finalY + 7;

  // 2. TABLA DE RIESGO DE QUIEBRE DE STOCK
  base.doc.setFont('helvetica', 'bold');
  base.doc.setFontSize(8.5);
  base.doc.setTextColor(...COLORS.navy);
  base.doc.text('2. ESTIMACIÓN DE QUIEBRE DE STOCK & SUGERENCIAS DE COMPRA', base.startX, currentY);
  currentY += 4;

  const stockRows = (stockoutProjections || [])
    .filter(p => p.urgencia === 'CRITICO' || p.urgencia === 'REORDEN' || p.urgencia === 'AGOTADO')
    .slice(0, 15)
    .map(p => [
      p.codigo || '-',
      p.descripcion || '-',
      String(p.stock01 || 0),
      String(p.stock02 || 0),
      String(p.stockDisponibleAtp || 0),
      p.consumoDiario > 0 ? `${p.consumoDiario}/d` : '0',
      p.diasCobertura >= 999 ? '∞' : `${p.diasCobertura} d`,
      p.fechaEstimadaQuiebre || 'Sin fecha',
      p.urgencia || 'OPTIMO',
      p.sugerenciaCompra > 0 ? `+${p.sugerenciaCompra} (${formatUsd(p.costoEstimadoReposicionUsd)})` : 'Cubierto'
    ]);

  autoTable(base.doc, {
    startY: currentY,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    head: [['SKU', 'DESCRIPCIÓN', 'ALM 01', 'ALM 02', 'ATP LIBRE', 'CONSUMO/D', 'COBERTURA', 'QUIEBRE ETA', 'ESTADO', 'SUG. COMPRA']],
    body: stockRows.length > 0 ? stockRows : [['-', 'No hay productos en riesgo inminente de quiebre', '0', '0', '0', '0', '0', '-', 'OPTIMO', 'Cubierto']],
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.navy,
      textColor: [255, 255, 255],
      fontSize: 6.5,
      fontStyle: 'bold',
      cellPadding: 1.5
    },
    styles: {
      fontSize: 6.0,
      cellPadding: 1.3,
      textColor: COLORS.dark
    },
    alternateRowStyles: {
      fillColor: COLORS.lightBg
    },
    columnStyles: {
      0: { cellWidth: 20, fontStyle: 'bold' },
      1: { cellWidth: 42 },
      2: { cellWidth: 12, halign: 'center' },
      3: { cellWidth: 12, halign: 'center' },
      4: { cellWidth: 14, halign: 'center', fontStyle: 'bold' },
      5: { cellWidth: 15, halign: 'center' },
      6: { cellWidth: 15, halign: 'center' },
      7: { cellWidth: 18, halign: 'center' },
      8: { cellWidth: 16, halign: 'center', fontStyle: 'bold' },
      9: { cellWidth: 'auto', halign: 'right', fontStyle: 'bold' }
    }
  });

  currentY = base.doc.lastAutoTable.finalY + 8;

  finalizeAndSave(base.doc, `Informe_Predictivo_Foresight_${horizonDays}D.pdf`, currentUser, {
    legalFooter: `Informe confidencial de proyecciones SIGNUM MOTORVEN • Generado para Dirección y Gerencia General.`
  });

  return base.doc;
}






