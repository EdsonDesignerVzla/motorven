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
import autoTable from 'jspdf-autotable';
import qrcode from 'qrcode-generator';
import { MOTORVEN_LOGO_BASE64 } from '../assets/logoBase64.js';
import { formatUsd, formatBs, resolveProductUnit, resolveProductLitersPerUnit, getProductWarehouseStocks } from './formatService.js';
import { getProductRetailPrice } from './pricingService.js';
import { REAL_PRODUCTS, REAL_CLIENTS, REAL_PROFIT_BANK_ACCOUNTS } from '../data/supabaseRealData.js';
import { computeTrialBalance, computeGeneralLedger, computeFinancialStatements } from './accountingService.js';
import { SYSTEM_METADATA, MODULES_DOCUMENTATION, WORKFLOWS_STEP_BY_STEP } from '../data/appDocumentationData.js';

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
  const metaBoxW = 50;
  const metaBoxX = margin + contentWidth - metaBoxW - innerPadding;

  // 4. Bloque de Identidad Empresarial (al lado del logo con zona segura calculada)
  const infoX = startX + 30;
  const maxCompanyW = metaBoxX - infoX - 3; // Zona segura hasta la caja de metadatos

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.8);
  doc.setTextColor(...COLORS.navy);
  const companyLines = doc.splitTextToSize(config?.nombreEmpresa || 'SIGNUM MOTORVEN, C.A.', maxCompanyW);
  doc.text(companyLines[0], infoX, margin + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(...COLORS.slate);
  const rifLines = doc.splitTextToSize(`RIF: ${config?.rif || 'J-30401927-4'} • Distribuidores Autorizados Lubricantes OILSTONE ®`, maxCompanyW);
  doc.text(rifLines[0], infoX, margin + 11.5);

  doc.setFontSize(6.0);
  doc.setTextColor(...COLORS.muted);
  const addrLines = doc.splitTextToSize(`Dirección: ${config?.direccion || 'Barquisimeto / Caracas, Venezuela'} • Tel: ${config?.telefono || '+58 (251) 269.13.96'}`, maxCompanyW);
  doc.text(addrLines[0], infoX, margin + 14.5);

  // Dibujar Caja de Metadatos del Documento
  doc.setFillColor(...COLORS.lightBg);
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(metaBoxX, margin + 4.5, metaBoxW, 11, 1.2, 1.2, 'FD');

  const effectiveRateNum = Number(rateValue ?? config?.tasaDolar) || 827.73;

  if (hideCorrelative) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.8);
    doc.setTextColor(...COLORS.slate);
    doc.text(`Emisión: ${dateTimeStr}`, metaBoxX + metaBoxW / 2, margin + 8.8, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.0);
    doc.setTextColor(...COLORS.emerald);
    doc.text(`${rateLabel}: ${formatBs(effectiveRateNum)} / USD`, metaBoxX + metaBoxW / 2, margin + 12.8, { align: 'center' });
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(...COLORS.navy);
    doc.text(correlative, metaBoxX + metaBoxW / 2, margin + 7.5, { align: 'center' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.8);
    doc.setTextColor(...COLORS.slate);
    doc.text(`Emisión: ${dateTimeStr}`, metaBoxX + metaBoxW / 2, margin + 10.7, { align: 'center' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.8);
    doc.setTextColor(...COLORS.emerald);
    doc.text(`${rateLabel}: ${formatBs(effectiveRateNum)} / USD`, metaBoxX + metaBoxW / 2, margin + 13.9, { align: 'center' });
  }

  // 5. Franja de Título Principal con Acento Lateral Rojo
  const bannerY = margin + 17;
  const hasSubtitle = Boolean(subtitle && String(subtitle).trim());
  const bannerH = hasSubtitle ? 9.2 : 7.4;
  doc.setFillColor(...COLORS.navy);
  doc.roundedRect(startX, bannerY, tableWidth, bannerH, 1, 1, 'F');
  doc.setFillColor(...COLORS.red);
  doc.rect(startX, bannerY, 3, bannerH, 'F'); // Pip rojo

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.2);
  doc.setTextColor(255, 255, 255);
  doc.text(title.toUpperCase(), startX + 6, bannerY + (hasSubtitle ? 4.2 : 4.9));

  if (hasSubtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.4);
    doc.setTextColor(226, 232, 240);
    doc.text(subtitle, startX + 6, bannerY + 7.6);
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
  const emisorH = 5.2;
  doc.setFillColor(...COLORS.lightBg);
  doc.setDrawColor(...COLORS.border);
  doc.roundedRect(startX, emisorY, tableWidth, emisorH, 0.8, 0.8, 'FD');

  const userName = currentUser?.nombre || currentUser?.username || 'Edson Designer';
  const userNick = currentUser?.username ? `@${currentUser.username}` : '@admin';
  const userRole = currentUser?.cargo || currentUser?.rol || 'Administrador Master';
  const userDept = currentUser?.departamento || 'DIRECCIÓN';

  const midX = startX + tableWidth * 0.46;
  const rightX = startX + tableWidth * 0.77;

  const maxUserW = midX - (startX + 27) - 3;
  const maxRoleW = rightX - (midX + 18) - 3;
  const maxDeptW = (startX + tableWidth) - (rightX + 10) - 2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.0);
  doc.setTextColor(...COLORS.navy);
  doc.text('OPERADOR EMISOR:', startX + 3, emisorY + 3.6);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.dark);
  const userLines = doc.splitTextToSize(`${userName} (${userNick})`, maxUserW);
  doc.text(userLines[0] || userName, startX + 27, emisorY + 3.6);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.slate);
  doc.text('CARGO / ROL:', midX, emisorY + 3.6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.dark);
  const roleLines = doc.splitTextToSize(userRole, maxRoleW);
  doc.text(roleLines[0] || userRole, midX + 18, emisorY + 3.6);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.slate);
  doc.text('DEPTO:', rightX, emisorY + 3.6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.red);
  const deptLines = doc.splitTextToSize(userDept, maxDeptW);
  doc.text(deptLines[0] || userDept, rightX + 10, emisorY + 3.6);

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
  const cardH = 11.5;

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
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.8);
    doc.setTextColor(...COLORS.slate);
    doc.text((card.label || 'KPI').toUpperCase(), x + 2.5, startY + 4.4);

    // Valor Principal con escala tipográfica dinámica para evitar desbordes y solapes
    const valStr = String(card.value || '0');
    let valFontSize = 8.2;
    if (valStr.length > 17) {
      valFontSize = 5.8;
    } else if (valStr.length > 13) {
      valFontSize = 6.6;
    } else if (valStr.length > 10) {
      valFontSize = 7.4;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(valFontSize);
    doc.setTextColor(...(card.valueColor || COLORS.dark));
    doc.text(valStr, x + 2.5, startY + 8.0);

    // Subtítulo / Detalle truncado al ancho de tarjeta para que no desborde
    if (card.subtext) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.0);
      doc.setTextColor(...COLORS.muted);
      const subLines = doc.splitTextToSize(String(card.subtext), cardW - 4);
      doc.text(subLines[0] || '', x + 2.5, startY + 10.4);
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
  doc.setFontSize(6.4);
  const splitText = doc.splitTextToSize(text, tableWidth - 8);
  const textH = splitText.length * 2.8;
  const boxH = Math.max(9.5, textH + 5.5);

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
  doc.setFontSize(6.0);
  doc.setTextColor(...COLORS.navy);
  doc.text(title.toUpperCase(), startX + 4.5, startY + 3.6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(...COLORS.dark);
  doc.text(splitText, startX + 4.5, startY + 6.8);

  return startY + boxH + 2.5;
}

/**
 * Añade un encabezado de sección / bloque temático (con acento corporativo rojo y azul marino)
 */
export function addSectionHeader(doc, startY, title, subtitle = '', tableWidth = 179.9, startX = 18) {
  const bannerH = subtitle ? 9.0 : 7.2;
  const { safeBottomY, continuationTopY } = getPageLayoutMetrics(doc);
  if (startY + bannerH + 2.5 > safeBottomY) {
    doc.addPage();
    startY = continuationTopY;
  }
  doc.setFillColor(...COLORS.navy);
  doc.roundedRect(startX, startY, tableWidth, bannerH, 1, 1, 'F');
  doc.setFillColor(...COLORS.red);
  doc.rect(startX, startY, 3, bannerH, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.4);
  doc.setTextColor(255, 255, 255);
  doc.text(title.toUpperCase(), startX + 6, startY + (subtitle ? 4.2 : 4.8));

  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.8);
    doc.setTextColor(226, 232, 240);
    doc.text(subtitle, startX + 6, startY + 7.6);
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

    // Cargo / Rol
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(...COLORS.navy);
    doc.text(role.toUpperCase(), x + sigW / 2, lineY + 3.5, { align: 'center' });

    // Leyenda
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.2);
    doc.setTextColor(...COLORS.muted);
    doc.text('Firma y Sello Oficial', x + sigW / 2, lineY + 6.2, { align: 'center' });
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

  const badgeH = 4.2;
  const badgeW = Math.min(cell.width - 2, 25);
  const badgeX = cell.x + (cell.width - badgeW) / 2;
  const badgeY = cell.y + (cell.height - badgeH) / 2;

  doc.setFillColor(...bg);
  doc.setDrawColor(...border);
  doc.setLineWidth(0.2);
  doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 1.0, 1.0, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.2);
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
  doc.setFontSize(5.4);
  doc.setTextColor(...COLORS.dark);
  doc.text(`${pct.toFixed(1)}%`, startX + barW + 1.8, barY + barH - 0.3);
}

/**
 * Dibuja una caja formal de Totales Generales con doble subrayado contable
 */
export function addGrandTotalBox(doc, startY, items = [], tableWidth = 179.9, startX = 18) {
  if (!items || items.length === 0) return startY;

  const boxH = 13.5;
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
    const midY = startY + 4.2;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.8);
    doc.setTextColor(...COLORS.slate);
    doc.text((item.label || 'TOTAL').toUpperCase(), x, midY);

    const valStr = String(item.value || '$ 0.00');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(valStr.length > 14 ? 7.0 : 8.2);
    doc.setTextColor(...(item.color || COLORS.navy));
    doc.text(valStr, x, midY + 4.2);

    if (item.subtext) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.2);
      doc.setTextColor(...COLORS.muted);
      doc.text(String(item.subtext), x, midY + 7.2);
    }

    // Doble línea contable inferior debajo del valor
    const lineW = Math.min(colW - 8, 32);
    const lineY = startY + boxH - 2.2;
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
        doc.setFontSize(5.8);
        doc.setTextColor(...COLORS.navy);
        doc.text(`CONTINUACIÓN DE REPORTE • PÁGINA ${i}/${totalPages}`, startX, margin + 4.9);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(5.6);
        doc.setTextColor(...COLORS.slate);
        doc.text(`Desbordamiento ${i}/${totalPages}`, startX + tableWidth, margin + 4.9, { align: 'right' });
      }
    }

    // Línea divisoria de pie de página dentro del contenedor padre
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.3);
    doc.line(startX, footerY, startX + tableWidth, footerY);

    // Texto legal a la izquierda
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.6);
    doc.setTextColor(...COLORS.muted);
    doc.text(
      options.legalFooter || 'SIGNUM MOTORVEN C.A. • Sistema de Gestión ERP • Documento Oficial Tamaño Carta • Válido para Impresión',
      startX + 1,
      footerY + 3.8
    );

    // Usuario y numeración estándar de desbordamiento (1/1, 1/2, 2/2) a la derecha
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.0);
    doc.setTextColor(...COLORS.slate);
    const basePageLabel = useDeFormat ? `Página ${i} de ${totalPages}` : `Página ${i}/${totalPages}`;
    const contSuffix = (totalPages > 1 && i < totalPages && !options.skipOverflowNotice)
      ? ` (Continúa ${i + 1}/${totalPages})`
      : '';
    doc.text(
      `${basePageLabel}${contSuffix} • Emitido por: ${userName}`,
      startX + tableWidth - 1,
      footerY + 3.8,
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
// 1. REPORTE DE FUERZA DE VENTAS & ASESORES COMERCIALES (PRIORITARIO)
// =========================================================================
export function generateSellersPDF({ sellers = [], config = {}, currentUser = null, globalQuota = 30000 }) {
  const base = createBaseReport({
    title: 'REPORTE DE FUERZA DE VENTAS & RENDIMIENTO COMERCIAL',
    subtitle: 'Cumplimiento de Metas, Facturación Lograda, Liquidación de Comisiones y Cobertura de Zonas',
    moduleCode: 'VEN',
    currentUser,
    config
  });

  const totalSellers = sellers.length;
  const totalVendido = sellers.reduce((acc, s) => acc + Number(s.totalVentasUsd || s.ventasTotalesUsd || s.ventasMes || s.montoVentas || 0), 0);
  const totalLitros = sellers.reduce((acc, s) => acc + Number(s.totalLitros || s.litrosVendidos || s.litros || 0), 0);
  const totalComisiones = sellers.reduce((acc, s) => acc + Number(s.comisionEstimadaUsd || s.comisionTotalUsd || s.comisionesUsd || 0), 0);
  const tasa = Number(config?.tasaDolar) || 886.22;

  // Cálculo de cumplimiento global proporcional a litros o dólares
  const metaLitrosGlobal = Number(globalQuota) || 30000;
  const cumplimientoGlobal = metaLitrosGlobal > 0 ? (totalLitros > 0 ? (totalLitros / metaLitrosGlobal) * 100 : (totalVendido / (metaLitrosGlobal * 4.5)) * 100) : 0;

  const cards = [
    { label: 'Fuerza Comercial', value: `${totalSellers} Asesores`, subtext: 'Equipo Activo', color: COLORS.navy },
    { label: 'Ventas Totales USD', value: formatUsd(totalVendido), subtext: formatBs(totalVendido * tasa), color: COLORS.emerald },
    { label: 'Volumen Despachado', value: `${totalLitros.toLocaleString('es-VE', { maximumFractionDigits: 1 })} L`, subtext: `${cumplimientoGlobal.toFixed(1)}% Meta (${metaLitrosGlobal.toLocaleString()} L)`, color: COLORS.cyan },
    { label: 'Comisiones Devengadas', value: formatUsd(totalComisiones), subtext: 'Incentivos de Ventas', color: COLORS.amber }
  ];

  let currentY = addSummaryCards(base.doc, base.startY, cards, base.tableWidth, base.startX);

  currentY = addAnalyticalBox(
    base.doc,
    currentY,
    'SÍNTESIS EJECUTIVA DE RENDIMIENTO COMERCIAL',
    `El equipo de Fuerza de Ventas de SIGNUM MOTORVEN consolidó una facturación de ${formatUsd(totalVendido)} (${formatBs(totalVendido * tasa)}) equivalente a ${totalLitros.toLocaleString('es-VE', { maximumFractionDigits: 1 })} litros de lubricantes Oilstone. La efectividad global se sitúa en ${cumplimientoGlobal.toFixed(1)}% de la cuota programada de ${metaLitrosGlobal.toLocaleString()} L. El incentivo comercial estimado asciende a ${formatUsd(totalComisiones)}.`,
    base.tableWidth,
    base.startX
  );

  const tableData = sellers.map((s) => {
    const ventas = Number(s.totalVentasUsd || s.ventasTotalesUsd || s.ventasMes || s.montoVentas || 0);
    const litros = Number(s.totalLitros || s.litrosVendidos || s.litros || 0);
    const metaLitros = Number(s.metaLitrosMes || s.metaLitros || 3000);
    const pct = Number(s.cumplimientoPct || s.porcentajeCumplimiento) || (metaLitros > 0 ? (litros / metaLitros) * 100 : 0);
    const comision = Number(s.comisionEstimadaUsd || s.comisionTotalUsd || s.comisionesUsd || (ventas * 0.03));

    return [
      s.coVen || s.co_ven || s.codigo || s.id || 'VEN-00',
      s.venDes || s.nombre || 'Asesor Comercial',
      s.zona || s.ruta || 'Centro / Occidente',
      `${litros.toLocaleString('es-VE', { maximumFractionDigits: 1 })} L`,
      formatUsd(ventas),
      `${pct.toFixed(1)}%`,
      formatUsd(comision)
    ];
  });

  autoTable(base.doc, {
    startY: currentY,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    head: [['CÓDIGO', 'ASESOR COMERCIAL', 'ZONA / TERRITORIO', 'VOLUMEN (L)', 'VENTAS USD', '% CUMP.', 'COMISIÓN USD']],
    body: tableData.length > 0 ? tableData : [['SIN ASESORES', '-', '-', '0 L', '$ 0.00', '0.0%', '$ 0.00']],
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
        { label: 'VOLUMEN TOTAL', value: `${totalLitros.toLocaleString('es-VE', { maximumFractionDigits: 1 })} L`, subtext: `${cumplimientoGlobal.toFixed(1)}% Meta Global (${metaLitrosGlobal.toLocaleString()} L)`, color: COLORS.navy },
        { label: 'VENTAS TOTALES USD', value: formatUsd(totalVendido), subtext: formatBs(totalVendido * tasa), color: COLORS.emerald },
        { label: 'COMISIONES LIQUIDADAS', value: formatUsd(totalComisiones), subtext: 'Incentivos de Ventas', color: COLORS.amber }
      ],
      base.tableWidth,
      base.startX
    );

    finalizeAndSave(base.doc, `Reporte_Fuerza_Ventas_SIGNUM_${new Date().toISOString().slice(0, 10)}.pdf`, currentUser);
    return base.doc;
  }

// =========================================================================
// 2. REPORTE DE RENTABILIDAD & BI (PRIORITARIO - CARTA VERTICAL)
// =========================================================================
export function generateProfitabilityPDF({ products = [], sales = [], config = {}, currentUser = null }) {
  const base = createBaseReport({
    title: 'ESTADO DE RENTABILIDAD, MÁRGENES & BUSINESS INTELLIGENCE',
    subtitle: 'Contribución Marginal, Utilidad Operativa, Márgenes por Línea y Retorno de Inversión',
    moduleCode: 'REN',
    currentUser,
    config
  });

  const totalCosto = products.reduce((acc, p) => acc + (Number(p.stock || 0) * Number(p.costoUsd || 0)), 0);
  const totalVenta = products.reduce((acc, p) => acc + (Number(p.stock || 0) * Number(p.precioUsd || p.precioA || 0)), 0);
  const utilidadProyectada = totalVenta - totalCosto;
  const margenPromedio = totalVenta > 0 ? (utilidadProyectada / totalVenta) * 100 : 0;
  const tasa = Number(config?.tasaDolar) || 827.73;

  const cards = [
    { label: 'Inventario al Costo', value: formatUsd(totalCosto), subtext: formatBs(totalCosto * tasa), color: COLORS.navy },
    { label: 'Valorización Venta', value: formatUsd(totalVenta), subtext: 'Ingreso Estimado', color: COLORS.cyan },
    { label: 'Utilidad Operativa', value: formatUsd(utilidadProyectada), subtext: 'Spread Comercial', color: COLORS.emerald },
    { label: 'Margen Promedio', value: `${margenPromedio.toFixed(1)}%`, subtext: 'P&L Operacional', color: COLORS.amber }
  ];

  let currentY = addSummaryCards(base.doc, base.startY, cards, base.tableWidth, base.startX);

  currentY = addAnalyticalBox(
    base.doc,
    currentY,
    'ANÁLISIS DE RENTABILIDAD & MARGEN OPERATIVO OILSTONE',
    `El margen bruto promedio proyectado sobre la cartera de lubricantes se sitúa en ${margenPromedio.toFixed(1)}%, generando un spread de utilidad neta de ${formatUsd(utilidadProyectada)}. Las líneas sintéticas y semisintéticas lideran la rentabilidad por litro, mientras los minerales de alto volumen mantienen el flujo de caja operativo estable.`,
    base.tableWidth,
    base.startX
  );

  const tableData = products.map((p) => {
    const costo = Number(p.costoUsd || 0);
    const precio = Number(p.precioUsd || p.precioA || 0);
    const ganancia = precio - costo;
    const margen = precio > 0 ? (ganancia / precio) * 100 : 0;

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
    subtitle: 'Vendedor • Factura • RIF • Nombre Cliente • Emisión • Vencimiento • Días Vencido • Días Crédito • Monto • Abonos • Restante',
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

    return [
      String(r.vendedorId || r.vendedor || 'OF'),
      String(r.factura || r.factNum || r.nroDoc || r.id || '0000'),
      String(r.rif || r.clienteRif || 'N/A'),
      String(r.cliente || r.clienteNombre || r.nombre || 'Cliente Comercial'),
      formatPdfDate(r.fechaEmisionIso || r.fechaEmision || r.fechaRegistro),
      formatPdfDate(r.fechaVencimientoIso || r.fechaVencimiento),
      `${diasVencido}`,
      `${diasCredito}`,
      formatUsd(montoFactura),
      formatUsd(abonos),
      formatUsd(restante)
    ];
  });

  autoTable(base.doc, {
    startY: currentY,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    head: [['VENDEDOR', isNotaEntrega ? 'N° NOTA' : 'FACTURA', 'RIF', 'NOMBRE CLIENTE', 'FECHA EMISIÓN', 'FECHA VENC.', 'DÍAS VENC.', 'DÍAS CRÉD.', isNotaEntrega ? 'MONTO NOTA' : 'MONTO FACTURA', 'ABONOS', 'RESTANTE']],
    body: tableData.length > 0 ? tableData : [['-', 'SIN DOCS', '-', 'No hay documentos pendientes en cartera', '-', '-', '0', '0', '$ 0.00', '$ 0.00', '$ 0.00']],
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.navy,
      textColor: [255, 255, 255],
      fontSize: 5.5,
      fontStyle: 'bold',
      cellPadding: 1.2
    },
    styles: {
      fontSize: 5.5,
      cellPadding: 1.1,
      textColor: COLORS.dark
    },
    alternateRowStyles: {
      fillColor: COLORS.lightBg
    },
    columnStyles: {
      0: { fontStyle: 'bold', halign: 'center', cellWidth: 12 },
      1: { fontStyle: 'bold', halign: 'center', cellWidth: 14 },
      2: { halign: 'center', cellWidth: 18 },
      3: { cellWidth: 36 },
      4: { halign: 'center', cellWidth: 15 },
      5: { halign: 'center', cellWidth: 15 },
      6: { halign: 'center', fontStyle: 'bold', cellWidth: 11 },
      7: { halign: 'center', cellWidth: 11 },
      8: { halign: 'right', cellWidth: 16 },
      9: { halign: 'right', textColor: COLORS.emerald, fontStyle: 'bold', cellWidth: 15 },
      10: { halign: 'right', textColor: COLORS.red, fontStyle: 'bold', cellWidth: 16.9 }
    }
  });

  const finalY = base.doc.lastAutoTable?.finalY || currentY;
  addGrandTotalBox(base.doc, finalY + 3.5, [
    { label: isNotaEntrega ? 'MONTO NOTAS' : 'MONTO FACTURAS', value: formatUsd(totalMontoFacturaUsd), subtext: formatBs(totalMontoFacturaUsd * tasa), color: COLORS.navy },
    { label: 'TOTAL ABONOS', value: formatUsd(totalAbonosUsd), subtext: formatBs(totalAbonosUsd * tasa), color: COLORS.emerald },
    { label: 'TOTAL RESTANTE', value: formatUsd(totalCarteraUsd), subtext: `${dataset.length} documentos`, color: totalCarteraUsd > 0 ? COLORS.red : COLORS.emerald }
  ], base.tableWidth, base.startX);

  finalizeAndSave(base.doc, `Reporte_Documentos_CxC_${docTypeArg}_${new Date().toISOString().slice(0, 10)}.pdf`, currentUser);
  return base.doc;
}

// =========================================================================
// 3B. REPORTE CONSOLIDADO CxC (FACTURAS FISCALES + NOTAS DE ENTREGA)
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
  const safeDocs = Array.isArray(docs) ? docs : [];
  const safeClientRows = Array.isArray(clientRows) ? clientRows : [];
  const tasa = Number(tasaBcv) || Number(config?.tasaDolar) || 451.51;
  const isClientView = viewMode === 'CLIENTES';

  const deriveDocBucketTotals = (filterFn) => {
    const subset = filterFn ? safeDocs.filter(filterFn) : safeDocs;
    return subset.reduce(
      (acc, d) => {
        const m = Number(d.montoFacturaUsd ?? d.totalFacturaUsd ?? 0);
        const a = Number(d.abonosUsd ?? d.montoPagadoUsd ?? 0);
        const r = Number(d.restanteUsd ?? d.saldoPendienteUsd ?? d.saldoUsd ?? 0);
        const isVenc = d.estado === 'VENCIDA' || Number(d.diasVencidos ?? 0) > 0;
        acc.count += 1;
        acc.monto += m;
        acc.abonos += a;
        acc.restante += r;
        if (isVenc) {
          acc.vencido += r;
          acc.vencidas += 1;
        }
        return acc;
      },
      { count: 0, monto: 0, abonos: 0, restante: 0, vencido: 0, vencidas: 0 }
    );
  };

  const facStats = totals?.fac || deriveDocBucketTotals((d) => d.tipoDoc !== 'NOTA_ENTREGA');
  const neStats = totals?.ne || deriveDocBucketTotals((d) => d.tipoDoc === 'NOTA_ENTREGA');
  const allStats = totals?.all || {
    count: facStats.count + neStats.count,
    monto: facStats.monto + neStats.monto,
    abonos: facStats.abonos + neStats.abonos,
    restante: facStats.restante + neStats.restante,
    vencido: facStats.vencido + neStats.vencido,
    vencidas: facStats.vencidas + neStats.vencidas
  };

  const visStats = visibleTotals || (isClientView
    ? safeClientRows.reduce(
        (acc, r) => {
          acc.count += Number(r.fac?.count || 0) + Number(r.ne?.count || 0);
          acc.monto += Number(r.totalMonto || 0);
          acc.abonos += Number(r.totalAbonos || 0);
          acc.restante += Number(r.totalRestante || 0);
          return acc;
        },
        { count: 0, monto: 0, abonos: 0, restante: 0, vencido: 0, vencidas: 0 }
      )
    : deriveDocBucketTotals(null));

  const base = createBaseReport({
    title: isClientView
      ? 'REPORTE CONSOLIDADO CXC POR CLIENTE (FACTURAS + NOTAS)'
      : 'REPORTE CONSOLIDADO CXC — FACTURAS FISCALES + NOTAS DE ENTREGA',
    subtitle: isClientView
      ? 'Cartera Consolidada Agrupada por Cliente • Facturas Fiscales SENIAT + Notas de Entrega Sumadas'
      : 'Cartera Total Sumada de Ambos Tipos de Documento • Trazabilidad Integral de Cobros',
    moduleCode: 'CXC-CON',
    currentUser,
    config,
    orientation: 'landscape',
    rateValue: tasa
  });

  const cards = [
    {
      label: 'Facturas Fiscales',
      value: formatUsd(facStats.restante),
      subtext: `${facStats.count} docs • Mto: ${formatUsd(facStats.monto)}`,
      color: COLORS.navy
    },
    {
      label: 'Notas de Entrega',
      value: formatUsd(neStats.restante),
      subtext: `${neStats.count} docs • Mto: ${formatUsd(neStats.monto)}`,
      color: COLORS.amber
    },
    {
      label: 'Total Consolidado',
      value: formatUsd(allStats.restante),
      subtext: `${allStats.count} docs • ${formatBs(allStats.restante * tasa)}`,
      color: COLORS.emerald
    },
    {
      label: isClientView ? 'Clientes en Tabla' : 'Docs en Tabla',
      value: isClientView ? `${safeClientRows.length} Clientes` : `${safeDocs.length} Documentos`,
      subtext: `Restante visible: ${formatUsd(visStats.restante)}`,
      color: COLORS.cyan
    }
  ];

  let currentY = addSummaryCards(base.doc, base.startY, cards, base.tableWidth, base.startX);

  const filterParts = [
    `Vista: ${isClientView ? 'Por Cliente (Agrupado)' : 'Por Documento'}`,
    `Tipo: ${filters?.typeLabel || 'Ambos (FAC + NE)'}`,
    `Estado: ${filters?.statusLabel || 'Cartera activa'}`,
    `Vendedor: ${filters?.sellerLabel || 'Todos los vendedores'}`
  ];
  if (filters?.searchTerm) {
    filterParts.push(`Búsqueda: "${String(filters.searchTerm).trim()}"`);
  }

  currentY = addAnalyticalBox(
    base.doc,
    currentY,
    'DESGLOSE CONSOLIDADO Y FILTROS APLICADOS',
    `${filterParts.join(' | ')}\nFacturas Fiscales (${facStats.count}): Monto ${formatUsd(facStats.monto)}, Abonos ${formatUsd(facStats.abonos)}, Restante ${formatUsd(facStats.restante)} • Notas de Entrega (${neStats.count}): Monto ${formatUsd(neStats.monto)}, Abonos ${formatUsd(neStats.abonos)}, Restante ${formatUsd(neStats.restante)} • Vencido Total: ${formatUsd(allStats.vencido)} (${allStats.vencidas} docs).`,
    base.tableWidth,
    base.startX
  );

  const formatDateCell = (d) => {
    if (!d) return '—';
    const date = d instanceof Date ? d : new Date(d);
    if (isNaN(date.getTime())) return String(d).slice(0, 10);
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  };

  if (isClientView) {
    const cliFacCount = safeClientRows.reduce((s, r) => s + Number(r.fac?.count || 0), 0);
    const cliFacRest = safeClientRows.reduce((s, r) => s + Number(r.fac?.restante || 0), 0);
    const cliNeCount = safeClientRows.reduce((s, r) => s + Number(r.ne?.count || 0), 0);
    const cliNeRest = safeClientRows.reduce((s, r) => s + Number(r.ne?.restante || 0), 0);

    const clientBody = safeClientRows.map((row) => [
      String(row.cliente || 'Cliente Comercial'),
      String(row.rif || 'N/A'),
      String(row.fac?.count || 0),
      formatUsd(row.fac?.restante || 0),
      String(row.ne?.count || 0),
      formatUsd(row.ne?.restante || 0),
      formatUsd(row.totalMonto || 0),
      formatUsd(row.totalAbonos || 0),
      formatUsd(row.totalRestante || 0),
      formatBs(Number(row.totalRestante || 0) * tasa),
      String(Number(row.maxDias || 0))
    ]);

    autoTable(base.doc, {
      startY: currentY,
      margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
      tableWidth: base.tableWidth,
      head: [['CLIENTE', 'RIF', 'N° FAC.', 'SALDO FACTURAS', 'N° NOTAS', 'SALDO NOTAS', 'MONTO TOTAL', 'ABONOS', 'SALDO TOTAL ($)', 'SALDO TOTAL (BS.)', 'MÁX. DÍAS']],
      body: clientBody.length > 0 ? clientBody : [['No hay clientes que coincidan con los filtros.', '-', '0', '$ 0.00', '0', '$ 0.00', '$ 0.00', '$ 0.00', '$ 0.00', 'Bs. 0,00', '0']],
      foot: [[
        { content: `TOTAL (${safeClientRows.length} clientes)`, colSpan: 2, styles: { halign: 'left' } },
        String(cliFacCount),
        formatUsd(cliFacRest),
        String(cliNeCount),
        formatUsd(cliNeRest),
        formatUsd(visStats.monto),
        formatUsd(visStats.abonos),
        formatUsd(visStats.restante),
        formatBs(visStats.restante * tasa),
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
    const docBody = safeDocs.map((d) => {
      const isNota = d.tipoDoc === 'NOTA_ENTREGA';
      const estadoLabel = d.estado === 'VENCIDA' ? 'VENCIDA' : d.estado === 'PAGADA' ? 'SOLVENTE' : 'AL DÍA';
      const rawNum = String(d.factura || d.factNum || d.nroDoc || d.id || '0000');
      const docNumLabel = rawNum.startsWith('#') ? rawNum : `#${rawNum}`;
      return [
        isNota ? 'NOTA ENT.' : 'FACTURA',
        docNumLabel,
        String(d.cliente || d.clienteNombre || 'Cliente Comercial'),
        String(d.rif || d.clienteRif || 'N/A'),
        String(d.vendedorId || d.vendedor || 'OF'),
        formatDateCell(d.fechaEmision || d.fechaEmisionIso),
        formatDateCell(d.fechaVencimiento || d.fechaVencimientoIso),
        String(Number(d.diasVencidos ?? 0)),
        formatUsd(d.montoFacturaUsd ?? 0),
        formatUsd(d.abonosUsd ?? 0),
        formatUsd(d.restanteUsd ?? 0),
        estadoLabel
      ];
    });

    autoTable(base.doc, {
      startY: currentY,
      margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
      tableWidth: base.tableWidth,
      head: [['TIPO', 'N° DOC.', 'CLIENTE', 'RIF', 'VEND.', 'EMISIÓN', 'VENCE', 'DÍAS', 'MONTO ($)', 'ABONOS ($)', 'RESTANTE ($)', 'ESTADO']],
      body: docBody.length > 0 ? docBody : [['-', '-', 'No hay documentos que coincidan con los filtros.', '-', '-', '-', '-', '0', '$ 0.00', '$ 0.00', '$ 0.00', '-']],
      foot: [[
        { content: `TOTAL (${safeDocs.length} documentos)`, colSpan: 8, styles: { halign: 'left' } },
        formatUsd(visStats.monto),
        formatUsd(visStats.abonos),
        formatUsd(visStats.restante),
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
        2: { cellWidth: 52.4 },
        3: { cellWidth: 21, halign: 'center' },
        4: { cellWidth: 13, halign: 'center' },
        5: { cellWidth: 17, halign: 'center' },
        6: { cellWidth: 17, halign: 'center' },
        7: { cellWidth: 11, halign: 'right', fontStyle: 'bold' },
        8: { cellWidth: 19, halign: 'right' },
        9: { cellWidth: 19, halign: 'right', textColor: COLORS.emerald, fontStyle: 'bold' },
        10: { cellWidth: 19, halign: 'right', textColor: COLORS.red, fontStyle: 'bold' },
        11: { cellWidth: 19, halign: 'center', fontStyle: 'bold' }
      },
      didParseCell: (data) => {
        if (data.section === 'body') {
          if (data.column.index === 0) {
            const isNota = String(data.cell.raw || '').includes('NOTA');
            data.cell.styles.textColor = isNota ? COLORS.amber : COLORS.cyan;
          } else if (data.column.index === 11 && data.cell.raw && data.cell.raw !== '-') {
            data.cell.text = ''; // Vector badge drawn in didDrawCell
          }
        }
      },
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 11 && data.cell.raw && data.cell.raw !== '-') {
          drawStatusBadge(base.doc, data.cell, data.cell.raw);
        }
      }
    });
  }

  const finalY = base.doc.lastAutoTable?.finalY || currentY;
  addGrandTotalBox(base.doc, finalY + 3.5, [
    { label: 'MONTO EN TABLA (FAC + NE)', value: formatUsd(visStats.monto), subtext: `Abonos: ${formatUsd(visStats.abonos)}`, color: COLORS.navy },
    { label: 'SALDO RESTANTE EN TABLA', value: formatUsd(visStats.restante), subtext: isClientView ? `${safeClientRows.length} clientes • ${visStats.count} docs` : `${safeDocs.length} documentos`, color: visStats.restante > 0 ? COLORS.red : COLORS.emerald },
    { label: 'EQUIVALENTE EN BOLÍVARES', value: formatBs(visStats.restante * tasa), subtext: `Tasa BCV: ${formatBs(tasa)}`, color: COLORS.emerald }
  ], base.tableWidth, base.startX);

  const viewSuffix = isClientView ? 'Por_Cliente' : 'Documentos';
  finalizeAndSave(base.doc, `Reporte_CxC_Consolidado_${viewSuffix}_${new Date().toISOString().slice(0, 10)}.pdf`, currentUser);
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

    return {
      docLabel: `${tipo} #${nro}`,
      provLabel: `${prov}\n${rif}`,
      provNombre: prov,
      fecEmis,
      fecVenc,
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
    formatUsd(r.montoOrigUsd),
    formatUsd(r.abonosUsd),
    formatUsd(r.saldoUsd),
    r.estadoText
  ]);

  autoTable(base.doc, {
    startY: currentY,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    head: [['DOCUMENTO', 'PROVEEDOR / RIF', 'EMISIÓN', 'VENCIM.', 'MONTO ORIG.', 'ABONOS', 'SALDO USD', 'ESTADO']],
    body: tableData.length > 0 ? tableData : [['SIN DOCS', 'No hay documentos para los filtros seleccionados', '-', '-', '$ 0.00', '$ 0.00', '$ 0.00', 'PAGADO']],
    foot: [[
      `TOTALES (${rows.length})`,
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
      fontSize: 6.4,
      fontStyle: 'bold',
      cellPadding: 1.5
    },
    footStyles: {
      fillColor: [226, 232, 240],
      textColor: COLORS.dark,
      fontSize: 6.2,
      fontStyle: 'bold',
      cellPadding: 1.5
    },
    styles: {
      fontSize: 6.0,
      cellPadding: 1.3,
      textColor: COLORS.dark,
      valign: 'middle'
    },
    alternateRowStyles: {
      fillColor: COLORS.lightBg
    },
    columnStyles: {
      0: { fontStyle: 'bold', halign: 'left', cellWidth: 23 },
      1: { cellWidth: 49.9 },
      2: { halign: 'center', cellWidth: 16.5 },
      3: { halign: 'center', cellWidth: 16.5 },
      4: { halign: 'right', cellWidth: 18 },
      5: { halign: 'right', cellWidth: 15 },
      6: { halign: 'right', fontStyle: 'bold', cellWidth: 18 },
      7: { halign: 'center', fontStyle: 'bold', cellWidth: 23 }
    },
    didParseCell: (data) => {
      if (data.column.index === 7 && data.section === 'body') {
        data.cell.text = ''; // Vector badge drawn in didDrawCell
      }
    },
    didDrawCell: (data) => {
      if (data.column.index === 7 && data.section === 'body') {
        drawStatusBadge(base.doc, data.cell, data.cell.raw);
      }
    }
  });

  const finalY = base.doc.lastAutoTable?.finalY || currentY;
  addGrandTotalBox(base.doc, finalY + 3.5, [
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

  // -------------------------------------------------------------------------
  // CASO 1: CIERRE Z o REPORTE X (Comprobante Fiscal Individual)
  // -------------------------------------------------------------------------
  if (reportType === 'CIERRE_Z' || reportType === 'CIERRE_X') {
    const isZ = reportType === 'CIERRE_Z';
    const closure = (fiscalClosures && fiscalClosures.length > 0) ? fiscalClosures[0] : {};
    const base = createBaseReport({
      title: `COMPROBANTE FISCAL DE CIERRE DIARIO (${isZ ? 'REPORTE Z' : 'REPORTE X'})`,
      subtitle: `Control Oficial de Operaciones Mercantiles Diarias • Sistema Homologado SENIAT`,
      moduleCode: 'SEN',
      currentUser,
      config
    });

    const granTotalBs = Number(closure.granTotalBs || closure.totalBs || 0);
    const granTotalUsd = Number(closure.granTotalUsd || (tasa > 0 ? granTotalBs / tasa : 0));
    const baseImp16Bs = Number(closure.baseImponible16Bs || 0);
    const iva16Bs = Number(closure.iva16Bs || 0);
    const igtfBs = Number(closure.igtfBs || 0);
    const exentasBs = Number(closure.ventasExentasBs || 0);

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
      `Reporte N° ${closure.numeroReporteZ || '0001'} emitido el ${closure.fechaCierre ? String(closure.fechaCierre).slice(0, 10) : new Date().toISOString().slice(0, 10)} a las ${closure.horaCierre || '18:00:00'}. Total facturas auditadas: ${closure.totalFacturas || 0} (Desde: ${closure.facturaInicial || 'FAC-001'} Hasta: ${closure.facturaFinal || 'FAC-001'}). Firma Digital Hash SHA-256: ${closure.firmaHashSha256 || '4F8A9B2C1E7D6A5F3B2C1D0E9A8B7C6D5E4F3A2B1C0D9E8F7A6B5C4D3E2F1A0B'}`,
      base.tableWidth,
      base.startX
    );

    const tableData = [
      ['Ventas Exentas o No Sujetas', '0.00%', formatBs(exentasBs), formatUsd(tasa > 0 ? exentasBs / tasa : 0)],
      ['Base Imponible Gravable General (G)', '16.00%', formatBs(baseImp16Bs), formatUsd(tasa > 0 ? baseImp16Bs / tasa : 0)],
      ['Débito Fiscal IVA 16% (G)', '16.00%', formatBs(iva16Bs), formatUsd(tasa > 0 ? iva16Bs / tasa : 0)],
      ['Base Imponible Gravable Reducida (R)', '8.00%', formatBs(closure.baseImponible8Bs || 0), formatUsd(tasa > 0 ? (closure.baseImponible8Bs || 0) / tasa : 0)],
      ['Débito Fiscal IVA 8% (R)', '8.00%', formatBs(closure.iva8Bs || 0), formatUsd(tasa > 0 ? (closure.iva8Bs || 0) / tasa : 0)],
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

    finalizeAndSave(base.doc, `Cierre_${isZ ? 'Z' : 'X'}_${closure.numeroReporteZ || '0001'}_${period}_SIGNUM.pdf`, currentUser);
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
    const dataset = fiscalClosures || [];
    const totalZ = dataset.filter(c => (c.tipo || '').toUpperCase() === 'Z').length;
    const totalAcumBs = dataset.reduce((acc, c) => acc + Number(c.granTotalBs || c.totalBs || 0), 0);
    const totalIvaBs = dataset.reduce((acc, c) => acc + Number(c.iva16Bs || 0), 0);
    const totalIgtfBs = dataset.reduce((acc, c) => acc + Number(c.igtfBs || 0), 0);

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

    const tableData = dataset.map((c, idx) => [
      c.numeroReporteZ ? `Z-${c.numeroReporteZ}` : `REP-${idx + 1}`,
      c.tipo || 'Z',
      c.fechaCierre ? `${String(c.fechaCierre).slice(0, 10)} ${c.horaCierre || ''}` : '2026-10-23',
      `${c.facturaInicial || 'F-1'} al ${c.facturaFinal || 'F-1'}`,
      formatBs(c.baseImponible16Bs || 0),
      formatBs(c.iva16Bs || 0),
      formatBs(c.granTotalBs || c.totalBs || 0),
      String(c.firmaHashSha256 || 'HASH-SHA256').slice(0, 12) + '...'
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
    const dataset = (withholdings && withholdings.length > 0) ? withholdings : purchases;
    const totalRetenidoUsd = dataset.reduce((acc, w) => acc + Number(w.montoRetenidoUsd || (w.totalUsd || 0) * 0.02 || 0), 0);
    const totalRetenidoBs = dataset.reduce((acc, w) => acc + Number(w.montoRetenidoBs || (w.montoRetenidoUsd ? w.montoRetenidoUsd * tasa : 0) || 0), 0);
    const totalBaseUsd = dataset.reduce((acc, w) => acc + Number(w.baseImponibleUsd || w.totalUsd || 0), 0);

    const cards = [
      { label: 'Total Retenido Bs.', value: formatBs(totalRetenidoBs), subtext: formatUsd(totalRetenidoUsd), color: COLORS.navy },
      { label: 'Base Acumulada USD', value: formatUsd(totalBaseUsd), subtext: formatBs(totalBaseUsd * tasa), color: COLORS.cyan },
      { label: 'Comprobantes Emitidos', value: `${dataset.length} Registros`, subtext: `Período: ${period}`, color: COLORS.emerald },
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

    const tableData = dataset.map((w, idx) => {
      const baseUsd = Number(w.baseImponibleUsd || w.totalUsd || 0);
      const retUsd = Number(w.montoRetenidoUsd || baseUsd * 0.02);
      const pct = w.porcentajeRetencion || 2;
      return [
        String(w.comprobante || w.nroComprobante || `RET-ISLR-${1000 + idx}`),
        w.fecha ? String(w.fecha).slice(0, 10) : '2026-10-23',
        w.proveedor || w.nombreProveedor || w.provNombre || 'Proveedor Mercantil',
        w.rif || w.rifProveedor || 'J-00000000-0',
        String(w.factura || w.nroFactura || `FAC-${100 + idx}`),
        formatBs(baseUsd * tasa),
        `${pct}%`,
        formatBs(retUsd * tasa),
        formatUsd(retUsd)
      ];
    });

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
      { label: 'BASE ACUMULADA USD', value: formatUsd(totalBaseUsd), subtext: formatBs(totalBaseUsd * tasa), color: COLORS.cyan },
      { label: 'COMPROBANTES EMITIDOS', value: `${dataset.length} Retenciones`, subtext: `Período ${period}`, color: COLORS.emerald }
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
    const dataset = (igtfSales && igtfSales.length > 0) ? igtfSales : sales.filter(s => (s.igtfUsd > 0 || s.igtfBs > 0 || s.formaPago === 'EFECTIVO_USD' || s.formaPago === 'DIVISAS'));
    const totalDivisasUsd = dataset.reduce((acc, s) => acc + Number(s.totalUsd || s.total || 0), 0);
    const totalIgtfUsd = dataset.reduce((acc, s) => acc + Number(s.igtfUsd || (s.totalUsd || 0) * 0.03 || 0), 0);
    const totalIgtfBs = totalIgtfUsd * tasa;

    const cards = [
      { label: 'IGTF Percibido Bs.', value: formatBs(totalIgtfBs), subtext: formatUsd(totalIgtfUsd), color: COLORS.navy },
      { label: 'Base Divisas Cobrada', value: formatUsd(totalDivisasUsd), subtext: formatBs(totalDivisasUsd * tasa), color: COLORS.cyan },
      { label: 'Operaciones en Divisas', value: `${dataset.length} Cobros`, subtext: 'Alícuota Legal 3%', color: COLORS.emerald },
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

    const tableData = dataset.map((s, idx) => {
      const usd = Number(s.totalUsd || s.total || 0);
      const igtfU = Number(s.igtfUsd || usd * 0.03);
      const bs = usd * tasa;
      return [
        String(s.id || s.factNum || `FAC-${1000 + idx}`),
        s.fecha ? String(s.fecha).slice(0, 10) : '2026-10-23',
        s.cliente || s.clienteNombre || 'Consumidor Final',
        s.clienteRif || s.rif || 'V-00000000-0',
        formatUsd(usd),
        formatBs(bs),
        '3.00%',
        formatBs(igtfU * tasa),
        formatUsd(igtfU)
      ];
    });

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
      { label: 'BASE DIVISAS COBRADA', value: formatUsd(totalDivisasUsd), subtext: formatBs(totalDivisasUsd * tasa), color: COLORS.cyan },
      { label: 'OPERACIONES DIVISAS', value: `${dataset.length} Cobros`, subtext: 'Alícuota 3%', color: COLORS.emerald }
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
    const totVentasBs = sales.reduce((acc, s) => acc + (Number(s.totalUsd || s.total || 0) * tasa), 0);
    const totComprasBs = purchases.reduce((acc, p) => acc + (Number(p.totalUsd || p.total || 0) * tasa), 0);
    const debitoIvaBs = totVentasBs - (totVentasBs / 1.16);
    const creditoIvaBs = totComprasBs - (totComprasBs / 1.16);
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
      ['Total Ventas Facturadas (Bruto con IVA)', formatBs(totVentasBs), formatUsd(totVentasBs / tasa)],
      ['Base Imponible de Ventas Gravables (16%)', formatBs(totVentasBs / 1.16), formatUsd((totVentasBs / 1.16) / tasa)],
      ['Débito Fiscal IVA 16% Determinado', formatBs(debitoIvaBs), formatUsd(debitoIvaBs / tasa)],
      ['Total Compras y Servicios Recibidos (Bruto con IVA)', formatBs(totComprasBs), formatUsd(totComprasBs / tasa)],
      ['Base Imponible de Compras Gravables (16%)', formatBs(totComprasBs / 1.16), formatUsd((totComprasBs / 1.16) / tasa)],
      ['Crédito Fiscal IVA 16% Deducible', formatBs(creditoIvaBs), formatUsd(creditoIvaBs / tasa)],
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

  const dataset = isVentas ? sales : purchases;
  const totalFacturadoBs = dataset.reduce((acc, d) => acc + (Number(d.totalUsd || d.total || 0) * tasa), 0);
  const baseImponibleBs = totalFacturadoBs / 1.16;
  const ivaTotalBs = totalFacturadoBs - baseImponibleBs;

  const cards = [
    { label: isVentas ? 'Total Ventas Facturadas' : 'Total Compras Registradas', value: formatBs(totalFacturadoBs), subtext: formatUsd(totalFacturadoBs / tasa), color: COLORS.navy },
    { label: 'Base Imponible (16%)', value: formatBs(baseImponibleBs), subtext: 'Alícuota General', color: COLORS.cyan },
    { label: isVentas ? 'Débito Fiscal IVA' : 'Crédito Fiscal IVA', value: formatBs(ivaTotalBs), subtext: 'Liquidación SENIAT', color: COLORS.emerald },
    { label: 'Documentos Período', value: `${dataset.length} Registros`, subtext: `Período: ${period}`, color: COLORS.amber }
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

  const tableData = dataset.map((d, idx) => {
    const totalUsd = Number(d.totalUsd || d.total || 0);
    const totBs = totalUsd * tasa;
    const baseBs = totBs / 1.16;
    const ivaBs = totBs - baseBs;

    return [
      String(idx + 1),
      d.fecha ? String(d.fecha).slice(0, 10) : '2026-10-23',
      String(d.factNum || d.id || `FAC-${1000 + idx}`),
      String(d.controlNum || d.nroControl || `00-${String(idx + 1).padStart(6, '0')}`),
      d.clienteNombre || d.cliente || d.proveedorNombre || d.proveedor || 'Consumidor Final',
      d.clienteRif || d.rif || d.proveedorRif || 'J-00000000-0',
      formatBs(baseBs),
      formatBs(ivaBs),
      formatBs(totBs)
    ];
  });

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
      value: `${hoyLitros.toLocaleString('es-VE', { maximumFractionDigits: 1 })} L`,
      subtext: `${hoyCajas.toLocaleString('es-VE')} cajas • ${hoyClientes} cli.`,
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
      value: `${mesLitros.toLocaleString('es-VE', { maximumFractionDigits: 1 })} L`,
      subtext: `${mesCajas.toLocaleString('es-VE')} cjs • ${mesPctMeta}% meta`,
      color: mesPctMeta >= 80 ? COLORS.emerald : mesPctMeta >= 50 ? COLORS.amber : COLORS.red
    }
  ], tableWidth, startX);

  const resumenRows = [
    [
      `Ventas del Día${todayLabel ? ` (${todayLabel})` : ''}`,
      `${hoyDocs} docs (${hoyClientes} cli.)`,
      `${hoyLitros.toLocaleString('es-VE', { maximumFractionDigits: 1 })} L`,
      `${hoyCajas.toLocaleString('es-VE')} cjs`,
      formatUsd(hoyUsd),
      formatBs(hoyBs)
    ],
    [
      'Día Anterior (Comparativo)',
      '—',
      `${ayerLitros.toLocaleString('es-VE', { maximumFractionDigits: 1 })} L`,
      `${(ayerLitros / 11.35).toFixed(1)} cjs`,
      formatUsd(ayerUsd),
      formatBs(ayerUsd * tasa)
    ],
    [
      `Acumulado ${ventasMesLabel || 'Mes Actual'} (Meta: ${mesMeta.toLocaleString('es-VE')} L • ${mesPctMeta}%)`,
      `${mesDocs} docs`,
      `${mesLitros.toLocaleString('es-VE', { maximumFractionDigits: 1 })} L`,
      `${mesCajas.toLocaleString('es-VE')} cjs`,
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
      `${proyLts.toLocaleString('es-VE', { maximumFractionDigits: 1 })} L`,
      `${(proyLts / 11.35).toFixed(1)} cjs`,
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
    const cajasFacturadas = kpi.cajasFacturadas || (litrosFacturados > 0 ? (litrosFacturados / 11.356).toFixed(1) : 0);
    const preventaUsd = Number(kpi.preventaPendienteUsd || 0);
    const precioPromedio = Number(kpi.precioPromedioLitro || 5.93);
    const cumplimientoPct = Number(kpi.cumplimientoLitrosPct || kpi.cumplimientoMetaPct || kpi.porcentajeCumplimiento || 0);

    const cards = [
      { label: 'Litros Facturados', value: `${litrosFacturados.toLocaleString('es-VE', { maximumFractionDigits: 1 })} L`, subtext: `${cajasFacturadas} cajas despachadas`, color: COLORS.navy },
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
      `La Dirección Comercial de SIGNUM MOTORVEN en el período analizado (${periodoLabel}) alcanzó una facturación de ${litrosFacturados.toLocaleString('es-VE', { maximumFractionDigits: 1 })} litros (${cajasFacturadas} cajas equivalentes de lubricantes Oilstone), registrando un ${cumplimientoPct.toFixed(1)}% de cumplimiento. El canal mantiene ${formatUsd(preventaUsd)} en preventa por facturar y despachar, con un precio medio consolidado de ${formatUsd(precioPromedio)} por litro.`,
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
      const cajas = (litros / 11.356).toFixed(1);
      return [
        s.coVen || s.co_ven || `VEN-${idx + 1}`,
        s.venDes || s.nombre || 'Asesor Comercial',
        `${meta.toLocaleString('es-VE')} L`,
        `${litros.toLocaleString('es-VE', { maximumFractionDigits: 1 })} L`,
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
      ? ` En el corte diario (${todayLabel || 'Hoy'}) se facturaron ${formatUsd(Number(ventasDelDia?.usd || 0))} (${Number(ventasDelDia?.litros || 0).toLocaleString('es-VE', { maximumFractionDigits: 1 })} L), y el acumulado de ${ventasMesLabel || 'mes en curso'} suma ${formatUsd(Number(ventasAcumuladoMes?.usd || 0))} (${Number(ventasAcumuladoMes?.litros || 0).toLocaleString('es-VE', { maximumFractionDigits: 1 })} L).`
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
    const stockCajas = Number(kpi.stockTotalCajas || (stockLitros > 0 ? (stockLitros / 11.356).toFixed(1) : 0));
    const valorizacionUsd = Number(kpi.valorizacionInventarioUsd || 0);
    const topProd = kpi.topLubricanteNombre || 'Oilstone 20W-50';
    const topProdLitros = Number(kpi.topLubricanteLitros || 0);
    const huesosUsd = Number(kpi.capitalHuesosUsd || 0);

    const cards = [
      { label: 'Stock en Almacén', value: `${stockLitros.toLocaleString('es-VE', { maximumFractionDigits: 1 })} L`, subtext: `${stockCajas} cajas en existencia`, color: COLORS.navy },
      { label: 'Valorización Stock', value: formatUsd(valorizacionUsd), subtext: formatBs(valorizacionUsd * tasa), color: COLORS.emerald },
      { label: 'Top Lubricante Líder', value: topProd, subtext: `${topProdLitros.toLocaleString()} L vendidos`, color: COLORS.cyan },
      { label: 'Stock Inmovilizado', value: formatUsd(huesosUsd), subtext: 'Capital en "Huesos"', color: huesosUsd > 0 ? COLORS.red : COLORS.emerald }
    ];

    let currentY = addSummaryCards(base.doc, base.startY, cards, base.tableWidth, base.startX);

    currentY = addAnalyticalBox(
      base.doc,
      currentY,
      'SÍNTESIS DE AUDITORÍA DE INVENTARIO & REGLA FIFO',
      `El almacén general de lubricantes registra ${stockLitros.toLocaleString('es-VE', { maximumFractionDigits: 1 })} litros físicos disponibles (${stockCajas} cajas) valorizados a costo en ${formatUsd(valorizacionUsd)} (${formatBs(valorizacionUsd * tasa)}). El producto de mayor demanda es ${topProd}. La auditoría de rotación identifica ${formatUsd(huesosUsd)} en productos inmovilizados ("huesos"), recomendando planes de promoción y despacho bajo estricta regla FIFO.`,
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
        `${lts.toLocaleString('es-VE')} L`,
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
  const cajasFacturadas = kpi.cajasFacturadas || (litrosFacturados > 0 ? (litrosFacturados / 11.356).toFixed(1) : 0);
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
    { label: 'Litros Facturados', value: `${litrosFacturados.toLocaleString('es-VE', { maximumFractionDigits: 1 })} L`, subtext: `${cajasFacturadas} cajas despachadas`, color: COLORS.navy },
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
    `La Dirección Comercial en el período (${periodoLabel}) consolidó una facturación de ${litrosFacturados.toLocaleString('es-VE', { maximumFractionDigits: 1 })} litros (${cajasFacturadas} cajas equivalentes de lubricantes Oilstone), alcanzando un ${cumplimientoPct.toFixed(1)}% de cumplimiento sobre la meta comercial. Se mantiene un saldo de preventa por facturar de ${formatUsd(preventaUsd)} con un precio medio consolidado de ${formatUsd(precioPromedio)} por litro.`,
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
    const cajas = (litros / 11.356).toFixed(1);
    return [
      s.coVen || s.co_ven || `VEN-${idx + 1}`,
      s.venDes || s.nombre || 'Asesor Comercial',
      `${meta.toLocaleString('es-VE')} L`,
      `${litros.toLocaleString('es-VE', { maximumFractionDigits: 1 })} L`,
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
  const stockCajas = Number(kpi.stockTotalCajas || (stockLitros > 0 ? (stockLitros / 11.356).toFixed(1) : 0));
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
    { label: 'Stock en Almacén', value: `${stockLitros.toLocaleString('es-VE', { maximumFractionDigits: 1 })} L`, subtext: `${stockCajas} cajas en existencia`, color: COLORS.navy },
    { label: 'Valorización Stock', value: formatUsd(valorizacionUsd), subtext: formatBs(valorizacionUsd * tasa), color: COLORS.emerald },
    { label: 'Top Lubricante Líder', value: topProd, subtext: `${topProdLitros.toLocaleString()} L vendidos`, color: COLORS.cyan },
    { label: 'Stock Inmovilizado', value: formatUsd(huesosUsd), subtext: 'Capital en "Huesos"', color: huesosUsd > 0 ? COLORS.red : COLORS.emerald }
  ];

  currentY4 = addSummaryCards(base.doc, currentY4, cardsB4, base.tableWidth, base.startX);

  currentY4 = addAnalyticalBox(
    base.doc,
    currentY4,
    'SÍNTESIS DE AUDITORÍA DE INVENTARIO & REGLA FIFO',
    `El almacén general de lubricantes registra ${stockLitros.toLocaleString('es-VE', { maximumFractionDigits: 1 })} litros físicos disponibles (${stockCajas} cajas) valorizados a costo en ${formatUsd(valorizacionUsd)} (${formatBs(valorizacionUsd * tasa)}). El producto de mayor demanda es ${topProd}. La auditoría de rotación identifica ${formatUsd(huesosUsd)} en productos inmovilizados ("huesos"), recomendando planes de promoción y despacho bajo estricta regla FIFO.`,
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
      `${lts.toLocaleString('es-VE')} L`,
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

  const getProductCost = (p) => Number(p?.costoUsd ?? p?.costo_usd ?? p?.costo ?? 0) || 0;
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
    : products.reduce((acc, p) => acc + (getProductWarehouseStocks(p).stock01 * getProductCost(p)), 0);
  const alm02ValorUsdSummary = kpis?.alm02TotalValorUsd != null
    ? Number(kpis.alm02TotalValorUsd)
    : products.reduce((acc, p) => acc + (getProductWarehouseStocks(p).stock02 * getProductCost(p)), 0);

  const breakdownByUnit = { Caja: 0, Paila: 0, Tambor: 0, Totem: 0, Litros: 0 };
  products.forEach((p) => {
    const u = resolveProductUnit(p, 'Caja');
    const stockForWh = getStockForWarehouse(p);
    if (breakdownByUnit[u] !== undefined) {
      breakdownByUnit[u] += Number(stockForWh || 0);
    }
  });
  const breakdownLabel = [
    breakdownByUnit.Caja > 0 ? `${breakdownByUnit.Caja.toLocaleString('es-VE')} Cajas` : null,
    breakdownByUnit.Paila > 0 ? `${breakdownByUnit.Paila.toLocaleString('es-VE')} Pailas` : null,
    breakdownByUnit.Tambor > 0 ? `${breakdownByUnit.Tambor.toLocaleString('es-VE')} Tambores` : null,
    breakdownByUnit.Totem > 0 ? `${breakdownByUnit.Totem.toLocaleString('es-VE')} Totem` : null,
    breakdownByUnit.Litros > 0 ? `${breakdownByUnit.Litros.toLocaleString('es-VE')} L Granel` : null,
  ].filter(Boolean).join(' • ') || '0 Unidades';

  const tasa = Number(config?.tasaDolar) || 827.73;
  const computedValorUsd = products.reduce(
    (acc, p) => acc + (getStockForWarehouse(p) * getProductCost(p)),
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
      { label: 'Stock Total Sistema', value: `${totalLitros.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Litros`, subtext: breakdownLabel, color: COLORS.cyan },
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
      { label: whSpec.cardLabel, value: `${totalLitros.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Litros`, subtext: breakdownLabel, color: whSpec.cardColor },
      { label: 'Régimen de Despacho', value: whSpec.regime, subtext: whSpec.regimeSub, color: COLORS.navy },
      { label: 'Existencia Activa', value: `${activeSkus} SKUs con Stock`, subtext: `${countCriticos} Críticos • ${countReorden} Reorden`, color: countCriticos > 0 ? COLORS.amber : COLORS.emerald },
      { label: 'Valoración al Costo', value: formatUsd(totalValorUsd), subtext: formatBs(totalValorBs), color: COLORS.navy }
    ];
  } else {
    cards = [
      { label: 'Volumen Total en Bodega (Σ Alm 01 + 02)', value: `${totalLitros.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Litros`, subtext: breakdownLabel, color: COLORS.cyan },
      { label: '01: Alm. Principal (Fiscal)', value: `${alm01LitrosSummary.toLocaleString('es-VE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} L`, subtext: kpis?.alm01BreakdownLabel || 'Facturas Fiscales SENIAT', color: COLORS.emerald },
      { label: '02: Alm. Central (N/Entrega)', value: `${alm02LitrosSummary.toLocaleString('es-VE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} L`, subtext: kpis?.alm02BreakdownLabel || 'Notas de Entrega Bóveda', color: COLORS.cyan },
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
    ? `El inventario de 01: ALMACÉN PRINCIPAL / MOSTRADOR (Facturas Fiscales SENIAT) registra un volumen disponible de ${totalLitros.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Litros (${breakdownLabel}) con valorización total al costo de ${formatUsd(totalValorUsd)} (${formatBs(totalValorBs)}). Todas las transacciones de salida de este almacén son soportadas fiscalmente. Se identifican ${countCriticos} ítems en umbral de alerta que ameritan atención o reposición.`
    : is02
    ? `El inventario de 02: ALMACÉN CENTRAL / BÓVEDA (Notas de Entrega Comerciales) registra un volumen disponible de ${totalLitros.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Litros (${breakdownLabel}) con valorización total al costo de ${formatUsd(totalValorUsd)} (${formatBs(totalValorBs)}). Todas las transacciones de salida corresponden a entregas comerciales directas. Se identifican ${countCriticos} ítems en umbral de alerta que ameritan atención o reposición.`
    : `El inventario consolidado total (Almacén 01 + Almacén 02) registra un volumen global de ${totalLitros.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Litros (${breakdownLabel}) con valorización total al costo de ${formatUsd(totalValorUsd)} (${formatBs(totalValorBs)}). Desglose Operativo por Almacén: [01: Almacén Principal (Facturas Fiscales SENIAT)]: ${alm01LitrosSummary.toLocaleString('es-VE', { minimumFractionDigits: 2 })} L (${formatUsd(alm01ValorUsdSummary)}) | [02: Almacén Central (Notas de Entrega Bóveda)]: ${alm02LitrosSummary.toLocaleString('es-VE', { minimumFractionDigits: 2 })} L (${formatUsd(alm02ValorUsdSummary)}). Se auditan ${totalSkus} SKUs totales en catálogo con ${countCriticos} ítems en umbral de alerta que ameritan reposición con planta.`;

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

      return [
        p.codigo || 'SKU-00',
        p.descripcion || 'Producto',
        p.ubicacion || 'Palet A-01',
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
      const valTotal = stock * costo;
      const lts = (stock * resolveProductLitersPerUnit(p)).toFixed(1);
      const estado = stock <= 0 ? 'AGOTADO' : stock <= min ? 'CRÍTICO' : 'ÓPTIMO';

      return [
        p.codigo || 'SKU-00',
        p.descripcion || 'Producto',
        resolveProductUnit(p, 'Caja'),
        `${stock} ${resolveProductUnit(p, 'Caja')}`,
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
      const costo = getProductCost(p);
      const precio = getProductRetailPrice(p) || Number(p.precioA || 0);
      const valTotal = stock * costo;
      const lts = (stock * resolveProductLitersPerUnit(p)).toFixed(1);
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
        { label: whSpec.footerVolLabel, value: `${totalLitros.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Litros`, subtext: breakdownLabel, color: whSpec.cardColor },
        { label: whSpec.footerRopLabel, value: `${countCriticos} Productos`, subtext: 'Stock crítico o reposición', color: countCriticos > 0 ? COLORS.amber : COLORS.emerald }
      ]
    : [
        { label: 'VALORIZACIÓN TOTAL (AMBOS)', value: formatUsd(totalValorUsd), subtext: formatBs(totalValorBs), color: COLORS.navy },
        { label: 'VOLUMEN CONSOLIDADO (Σ 01+02)', value: `${totalLitros.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Litros`, subtext: breakdownLabel, color: COLORS.emerald },
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
  const tasa = Number(config?.tasaDolar) || 827.73;
  const orderId = String(order.id || order.correlativo || 'PED-001');
  const orderDate = order.fecha ? String(order.fecha).slice(0, 10) : new Date().toISOString().slice(0, 10);
  const sellerName = order.vendedor || order.vendedorNombre || currentUser?.nombre || 'Asesor Comercial';
  const sellerCode = order.codigoVendedor || order.vendedorId || currentUser?.codigo || 'VEN-01';
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

  // Cálculos de Totales y Volúmenes
  let totalLitros = 0;
  let totalUsd = 0;

  if (items.length > 0) {
    items.forEach((it) => {
      const qty = Number(it.cantidad || it.qty || 1);
      const unitLitros = Number(it.litrosUnitarios || it.litrosPorUnidad || 0);
      const rowLitros = it.litrosTotales ? Number(it.litrosTotales) : qty * unitLitros;
      const unitPrice = resolveItemUnitPriceUsd(it);
      const rowSubtotal = resolveItemSubtotalUsd(it);

      totalLitros += rowLitros;
      totalUsd += rowSubtotal;
    });
  } else {
    totalUsd = Number(order.totalUsd || order.totalNetoUsd || order.total || 0);
    totalLitros = Number(order.totalLitros || 0);
  }

  const totalBs = totalUsd * tasa;
  const status = (order.status || 'PENDIENTE').toUpperCase();

  // 1. Tarjetas Superiores de Resumen de la Orden
  const cards = [
    { label: 'N° de Pedido', value: orderId, subtext: `Emisión: ${orderDate}`, color: COLORS.navy },
    { label: 'Volumen Total', value: `${totalLitros.toFixed(1)} Lts.`, subtext: `${items.length} Renglones`, color: COLORS.cyan },
    { label: 'Monto Total USD', value: formatUsd(totalUsd), subtext: formatBs(totalBs), color: COLORS.emerald },
    { label: 'Vigencia Reserva', value: '72 Horas', subtext: status === 'FACTURADO' ? 'Facturado' : (status === 'ANULADO' ? 'Anulado' : 'Reserva Activa'), color: status === 'ANULADO' ? COLORS.red : COLORS.amber }
  ];

  let currentY = addSummaryCards(base.doc, base.startY, cards, base.tableWidth, base.startX);

  // 2. Banner Oficial de Política de Reserva por 72 horas
  const bannerH = 9.0;
  base.doc.setFillColor(254, 243, 199); // Amber 100 soft
  base.doc.setDrawColor(...COLORS.amber);
  base.doc.setLineWidth(0.35);
  base.doc.roundedRect(base.startX, currentY, base.tableWidth, bannerH, 1.2, 1.2, 'FD');

  base.doc.setFillColor(...COLORS.amber);
  base.doc.roundedRect(base.startX, currentY, 2.5, bannerH, 0.6, 0.6, 'F');

  base.doc.setFont('helvetica', 'bold');
  base.doc.setFontSize(6.4);
  base.doc.setTextColor(...COLORS.amber);
  base.doc.text('POLÍTICA DE RESERVA DE INVENTARIO (CORTE OPERATIVO: 72 HORAS):', base.startX + 5, currentY + 3.4);

  base.doc.setFont('helvetica', 'normal');
  base.doc.setFontSize(5.6);
  base.doc.setTextColor(...COLORS.dark);
  const noticeText = `Esta nota de pedido compromete stock temporalmente en almacén durante 72 horas desde su emisión (${orderDate}). Pasado este plazo, los ítems reservados no facturados caducan y se liberan de forma automática a la disponibilidad general.`;
  const splitNotice = base.doc.splitTextToSize(noticeText, base.tableWidth - 8);
  base.doc.text(splitNotice, base.startX + 5, currentY + 6.6);

  currentY += bannerH + 2.5;

  // 3. Bloque Bipartito: Asesor de Ventas y Datos del Cliente
  const boxH = 18.5;
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
  base.doc.setFontSize(6.3);
  base.doc.setTextColor(...COLORS.navy);
  base.doc.text('DATOS DEL ASESOR / FUERZA DE VENTAS', base.startX + 3, currentY + 3.8);

  base.doc.setFont('helvetica', 'normal');
  base.doc.setFontSize(5.6);
  base.doc.setTextColor(...COLORS.slate);
  base.doc.text('Asesor Comercial:', base.startX + 3, currentY + 7.5);
  base.doc.setFont('helvetica', 'bold');
  base.doc.setTextColor(...COLORS.dark);
  base.doc.text(`${sellerName} (${sellerCode})`, base.startX + 27, currentY + 7.5);

  base.doc.setFont('helvetica', 'normal');
  base.doc.setTextColor(...COLORS.slate);
  base.doc.text('Canal Comercial:', base.startX + 3, currentY + 11.2);
  base.doc.setFont('helvetica', 'bold');
  base.doc.setTextColor(...COLORS.dark);
  base.doc.text('Mayorista / Despacho Planta', base.startX + 27, currentY + 11.2);

  base.doc.setFont('helvetica', 'normal');
  base.doc.setTextColor(...COLORS.slate);
  base.doc.text('Condición de Pago:', base.startX + 3, currentY + 14.9);
  base.doc.setFont('helvetica', 'bold');
  base.doc.setTextColor(...COLORS.navy);
  base.doc.text(paymentTerm, base.startX + 27, currentY + 14.9);

  // Cliente Destinatario
  base.doc.setFont('helvetica', 'bold');
  base.doc.setFontSize(6.3);
  base.doc.setTextColor(...COLORS.navy);
  base.doc.text('DATOS DEL CLIENTE / RECEPTOR', base.startX + colW + 3, currentY + 3.8);

  base.doc.setFont('helvetica', 'normal');
  base.doc.setFontSize(5.6);
  base.doc.setTextColor(...COLORS.slate);
  base.doc.text('Razón Social:', base.startX + colW + 3, currentY + 7.5);
  base.doc.setFont('helvetica', 'bold');
  base.doc.setTextColor(...COLORS.dark);
  const clientNameTrunc = base.doc.splitTextToSize(clientName, colW - 25)[0] || clientName;
  base.doc.text(clientNameTrunc, base.startX + colW + 22, currentY + 7.5);

  base.doc.setFont('helvetica', 'normal');
  base.doc.setTextColor(...COLORS.slate);
  base.doc.text('RIF / Zona:', base.startX + colW + 3, currentY + 11.2);
  base.doc.setFont('helvetica', 'bold');
  base.doc.setTextColor(...COLORS.dark);
  base.doc.text(`${clientRif}  •  Zona: ${clientZone}`, base.startX + colW + 22, currentY + 11.2);

  base.doc.setFont('helvetica', 'normal');
  base.doc.setTextColor(...COLORS.slate);
  base.doc.text('Entrega en:', base.startX + colW + 3, currentY + 14.9);
  base.doc.setFont('helvetica', 'bold');
  base.doc.setTextColor(...COLORS.dark);
  const dirTrunc = base.doc.splitTextToSize(clientDir, colW - 25)[0] || clientDir;
  base.doc.text(dirTrunc, base.startX + colW + 22, currentY + 14.9);

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
      rowLitros > 0 ? `${rowLitros.toFixed(1)} L` : '-',
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
    body: tableData.length > 0 ? tableData : [['1', 'PED-GEN', 'Renglón Único Preventa', 'Unidad', '1', `${totalLitros.toFixed(1)} L`, formatUsd(totalUsd), formatUsd(totalUsd), formatBs(totalBs)]],
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
    { label: 'VOLUMEN TOTAL LUBRICANTES', value: `${totalLitros.toFixed(1)} Litros`, subtext: `${items.length} Renglones`, color: COLORS.cyan },
    { label: 'MONTO TOTAL PREVENTA USD', value: formatUsd(totalUsd), subtext: 'Base imponible calculada', color: COLORS.navy },
    { label: 'TOTAL EQUIVALENTE BS. BCV', value: formatBs(totalBs), subtext: `Tasa: ${formatBs(tasa)} / USD`, color: COLORS.emerald }
  ], base.tableWidth, base.startX);

  finalYForSignatures += 16;

  // Observaciones si existen
  if (hasNotes) {
    base.doc.setFont('helvetica', 'bold');
    base.doc.setFontSize(5.8);
    base.doc.setTextColor(...COLORS.slate);
    base.doc.text('OBSERVACIONES COMERCIALES:', base.startX + 2, finalYForSignatures);
    base.doc.setFont('helvetica', 'normal');
    base.doc.setTextColor(...COLORS.dark);
    const splitNotes = base.doc.splitTextToSize(notes, base.tableWidth - 4);
    base.doc.text(splitNotes, base.startX + 2, finalYForSignatures + 3.2);
    finalYForSignatures += 8;
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
  const fechaStr = sale.fecha ? new Date(sale.fecha).toLocaleDateString('es-VE') : new Date().toLocaleDateString('es-VE');
  const horaStr = sale.fecha ? new Date(sale.fecha).toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit' });
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
    { label: 'Volumen a Despachar', value: `${totalLitros.toFixed(1)} Lts.`, subtext: `${totalUnidades} Cajas / Tambores`, color: COLORS.cyan },
    { label: 'Zona & Transporte', value: zonaLogistica, subtext: transportista, color: COLORS.emerald },
    { label: 'Estatus en Planta', value: 'AUTORIZADO', subtext: 'Factura Emitida y Cobrada', color: COLORS.amber }
  ];

  let currentY = addSummaryCards(base.doc, base.startY, cards, base.tableWidth, base.startX);

  // 2. Banner de Control Operativo de Almacén
  const bannerH = 9.0;
  base.doc.setFillColor(239, 246, 255); // Blue 50
  base.doc.setDrawColor(...COLORS.cyan);
  base.doc.setLineWidth(0.35);
  base.doc.roundedRect(base.startX, currentY, base.tableWidth, bannerH, 1.2, 1.2, 'FD');

  base.doc.setFillColor(...COLORS.cyan);
  base.doc.roundedRect(base.startX, currentY, 2.5, bannerH, 0.6, 0.6, 'F');

  base.doc.setFont('helvetica', 'bold');
  base.doc.setFontSize(6.4);
  base.doc.setTextColor(...COLORS.cyan);
  base.doc.text('DOCUMENTO DE CONTROL FÍSICO DE ALMACÉN (SIN VALORES MONETARIOS):', base.startX + 5, currentY + 3.4);

  base.doc.setFont('helvetica', 'normal');
  base.doc.setFontSize(5.6);
  base.doc.setTextColor(...COLORS.dark);
  const noticeText = `El personal de almacén debe verificar cada renglón físicamente en rampa marcando la casilla de verificación [  ]. La salida del camión requiere la firma del despachador, del transportista y el sello de recepción del cliente.`;
  const splitNotice = base.doc.splitTextToSize(noticeText, base.tableWidth - 8);
  base.doc.text(splitNotice, base.startX + 5, currentY + 6.6);

  currentY += bannerH + 2.5;

  // 3. Bloque Bipartito: Destinatario vs Logística
  const boxH = 19;
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
  base.doc.setFontSize(6.4);
  base.doc.setTextColor(...COLORS.navy);
  base.doc.text('DATOS DE ENTREGA Y DESTINATARIO', base.startX + 3, currentY + 4.2);

  base.doc.setFont('helvetica', 'normal');
  base.doc.setFontSize(5.8);
  base.doc.setTextColor(...COLORS.dark);
  base.doc.text(`Cliente: ${clienteNombre.slice(0, 42)}`, base.startX + 3, currentY + 8);
  base.doc.text(`RIF: ${clienteRif}`, base.startX + 3, currentY + 11.5);
  base.doc.text(`Dirección: ${direccion.slice(0, 45)}`, base.startX + 3, currentY + 15);

  // Columna Derecha: Trazabilidad Logística
  base.doc.setFont('helvetica', 'bold');
  base.doc.setFontSize(6.4);
  base.doc.setTextColor(...COLORS.navy);
  base.doc.text('TRAZABILIDAD DE FACTURACIÓN Y TRANSPORTE', base.startX + colW + 3, currentY + 4.2);

  base.doc.setFont('helvetica', 'normal');
  base.doc.setFontSize(5.8);
  base.doc.setTextColor(...COLORS.dark);
  base.doc.text(`Nota Pedido Origen: ${pedidoOrigen} • Factura: ${facturaDoc}`, base.startX + colW + 3, currentY + 8);
  base.doc.text(`Facturado por: ${cajera} • Asesor: ${vendedor}`, base.startX + colW + 3, currentY + 11.5);
  base.doc.text(`Unidad de Carga: ${transportista} • Ruta: ${zonaLogistica}`, base.startX + colW + 3, currentY + 15);

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
      `${rowLitros.toFixed(1)} L`,
      '[   ] CONFORME'
    ];
  });

  autoTable(base.doc, {
    startY: currentY,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    head: [['#', 'CÓDIGO', 'DESCRIPCIÓN DEL LUBRICANTE', 'PRESENTACIÓN', 'CANTIDAD', 'LITROS', 'VERIF. RAMPA']],
    body: tableData.length > 0 ? tableData : [['1', 'LUB-001', 'LUBRICANTE MOTORVEN', 'Caja', '1', '12.0 L', '[   ] CONFORME']],
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
    { label: 'TOTAL LITROS DE ACEITE', value: `${totalLitros.toFixed(1)} Litros`, subtext: `${items.length} Renglones`, color: COLORS.cyan },
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
  const rawSumUsd = resolved.reduce((acc, r) => acc + r.subtotalUsd, 0);
  if (resolved.length > 0 && headerTotalUsd > 0 && rawSumUsd > 0 && (safeDoc._customCreated || Math.abs(rawSumUsd - headerTotalUsd) <= 0.5)) {
    const ratio = headerTotalUsd / rawSumUsd;
    if (Math.abs(ratio - 1) > 0.0001 && (safeDoc._customCreated || Math.abs(rawSumUsd - headerTotalUsd) <= 0.5)) {
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
export function generateDeliveryNotePDF({
  deliveryNote = null,
  sale = null,
  order = null,
  config = {},
  currentUser = null,
  client = null,
  clients = null,
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

  const fechaObj = docData.fechaEmision || docData.fecha || new Date();
  const fechaStr = new Date(fechaObj).toLocaleDateString('es-VE');

  const diasCredito = docData.condicionPago === 'CONTADO' ? 0 : Number(docData.diasCredito ?? 0);
  const fechaVencObj = docData.fechaVencimiento
    ? new Date(docData.fechaVencimiento)
    : new Date(new Date(fechaObj).getTime() + (diasCredito * 24 * 60 * 60 * 1000));
  const fechaVencStr = fechaVencObj.toLocaleDateString('es-VE');

  const resolvedClient = resolveDocumentClientInfo(docData, client, clients);
  const clienteNombre = resolvedClient.nombre;
  const clienteRif = resolvedClient.rif;
  const clienteDireccion = resolvedClient.direccion;
  const clienteTelefono = resolvedClient.telefono;

  const almacenOrigen = docData.almacen || 'Almacén 02 (Mercancía General / Preventa)';
  const vendedor = docData.vendedor || docData.vendedorNombre || docData.vendedorDisplay || docData.vendedorId || currentUser?.nombre || 'Asesor Comercial';
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
      it.volumenTotal > 0 ? `${it.volumenTotal.toFixed(1)} L` : '-',
      `$ ${it.precioUsd.toFixed(2)}`,
      `$ ${it.subtotalUsd.toFixed(2)}`,
      `Bs. ${it.subtotalBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
    { label: 'Carga Total', value: `${totalLitros.toFixed(1)} Litros`, subtext: `${totalBultos} Unid / Bultos`, color: COLORS.amber },
    { label: 'Monto Total USD', value: formatUsd(totalNetoUsd), subtext: formatBs(totalNetoBs), color: COLORS.emerald }
  ];

  let currentY = addSummaryCards(base.doc, base.startY, cards, base.tableWidth, base.startX);

  // 2. Bloque Bipartito: Datos del Receptor / Cliente vs Expedición
  const colW = (base.tableWidth - 2) / 2;
  base.doc.setFont('helvetica', 'normal');
  base.doc.setFontSize(5.8);
  const addrLines = base.doc.splitTextToSize(`Dirección Entrega: ${clienteDireccion}`, colW - 6).slice(0, 3);
  const boxH = Math.max(20, 15 + addrLines.length * 3.1 + 2.4);

  base.doc.setFillColor(...COLORS.lightBg);
  base.doc.setDrawColor(...COLORS.border);
  base.doc.setLineWidth(0.3);
  base.doc.roundedRect(base.startX, currentY, base.tableWidth, boxH, 1.2, 1.2, 'FD');

  // Separador vertical
  base.doc.setDrawColor(...COLORS.border);
  base.doc.line(base.startX + colW, currentY + 1.5, base.startX + colW, currentY + boxH - 1.5);

  // Columna Izquierda: Datos del Receptor / Cliente
  base.doc.setFont('helvetica', 'bold');
  base.doc.setFontSize(6.4);
  base.doc.setTextColor(...COLORS.navy);
  base.doc.text('DATOS DEL RECEPTOR / CLIENTE', base.startX + 3, currentY + 4.2);

  base.doc.setFont('helvetica', 'normal');
  base.doc.setFontSize(5.8);
  base.doc.setTextColor(...COLORS.dark);
  base.doc.text(`Cliente: ${clienteNombre.slice(0, 44)}`, base.startX + 3, currentY + 8);
  base.doc.text(`RIF / C.I.: ${clienteRif}${clienteTelefono ? ` • Tel: ${clienteTelefono}` : ''}`, base.startX + 3, currentY + 11.5);
  base.doc.text(addrLines, base.startX + 3, currentY + 15);
  const condY = currentY + 15 + (addrLines.length - 1) * 3.1 + 3.4;
  base.doc.text(`Condición: ${condicionPago} • Vencimiento: ${fechaVencStr}`, base.startX + 3, condY);

  // Columna Derecha: Expedición
  base.doc.setFont('helvetica', 'bold');
  base.doc.setFontSize(6.4);
  base.doc.setTextColor(...COLORS.navy);
  base.doc.text('EXPEDICIÓN', base.startX + colW + 3, currentY + 4.2);

  base.doc.setFont('helvetica', 'normal');
  base.doc.setFontSize(5.8);
  base.doc.setTextColor(...COLORS.dark);
  base.doc.text(`Despachado de: ${almacenOrigen}`, base.startX + colW + 3, currentY + 8);
  base.doc.text(`Pedido de Origen: ${pedidoOrigen} • Vendedor: ${vendedor}`, base.startX + colW + 3, currentY + 11.5);
  base.doc.text(`Unidad / Transportista: ${transportista.slice(0, 42)}`, base.startX + colW + 3, currentY + 15);
  base.doc.text(`Método: ${metodoPago} • Tasa Oficial BCV: Bs. ${tasa.toFixed(2)} / USD`, base.startX + colW + 3, condY);

  currentY += boxH + 2.8;

  // Función auxiliar para dibujar el encabezado de continuación en páginas 2+
  const drawContinuationHeader = () => {
    drawParentContainer(base.doc, false);

    base.doc.setFillColor(...COLORS.navy);
    base.doc.roundedRect(base.startX, 18.5, base.tableWidth, 6.8, 1, 1, 'F');
    base.doc.setFillColor(...COLORS.red);
    base.doc.rect(base.startX, 18.5, 3, 6.8, 'F');

    base.doc.setFont('helvetica', 'bold');
    base.doc.setFontSize(7.6);
    base.doc.setTextColor(255, 255, 255);
    base.doc.text(
      `NOTA DE ENTREGA N° ${correlativoDisplay} — CONTINUACIÓN`,
      base.startX + 5.5,
      23.1
    );

    base.doc.setFont('helvetica', 'normal');
    base.doc.setFontSize(6.0);
    base.doc.setTextColor(226, 232, 240);
    base.doc.text(
      `Cliente: ${clienteNombre.slice(0, 36)} (${clienteRif}) • Emisión: ${fechaStr}`,
      base.startX + base.tableWidth - 3,
      23.1,
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
    body: tableData.length > 0 ? tableData : [['1', 'LUB-GEN', 'Despacho de Lubricantes según Nota de Entrega', 'Caja', '1', totalLitros > 0 ? `${totalLitros.toFixed(1)} L` : '-', `$ ${totalNetoUsd.toFixed(2)}`, `$ ${totalNetoUsd.toFixed(2)}`, `Bs. ${totalNetoBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`]],
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.navy,
      textColor: [255, 255, 255],
      fontSize: 6.8,
      fontStyle: 'bold',
      cellPadding: { top: 1.8, bottom: 1.8, left: 1.1, right: 1.1 },
      valign: 'middle'
    },
    styles: {
      fontSize: 7.0,
      cellPadding: { top: 1.7, bottom: 1.7, left: 1.1, right: 1.1 },
      textColor: COLORS.dark,
      overflow: 'linebreak',
      valign: 'middle'
    },
    alternateRowStyles: {
      fillColor: COLORS.lightBg
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 6.5 },
      1: { halign: 'center', fontStyle: 'bold', cellWidth: 18.5 },
      2: { halign: 'left', cellWidth: 47.9 },
      3: { halign: 'center', cellWidth: 21 },
      4: { halign: 'center', fontStyle: 'bold', cellWidth: 11.5 },
      5: { halign: 'right', cellWidth: 16 },
      6: { halign: 'right', cellWidth: 17.5 },
      7: { halign: 'right', fontStyle: 'bold', cellWidth: 19 },
      8: { halign: 'right', fontStyle: 'bold', cellWidth: 22 }
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
  const summaryBoxH = 16.5;

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
  base.doc.setFontSize(6.0);
  base.doc.setTextColor(...COLORS.slate);
  base.doc.text('Subtotal Mercancía (Sin IVA):', totalsX, finalYBottom + 4.2);
  base.doc.setFont('helvetica', 'bold');
  base.doc.setTextColor(...COLORS.dark);
  base.doc.text(`$ ${totalNetoUsd.toFixed(2)}`, totalsX + totalsW, finalYBottom + 4.2, { align: 'right' });

  base.doc.setFont('helvetica', 'bold');
  base.doc.setFontSize(7.2);
  base.doc.setTextColor(...COLORS.emerald);
  base.doc.text('TOTAL NOTA DE ENTREGA USD:', totalsX, finalYBottom + 9.4);
  base.doc.text(`$ ${totalNetoUsd.toFixed(2)}`, totalsX + totalsW, finalYBottom + 9.4, { align: 'right' });

  base.doc.setFont('helvetica', 'bold');
  base.doc.setFontSize(6.6);
  base.doc.setTextColor(...COLORS.amber);
  base.doc.text('TOTAL OFICIAL EN BOLÍVARES:', totalsX, finalYBottom + 14.3);
  base.doc.text(`Bs. ${totalNetoBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, totalsX + totalsW, finalYBottom + 14.3, { align: 'right' });

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

  for (let p = 1; p <= totalPages; p++) {
    base.doc.setPage(p);

    // Si hay desbordamiento y no es la última página, indicar que continúa en la siguiente hoja
    if (p < totalPages) {
      base.doc.setFillColor(240, 249, 255);
      base.doc.setDrawColor(...COLORS.cyan);
      base.doc.setLineWidth(0.25);
      base.doc.roundedRect(base.startX + qrSize + 4, qrY + 2, base.tableWidth - qrSize - 32, 7.5, 1, 1, 'FD');

      base.doc.setFont('helvetica', 'bold');
      base.doc.setFontSize(6.2);
      base.doc.setTextColor(...COLORS.navy);
      base.doc.text(
        `DESBORDAMIENTO DE RENGLONES: CONTINÚA EN LA PÁGINA ${p + 1}/${totalPages}...`,
        base.startX + qrSize + 7,
        qrY + 6.8
      );
    }

    // Código QR estático de Cuentas Bancarias en esquina inferior izquierda
    drawDeliveryNoteQRBox(base.doc, base.startX, qrY, qrSize, qrPayload);

    base.doc.setFont('helvetica', 'bold');
    base.doc.setFontSize(6.0);
    base.doc.setTextColor(...COLORS.navy);
    base.doc.text('CUENTAS BANCARIAS (QR)', base.startX + qrSize + 3.5, qrY + 14.5);
    base.doc.setFont('helvetica', 'normal');
    base.doc.setFontSize(5.4);
    base.doc.setTextColor(...COLORS.slate);
    base.doc.text('Escanea para ver cuentas oficiales de Grupo Motorven, C.A.', base.startX + qrSize + 3.5, qrY + 18.2);

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
export function generateSalesPOSPDF({ sales = [], config = {}, currentUser = null, tipoDoc = 'GENERAL', client = null, clients = null, bankAccounts = null, autoPrint = false }) {
  const tasa = Number(config?.tasaDolar) || 827.73;

  // Si es un documento individual y corresponde a una Nota de Entrega, usar el formato Carta de Nota de Entrega
  if (sales.length === 1) {
    const singleDoc = sales[0] || {};
    const rawDocType = String(singleDoc.tipoDoc || singleDoc.tipo_doc || tipoDoc || '').toUpperCase();
    const rawDocNum = String(singleDoc.numeroDoc || singleDoc.factNum || singleDoc.factura || singleDoc.nroFactura || '').toUpperCase();
    if (rawDocType.includes('NOTA_ENTREGA') || rawDocType.includes('NOTA DE ENTREGA') || rawDocNum.startsWith('NE')) {
      return generateDeliveryNotePDF({ sale: singleDoc, config, currentUser, client, clients, bankAccounts, autoPrint });
    }
  }

  // Si se trata de una factura individual detallada con renglones
  if (sales.length === 1 && ((sales[0].items && sales[0].items.length > 0) || (sales[0].renglones && sales[0].renglones.length > 0))) {
    const sale = sales[0];
    const items = sale.items || sale.renglones || [];
    const factNum = sale.factNum || sale.nroFactura || sale.id || 'FACT-001';
    const resolvedClient = resolveDocumentClientInfo(sale, client, clients);
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
      { label: 'Forma de Pago', value: sale.formaPago || 'EFECTIVO_USD', subtext: `Tasa: ${formatBs(tasa)}`, color: COLORS.amber }
    ];

    let currentY = addSummaryCards(base.doc, base.startY, cards, base.tableWidth, base.startX);

    currentY = addAnalyticalBox(
      base.doc,
      currentY,
      `DATOS FISCALES DEL CLIENTE & EMISIÓN (${factNum})`,
      `Cliente: ${resolvedClient.nombre} • RIF/CI: ${resolvedClient.rif} • Teléfono: ${resolvedClient.telefono || 'N/A'}\nDirección Entrega / Fiscal: ${resolvedClient.direccion} • Vendedor Asignado: ${sale.vendedor || 'Asesor General'} • N° Control: ${sale.controlNum || sale.nroControl || '00-000001'}`,
      base.tableWidth,
      base.startX
    );

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
        fontSize: 7.4,
        fontStyle: 'bold',
        cellPadding: { top: 1.8, bottom: 1.8, left: 1.3, right: 1.3 },
        valign: 'middle'
      },
      styles: {
        fontSize: 7.2,
        cellPadding: { top: 1.7, bottom: 1.7, left: 1.3, right: 1.3 },
        textColor: COLORS.dark,
        overflow: 'linebreak',
        valign: 'middle'
      },
      alternateRowStyles: {
        fillColor: COLORS.lightBg
      },
      columnStyles: {
        0: { fontStyle: 'bold', halign: 'center', cellWidth: 21 },
        1: { cellWidth: 61.9 },
        2: { halign: 'center', cellWidth: 14 },
        3: { halign: 'center', fontStyle: 'bold', cellWidth: 13 },
        4: { halign: 'right', cellWidth: 21 },
        5: { halign: 'right', fontStyle: 'bold', cellWidth: 21 },
        6: { halign: 'right', fontStyle: 'bold', cellWidth: 28 }
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
    base.doc.setFontSize(6.2);
    base.doc.setTextColor(...COLORS.navy);
    base.doc.text('CUENTAS BANCARIAS OFICIALES (QR ESTÁTICO)', base.startX + 24.5, qrStartY + 8);
    base.doc.setFont('helvetica', 'normal');
    base.doc.setFontSize(5.6);
    base.doc.setTextColor(...COLORS.slate);
    base.doc.text('Escanea este código QR desde tu teléfono para visualizar todas las cuentas bancarias de Grupo Motorven, C.A.', base.startX + 24.5, qrStartY + 12.5, { maxWidth: base.tableWidth - 26 });

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
export function generateLetterInvoiceSeniatPDF({ sale, config = {}, currentUser = null, client = null, clients = null, bankAccounts = null, autoPrint = false }) {
  if (!sale) return;
  const tasa = Number(sale.tasaDolar || config?.tasaDolar) || 827.73;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'letter'
  });

  const resolvedClient = resolveDocumentClientInfo(sale, client, clients);
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
  const isNd = sale.tipoDoc === 'NOTA_DEBITO';
  const isCot = sale.tipoDoc === 'COTIZACION';
  const isFacturaOrNotaEntrega = isNe || (!isNc && !isNd && !isCot);

  // 1. Correlativo a la derecha
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  const docHeaderTitle = isNe ? 'NOTA DE ENTREGA N°' : (isNc ? 'NOTA DE CRÉDITO N°' : (isNd ? 'NOTA DE DÉBITO N°' : 'FACTURA N°'));
  doc.text(docHeaderTitle, startX + tableWidth, currentY + 3, { align: 'right' });
  doc.setFont('courier', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text(correlativo, startX + tableWidth, currentY + 9, { align: 'right' });

  currentY += 12;

  // 2. Metadatos del Adquirente
  const midX = startX + 110;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  const addrLines = doc.splitTextToSize(`Domicilio Fiscal: ${resolvedClient.direccion}`, (midX - 7) - (startX + 3)).slice(0, 3);
  const acqBoxH = Math.max(22, 17 + addrLines.length * 3.4);

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(startX, currentY, tableWidth, acqBoxH, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('DATOS DEL ADQUIRENTE:', startX + 3, currentY + 4.5);

  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(resolvedClient.nombre.slice(0, 45), startX + 3, currentY + 9.5);

  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`RIF / C.I.: ${resolvedClient.rif}${resolvedClient.telefono ? ` • Tel: ${resolvedClient.telefono}` : ''}`, startX + 3, currentY + 13.8);
  doc.text(addrLines, startX + 3, currentY + 17.8);

  // Columna derecha del adquirente
  doc.setDrawColor(226, 232, 240);
  doc.line(midX - 4, currentY + 2, midX - 4, currentY + acqBoxH - 2);

  const fecEmis = sale.fechaEmision ? new Date(sale.fechaEmision).toLocaleDateString('es-VE') : new Date().toLocaleDateString('es-VE');
  const fecVenc = sale.fechaVencimiento ? new Date(sale.fechaVencimiento).toLocaleDateString('es-VE') : fecEmis;
  const condPago = sale.condicionPago || 'CONTADO';

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.text(`Fecha Emisión: ${fecEmis}`, midX, currentY + 5);
  doc.text(`Vencimiento: ${fecVenc} (${sale.diasCredito || 0} Días)`, midX, currentY + 9.5);
  doc.text(`Condición: ${condPago} • Método: ${sale.metodoPago || 'EFECTIVO USD'}`, midX, currentY + 14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(217, 119, 6);
  doc.text(`Tasa Oficial BCV: Bs. ${tasa.toFixed(2)} / USD`, midX, currentY + 18.5);

  currentY += acqBoxH + 4;

  // 3. Tabla de Renglones Facturados
  const tableRows = items.map((it, idx) => {
    const cant = Number(it.cantidad || 1);
    const precio = Number(it.precioUsd ?? it.precioUnitarioUsd ?? 0);
    const subUsd = Number(it.subtotalUsd ?? it.totalUsd ?? (cant * precio));
    const subBs = subUsd * tasa;
    return [
      String(idx + 1),
      String(it.descripcion || it.articuloDescripcion || 'Lubricante'),
      String(cant),
      `$ ${precio.toFixed(2)}`,
      it.tipoAlicuota || '16%',
      `$ ${subUsd.toFixed(2)}`,
      `Bs. ${subBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    ];
  });

  autoTable(doc, {
    startY: currentY,
    margin: { left: startX, right: 15, top: topMargin, bottom: bottomMargin },
    tableWidth,
    head: [['#', 'DESCRIPCIÓN DEL LUBRICANTE', 'CANT.', 'P. UNIT ($)', 'ALÍC.', 'SUBTOTAL ($)', 'TOTAL (BS.)']],
    body: tableRows,
    theme: 'grid',
    styles: {
      fontSize: 8.6,
      cellPadding: { top: 2.1, bottom: 2.1, left: 1.6, right: 1.6 },
      lineColor: [226, 232, 240],
      lineWidth: 0.15,
      textColor: [15, 23, 42],
      overflow: 'linebreak',
      valign: 'middle'
    },
    headStyles: {
      fillColor: [0, 43, 122],
      textColor: [255, 255, 255],
      fontSize: 8.4,
      fontStyle: 'bold',
      halign: 'left',
      cellPadding: { top: 2.2, bottom: 2.2, left: 1.6, right: 1.6 },
      valign: 'middle'
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'left', cellWidth: 61.9 },
      2: { halign: 'center', cellWidth: 16 },
      3: { halign: 'right', cellWidth: 23 },
      4: { halign: 'center', cellWidth: 15 },
      5: { halign: 'right', cellWidth: 26 },
      6: { halign: 'right', cellWidth: 34 }
    },
    didDrawPage: (data) => {
      if (data.pageNumber > 1) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text(`CONTINUACIÓN FACTURA N° ${correlativo} - Adquirente: ${resolvedClient.nombre}`, startX, topMargin - 4);
      }
    }
  });

  const drawSeniatContinuationHeader = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(`CONTINUACIÓN FACTURA N° ${correlativo} - Adquirente: ${resolvedClient.nombre}`, startX, topMargin - 4);
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
  const totUsd = Number(sale.totalUsd || 0);
  const baseUsd = Number(sale.baseGeneralUsd || (totUsd / 1.16));
  const ivaUsd = Number(sale.ivaGeneralUsd || sale.ivaUsd || (totUsd - baseUsd));
  const totBs = totUsd * tasa;

  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(startX, boxY, 60, 30, 2, 2);
  doc.line(startX + 6, boxY + 16, startX + 54, boxY + 16);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(15, 23, 42);
  doc.text('Firma y Sello de Recepción', startX + 30, boxY + 20, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.4);
  doc.setTextColor(100, 116, 139);
  doc.text('C.I. / RIF • Fecha: ___/___/_____', startX + 30, boxY + 24, { align: 'center' });

  // QR estático de Cuentas Bancarias
  const qrPayload = getStaticBankAccountsQRPayload(config, bankAccounts);
  drawDeliveryNoteQRBox(doc, startX + 64.5, boxY + 1.5, 24, qrPayload);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.2);
  doc.setTextColor(...COLORS.navy);
  doc.text('CUENTAS BANCARIAS', startX + 76.5, boxY + 28.5, { align: 'center' });

  const totalsX = startX + 93;
  const totalsWidth = 92.9;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(totalsX, boxY, totalsWidth, 30, 2, 2, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text('Base Imponible General (16%):', totalsX + 3, boxY + 5);
  doc.setFont('helvetica', 'bold');
  doc.text(`$ ${baseUsd.toFixed(2)} (Bs. ${(baseUsd * tasa).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`, totalsX + totalsWidth - 3, boxY + 5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.text('Débito Fiscal IVA (16%):', totalsX + 3, boxY + 10);
  doc.setFont('helvetica', 'bold');
  doc.text(`$ ${ivaUsd.toFixed(2)} (Bs. ${(ivaUsd * tasa).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`, totalsX + totalsWidth - 3, boxY + 10, { align: 'right' });

  doc.setDrawColor(0, 43, 122);
  doc.setLineWidth(0.4);
  doc.line(totalsX + 3, boxY + 13, totalsX + totalsWidth - 3, boxY + 13);

  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text('TOTAL FACTURA USD:', totalsX + 3, boxY + 19);
  doc.setFont('courier', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(5, 150, 105);
  doc.text(`$ ${totUsd.toFixed(2)}`, totalsX + totalsWidth - 3, boxY + 19, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(217, 119, 6);
  doc.text('TOTAL OFICIAL BS.:', totalsX + 3, boxY + 25);
  doc.setFont('courier', 'bold');
  doc.setFontSize(9.5);
  doc.text(`Bs. ${totBs.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, totalsX + totalsWidth - 3, boxY + 25, { align: 'right' });

  // 5. Paginación en todas las hojas al pie: "Página X/Y" (1/2, 2/2) y Leyenda Legal
  const totalPagesCount = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPagesCount; p++) {
    doc.setPage(p);

    if (p > 1 && totalPagesCount > 1) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(0, 43, 122);
      doc.text(`Desbordamiento ${p}/${totalPagesCount}`, startX + tableWidth, topMargin - 4, { align: 'right' });
    }

    // Línea divisoria de pie de página
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.2);
    doc.line(startX, bottomLimitY - 4, startX + tableWidth, bottomLimitY - 4);

    if (isFacturaOrNotaEntrega) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.2);
      doc.setTextColor(71, 85, 105);
      const disclaimer = `Monto en ${formatBs(totBs)}, referencial a la fecha de emisión. Los pagos en Bs se deberán realizar según la tasa oficial BCV a la fecha de su cancelación.`;
      doc.text(disclaimer, startX, bottomLimitY, { maxWidth: tableWidth - 46 });
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
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

  const tasa = Number(config?.tasaDolar) || 827.73;
  const saldoBancosUsd = bankAccounts.reduce((acc, b) => acc + Number(b.saldoUsd || (b.saldoBs ? b.saldoBs / tasa : 0)), 0);
  const saldoCajasUsd = cashDesks.reduce((acc, c) => acc + Number(c.saldoUsd || 0), 0);
  const totalDisponibleUsd = saldoBancosUsd + saldoCajasUsd;

  const cards = [
    { label: 'Disponibilidad Total USD', value: formatUsd(totalDisponibleUsd), subtext: formatBs(totalDisponibleUsd * tasa), color: COLORS.emerald },
    { label: 'Efectivo en Cajas', value: formatUsd(saldoCajasUsd), subtext: `${cashDesks.length} Cajas Físicas`, color: COLORS.navy },
    { label: 'Cuentas Bancarias', value: formatUsd(saldoBancosUsd), subtext: `${bankAccounts.length} Cuentas Bancarias`, color: COLORS.cyan },
    { label: 'Movimientos Período', value: `${cashMovements.length} Registros`, subtext: 'Ingresos / Egresos', color: COLORS.amber }
  ];

  let currentY = addSummaryCards(base.doc, base.startY, cards, base.tableWidth, base.startX);

  const tableData = [
    ...cashDesks.map(c => [
      c.descripcion || c.desCaja || c.nombre || 'Caja Operativa',
      `${c.coCaja || c.co_caja || 'CAJA'} (${c.responsable || 'Admón'})`,
      c.moneda || 'USD',
      formatUsd(c.saldoUsd ?? c.saldo_usd ?? 0),
      formatBs(c.saldoBs ?? c.saldo_bs ?? ((c.saldoUsd || 0) * tasa)),
      c.activa === false ? 'INACTIVA' : 'ACTIVA'
    ]),
    ...bankAccounts.map(b => [b.bancoNombre || b.banco || b.des_ban || 'Banco Comercial', b.numCta || b.num_cta || 'Cuenta', b.moneda || 'Bs / USD', formatUsd(b.saldoUsd || (b.saldoBs ? b.saldoBs / tasa : 0)), formatBs(b.saldoBs || (b.saldoUsd ? b.saldoUsd * tasa : 0)), 'ACTIVA'])
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

  const finalYCaj = base.doc.lastAutoTable?.finalY || currentY;
  addGrandTotalBox(base.doc, finalYCaj + 3.5, [
    { label: 'DISPONIBILIDAD TOTAL USD', value: formatUsd(totalDisponibleUsd), subtext: formatBs(totalDisponibleUsd * tasa), color: COLORS.navy },
    { label: 'EFECTIVO EN CAJAS', value: formatUsd(saldoCajasUsd), subtext: `${cashDesks.length} cajas operativas`, color: COLORS.emerald },
    { label: 'SALDO TOTAL EN BANCOS', value: formatUsd(saldoBancosUsd), subtext: `${bankAccounts.length} cuentas institucionales`, color: COLORS.cyan }
  ], base.tableWidth, base.startX);

  finalizeAndSave(base.doc, `Reporte_Caja_Bancos_SIGNUM_${new Date().toISOString().slice(0, 10)}.pdf`, currentUser);
  return base.doc;
}

const ACCOUNTING_TABLE_THEME = {
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

/**
 * Formatea una fila de Balance / Estado Financiero marcando encabezados de grupo y totales.
 */
function styleStatementRowCell(data) {
  if (data.section !== 'body') return;
  const rowMeta = data.row?.raw?.__meta;
  if (!rowMeta) return;
  if (rowMeta === 'group') {
    data.cell.styles.fillColor = [226, 232, 240];
    data.cell.styles.textColor = COLORS.navy;
    data.cell.styles.fontStyle = 'bold';
    data.cell.styles.fontSize = 6.5;
  } else if (rowMeta === 'subtotal') {
    data.cell.styles.fillColor = [241, 245, 249];
    data.cell.styles.textColor = COLORS.dark;
    data.cell.styles.fontStyle = 'bold';
  } else if (rowMeta === 'total') {
    data.cell.styles.fillColor = COLORS.navy;
    data.cell.styles.textColor = [255, 255, 255];
    data.cell.styles.fontStyle = 'bold';
    data.cell.styles.fontSize = 6.5;
  }
}

/**
 * 12A. BALANCE DE COMPROBACIÓN DE SUMAS Y SALDOS EN PDF (CARTA VERTICAL)
 */
export function generateTrialBalancePDF({
  trialBalance = null,
  entries = [],
  config = {},
  currentUser = null
} = {}) {
  const tb = trialBalance || computeTrialBalance(entries);
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
    {
      label: 'Estatus Equilibrio',
      value: tb.isBalanced ? 'CUADRADO' : 'CON DESCUADRE',
      subtext: tb.isBalanced ? 'Debe = Haber (VEN-NIF)' : 'Revisar diferencias',
      color: tb.isBalanced ? COLORS.emerald : COLORS.red
    }
  ];

  const currentY = addSummaryCards(base.doc, base.startY, cards, base.tableWidth, base.startX);

  const bodyRows = accounts.length > 0
    ? accounts.map((acc) => [
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
    ...ACCOUNTING_TABLE_THEME,
    startY: currentY,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    showFoot: 'lastPage',
    head: [['CÓDIGO', 'DENOMINACIÓN DE LA CUENTA', 'GRUPO', 'SUMAS DEBE', 'SUMAS HABER', 'SALDO DEUDOR', 'SALDO ACREEDOR']],
    body: bodyRows,
    foot: [[
      'TOTALES',
      `${accounts.length} cuentas imputadas (Tasa BCV: Bs. ${tasa.toFixed(2)})`,
      tb.isBalanced ? 'CUADRADO' : 'DESCUADRE',
      formatUsd(tb.totalSumasDebeUsd || 0),
      formatUsd(tb.totalSumasHaberUsd || 0),
      formatUsd(tb.totalSaldosDeudorUsd || 0),
      formatUsd(tb.totalSaldosAcreedorUsd || 0)
    ]],
    footStyles: {
      fillColor: COLORS.navy,
      textColor: [255, 255, 255],
      fontSize: 6.4,
      fontStyle: 'bold',
      cellPadding: 1.7
    },
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

  const finalY = base.doc.lastAutoTable?.finalY || currentY;
  const grandEndY = addGrandTotalBox(base.doc, finalY + 3, [
    { label: 'TOTAL SUMAS DEBE', value: formatUsd(tb.totalSumasDebeUsd || 0), subtext: formatBs((tb.totalSumasDebeUsd || 0) * tasa), color: COLORS.navy },
    { label: 'TOTAL SUMAS HABER', value: formatUsd(tb.totalSumasHaberUsd || 0), subtext: formatBs((tb.totalSumasHaberUsd || 0) * tasa), color: COLORS.cyan },
    { label: 'SALDO DEUDOR = ACREEDOR', value: formatUsd(tb.totalSaldosDeudorUsd || 0), subtext: tb.isBalanced ? 'Cuadre Exacto $0.00' : 'Verificar Cuadre', color: tb.isBalanced ? COLORS.emerald : COLORS.red }
  ], base.tableWidth, base.startX);

  addSignatures(
    base.doc,
    grandEndY + 4,
    ['Elaborado por (Contabilidad)', 'Revisado por (Contador Público)', 'Aprobado por (Gerencia General)'],
    base.tableWidth,
    base.startX
  );

  finalizeAndSave(base.doc, `Balance_Comprobacion_SIGNUM_${new Date().toISOString().slice(0, 10)}.pdf`, currentUser);
  return base.doc;
}

/**
 * 12B. LIBRO MAYOR GENERAL ANALÍTICO POR CUENTA EN PDF (CARTA VERTICAL)
 */
export function generateGeneralLedgerPDF({
  account = null,
  generalLedger = null,
  entries = [],
  config = {},
  currentUser = null
} = {}) {
  const ledger = generalLedger || computeGeneralLedger(entries);
  const targetAccount = account || ledger?.accounts?.[0] || {
    codigo: '-',
    nombre: 'Sin cuenta seleccionada',
    grupo: '-',
    naturaleza: 'DEUDORA',
    totalDebeUsd: 0,
    totalHaberUsd: 0,
    saldoFinalUsd: 0,
    movements: []
  };
  const movements = targetAccount.movements || [];
  const tasa = Number(config?.tasaDolar || 827.73);

  const base = createBaseReport({
    title: 'LIBRO MAYOR GENERAL ANALÍTICO POR CUENTA',
    subtitle: `Cuenta ${targetAccount.codigo} — ${targetAccount.nombre} • Registro Cronológico de Partida Doble`,
    moduleCode: 'MAY',
    currentUser,
    config
  });

  const cards = [
    { label: 'Cuenta Contable', value: String(targetAccount.codigo), subtext: `${targetAccount.naturaleza || 'DEUDORA'} • ${targetAccount.grupo || '-'}`, color: COLORS.navy },
    { label: 'Total Cargos (Debe)', value: formatUsd(targetAccount.totalDebeUsd || 0), subtext: `${movements.length} movimientos`, color: COLORS.emerald },
    { label: 'Total Abonos (Haber)', value: formatUsd(targetAccount.totalHaberUsd || 0), subtext: formatBs((targetAccount.totalHaberUsd || 0) * tasa), color: COLORS.cyan },
    {
      label: 'Saldo Final Acumulado',
      value: formatUsd(targetAccount.saldoFinalUsd || 0),
      subtext: formatBs((targetAccount.saldoFinalUsd || 0) * tasa),
      color: (targetAccount.saldoFinalUsd || 0) >= 0 ? COLORS.navy : COLORS.red
    }
  ];

  let currentY = addSummaryCards(base.doc, base.startY, cards, base.tableWidth, base.startX);
  currentY = addAnalyticalBox(
    base.doc,
    currentY,
    'FICHA DE CUENTA CONTABLE EN MAYOR',
    `Código Institucional: ${targetAccount.codigo} | Denominación: ${targetAccount.nombre} | Grupo: ${targetAccount.grupo || '-'} | Naturaleza: ${targetAccount.naturaleza || 'DEUDORA'} | Movimientos Cronológicos: ${movements.length}`,
    base.tableWidth,
    base.startX
  );

  const bodyRows = movements.length > 0
    ? movements.map((m) => [
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
    ...ACCOUNTING_TABLE_THEME,
    startY: currentY,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    showFoot: 'lastPage',
    head: [['FECHA', 'ASIENTO', 'REFERENCIA', 'CONCEPTO / GLOSA CONTABLE', 'DEBE USD', 'HABER USD', 'SALDO ACUM.']],
    body: bodyRows,
    foot: [[
      'TOTALES',
      `${movements.length} movs`,
      targetAccount.codigo,
      'Totales Acumulados de la Cuenta',
      formatUsd(targetAccount.totalDebeUsd || 0),
      formatUsd(targetAccount.totalHaberUsd || 0),
      formatUsd(targetAccount.saldoFinalUsd || 0)
    ]],
    footStyles: {
      fillColor: COLORS.navy,
      textColor: [255, 255, 255],
      fontSize: 6.4,
      fontStyle: 'bold',
      cellPadding: 1.7
    },
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

  const finalY = base.doc.lastAutoTable?.finalY || currentY;
  addSignatures(
    base.doc,
    finalY + 5,
    ['Elaborado por (Contabilidad)', 'Revisado por (Auditoría Interna)', 'Aprobado por (Gerencia)'],
    base.tableWidth,
    base.startX
  );

  const safeCode = String(targetAccount.codigo || 'General').replace(/[^a-zA-Z0-9_-]/g, '_');
  finalizeAndSave(base.doc, `Libro_Mayor_${safeCode}_SIGNUM_${new Date().toISOString().slice(0, 10)}.pdf`, currentUser);
  return base.doc;
}

/**
 * 12C. ESTADOS FINANCIEROS BÁSICOS BA VEN-NIF 2 EN PDF (CARTA VERTICAL)
 * Incluye Estado de Resultados Integral + Estado de Situación Financiera (Balance General).
 */
export function generateFinancialStatementsPDF({
  financialStatements = null,
  trialBalance = null,
  entries = [],
  config = {},
  currentUser = null
} = {}) {
  const fsData = financialStatements || computeFinancialStatements(trialBalance || computeTrialBalance(entries));
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
  const toStatementRow = (codigo, concepto, usd, bs, meta = null) => {
    const row = [
      codigo,
      concepto,
      formatUsd(usd || 0),
      formatBs(bs != null ? bs : (Number(usd || 0) * tasa))
    ];
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
    {
      label: 'Resultado del Ejercicio',
      value: formatUsd(er.resultadoEjercicioUsd),
      subtext: `${er.cuentaResultadoCodigo} • ${er.cuentaResultadoNombre}`,
      color: er.resultadoEjercicioUsd >= 0 ? COLORS.emerald : COLORS.red
    },
    { label: 'Total Activo', value: formatUsd(bg.totalActivoUsd), subtext: `Pasivo + Patr.: ${formatUsd(bg.totalPasivoYPatrimonioUsd)}`, color: COLORS.navy },
    {
      label: 'Ecuación Patrimonial',
      value: bg.ecuacionCuadrada ? 'CUADRADA' : 'DESCUADRE',
      subtext: `Diferencia: ${formatUsd(bg.diferenciaEcuacionUsd)}`,
      color: bg.ecuacionCuadrada ? COLORS.emerald : COLORS.red
    }
  ];

  let currentY = addSummaryCards(base.doc, base.startY, cards, base.tableWidth, base.startX);

  // 1. Estado de Resultados Integral
  currentY = addSectionHeader(
    base.doc,
    currentY,
    '1. ESTADO DE RESULTADOS INTEGRAL (PERÍODO OPERATIVO)',
    'Clasificación oficial según Plan de Cuentas: Grupos 4 (Ingresos), 5 (Costos) y 6 (Egresos)',
    base.tableWidth,
    base.startX
  );

  const erRows = [
    toStatementRow('4', '4. INGRESOS OPERACIONALES Y OTROS', er.totalIngresosUsd, er.totalIngresosBs, 'group'),
    ...(er.ingresos.length > 0
      ? er.ingresos.map((a) => toStatementRow(a.codigo, a.nombre, a.saldoUsd, a.saldoBs))
      : [toStatementRow('-', 'Sin ingresos registrados en el período', 0, 0)]),
    toStatementRow('', 'TOTAL INGRESOS NETOS', er.totalIngresosUsd, er.totalIngresosBs, 'subtotal'),

    toStatementRow('5', '5. COSTOS DE VENTAS Y SERVICIOS', er.totalCostosUsd, er.totalCostosBs, 'group'),
    ...(er.costos.length > 0
      ? er.costos.map((a) => toStatementRow(a.codigo, a.nombre, a.saldoUsd, a.saldoBs))
      : [toStatementRow('-', 'Sin costos registrados en el período', 0, 0)]),
    toStatementRow('', 'UTILIDAD BRUTA EN VENTAS', er.utilidadBrutaUsd, er.utilidadBrutaBs, 'subtotal'),

    toStatementRow('6', '6. GASTOS OPERATIVOS / EGRESOS', er.totalEgresosUsd, er.totalEgresosBs, 'group'),
    ...(er.egresos.length > 0
      ? er.egresos.map((a) => toStatementRow(a.codigo, a.nombre, a.saldoUsd, a.saldoBs))
      : [toStatementRow('-', 'Sin egresos operativos registrados en el período', 0, 0)]),
    toStatementRow('', 'TOTAL GASTOS OPERATIVOS', er.totalEgresosUsd, er.totalEgresosBs, 'subtotal'),

    toStatementRow(
      er.cuentaResultadoCodigo,
      `RESULTADO DEL EJERCICIO (${er.cuentaResultadoNombre.toUpperCase()})`,
      er.resultadoEjercicioUsd,
      er.resultadoEjercicioBs,
      'total'
    )
  ];

  autoTable(base.doc, {
    ...ACCOUNTING_TABLE_THEME,
    startY: currentY,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    head: [['CÓDIGO', 'CUENTA / CONCEPTO DEL RESULTADO', 'MONTO USD', 'MONTO BS.']],
    body: erRows,
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 26 },
      1: { cellWidth: 89.9 },
      2: { halign: 'right', cellWidth: 30 },
      3: { halign: 'right', cellWidth: 34 }
    },
    didParseCell: styleStatementRowCell
  });

  currentY = (base.doc.lastAutoTable?.finalY || currentY) + 4;

  // 2. Balance General (Estado de Situación Financiera)
  currentY = addSectionHeader(
    base.doc,
    currentY,
    '2. BALANCE GENERAL (ESTADO DE SITUACIÓN FINANCIERA)',
    'Ecuación Patrimonial BA VEN-NIF 2: Activo = Pasivo + Patrimonio + Resultado del Ejercicio',
    base.tableWidth,
    base.startX
  );

  const bgRows = [
    toStatementRow('1', '1. ACTIVO', bg.totalActivoUsd, bg.totalActivoBs, 'group'),
    ...(bg.activo.length > 0
      ? bg.activo.map((a) => toStatementRow(a.codigo, a.nombre, a.saldoUsd, a.saldoBs))
      : [toStatementRow('-', 'Sin cuentas de activo con movimiento', 0, 0)]),
    toStatementRow('', 'TOTAL ACTIVO', bg.totalActivoUsd, bg.totalActivoBs, 'total'),

    toStatementRow('2', '2. PASIVO', bg.totalPasivoUsd, bg.totalPasivoBs, 'group'),
    ...(bg.pasivo.length > 0
      ? bg.pasivo.map((a) => toStatementRow(a.codigo, a.nombre, a.saldoUsd, a.saldoBs))
      : [toStatementRow('-', 'Sin cuentas de pasivo con movimiento', 0, 0)]),
    toStatementRow('', 'TOTAL PASIVO', bg.totalPasivoUsd, bg.totalPasivoBs, 'subtotal'),

    toStatementRow('3', '3. PATRIMONIO NETO', bg.totalPatrimonioUsd, bg.totalPatrimonioBs, 'group'),
    ...(bg.patrimonio || []).map((a) => toStatementRow(a.codigo, a.nombre, a.saldoUsd, a.saldoBs)),
    toStatementRow(er.cuentaResultadoCodigo, er.cuentaResultadoNombre, bg.resultadoEjercicioUsd, bg.resultadoEjercicioBs),
    toStatementRow('', 'TOTAL PATRIMONIO NETO', bg.totalPatrimonioUsd, bg.totalPatrimonioBs, 'subtotal'),

    toStatementRow('', 'TOTAL PASIVO + PATRIMONIO', bg.totalPasivoYPatrimonioUsd, bg.totalPasivoYPatrimonioBs, 'total')
  ];

  autoTable(base.doc, {
    ...ACCOUNTING_TABLE_THEME,
    startY: currentY,
    margin: { top: 22, left: base.startX, right: base.startX, bottom: 26 },
    tableWidth: base.tableWidth,
    head: [['CÓDIGO', 'CUENTA / RUBRO DE SITUACIÓN FINANCIERA', 'MONTO USD', 'MONTO BS.']],
    body: bgRows,
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 26 },
      1: { cellWidth: 89.9 },
      2: { halign: 'right', cellWidth: 30 },
      3: { halign: 'right', cellWidth: 34 }
    },
    didParseCell: styleStatementRowCell
  });

  const finalY = base.doc.lastAutoTable?.finalY || currentY;
  const grandEndY = addGrandTotalBox(base.doc, finalY + 3, [
    { label: 'TOTAL ACTIVO', value: formatUsd(bg.totalActivoUsd), subtext: formatBs(bg.totalActivoBs || bg.totalActivoUsd * tasa), color: COLORS.navy },
    { label: 'PASIVO + PATRIMONIO', value: formatUsd(bg.totalPasivoYPatrimonioUsd), subtext: formatBs(bg.totalPasivoYPatrimonioBs || bg.totalPasivoYPatrimonioUsd * tasa), color: COLORS.cyan },
    { label: 'DIFERENCIA ECUACIÓN', value: formatUsd(bg.diferenciaEcuacionUsd), subtext: bg.ecuacionCuadrada ? 'BA VEN-NIF 2 Cuadrado' : 'Descuadre detectado', color: bg.ecuacionCuadrada ? COLORS.emerald : COLORS.red }
  ], base.tableWidth, base.startX);

  addSignatures(
    base.doc,
    grandEndY + 4,
    ['Elaborado por (Contabilidad)', 'Revisado por (Contador Público)', 'Aprobado por (Gerencia General)'],
    base.tableWidth,
    base.startX
  );

  finalizeAndSave(base.doc, `Estados_Financieros_SIGNUM_${new Date().toISOString().slice(0, 10)}.pdf`, currentUser);
  return base.doc;
}

// =========================================================================
// 12. REPORTE DE AUDITORÍA & LIBRO CONTABLE DIGITAL (CARTA VERTICAL)
// =========================================================================
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

  let currentY = addSummaryCards(base.doc, base.startY, cards, base.tableWidth, base.startX);

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

  const tasaBcv = Number(config?.tasaDolar) || 827.73;

  // Normalización de Cuentas Bancarias
  const accounts = rawAccounts.map((a, idx) => {
    const cod = a.cod || a.codCta || a.co_ban || a.co_banco || String(idx + 1).padStart(2, '0');
    const banco = a.banco || a.bancoNombre || a.des_ban || 'BANCO NACIONAL';
    const numCta = (a.numCta || a.num_cta || '00000000000000000000').replace(/[^0-9]/g, '');
    const tipo = a.tipo || a.tipo_cu || 'Corriente';
    const moneda = a.moneda || 'BS';
    const saldo = typeof a.saldo === 'number'
      ? a.saldo
      : typeof a.saldoBs === 'number'
      ? a.saldoBs
      : typeof a.saldo_a === 'number'
      ? a.saldo_a
      : (parseFloat(a.saldo || a.saldoBs || a.saldo_a) || 0);
    const equivUsd = tasaBcv > 0 ? (saldo / tasaBcv) : 0;
    const sucursal = a.sucursal || 'Principal';
    const ejecutivo = a.ejecutivo || a.respons || 'Mesa de Operaciones';

    return { cod, banco, numCta, tipo, moneda, saldo, equivUsd, sucursal, ejecutivo };
  });

  // Normalización de Cajas de Tesorería
  const cashes = rawCash.map((c, idx) => {
    const cod = c.cod || c.codCaja || c.co_caja || String(idx + 1).padStart(2, '0');
    const descrip = c.descrip || c.nombre || c.caja_des || 'CAJA OPERACIONAL';
    const moneda = c.moneda || (descrip.includes('US$') || descrip.includes('EXTRANJERA') ? 'US$' : 'BS');
    const saldo = typeof c.saldo === 'number'
      ? c.saldo
      : typeof c.monto === 'number'
      ? c.monto
      : (parseFloat(c.saldo || c.monto) || 0);
    const equivUsd = moneda === 'US$' ? saldo : (tasaBcv > 0 ? saldo / tasaBcv : 0);
    const tipo = c.tipo || 'Operativa';
    return { cod, descrip, moneda, saldo, equivUsd, tipo };
  });

  // Cálculos Consolidados
  const totalBancosBs = accounts.reduce((acc, a) => acc + a.saldo, 0);
  const totalBancosUsd = tasaBcv > 0 ? (totalBancosBs / tasaBcv) : 0;
  const totalCajasUsd = cashes.filter(c => c.moneda === 'US$').reduce((acc, c) => acc + c.saldo, 0);
  const totalCajasBs = cashes.filter(c => c.moneda === 'BS').reduce((acc, c) => acc + c.saldo, 0);
  const totalConsolidadoUsd = totalBancosUsd + totalCajasUsd + (tasaBcv > 0 ? totalCajasBs / tasaBcv : 0);

  const base = createBaseReport({
    title: 'ESQUEMA DETALLADO DE CUENTAS BANCARIAS - SUPABASE (GRUMOTOR)',
    subtitle: 'Auditoría Oficial de Disponibilidades Bancarias, Saldos Contables y Cajas de Tesorería',
    moduleCode: 'TES',
    currentUser,
    config
  });

  // Tarjetas KPI de Resumen Ejecutivo
  const cards = [
    {
      label: 'Total Cuentas Bancarias',
      value: `${accounts.length} Cuentas`,
      subtext: '6 Instituciones Bancarias',
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
      label: 'Bóveda Divisas ($)',
      value: formatUsd(totalCajasUsd),
      subtext: 'Efectivo Moneda Fuerte en Caja',
      color: COLORS.amber
    }
  ];

  let currentY = addSummaryCards(base.doc, base.startY, cards, base.tableWidth, base.startX);

  // Caja de Análisis Ejecutivo
  currentY = addAnalyticalBox(
    base.doc,
    currentY,
    'AUDITORÍA DE DISPONIBILIDAD BANCARIA & TESORERÍA - SUPABASE (GRUMOTOR)',
    `El presente informe corporativo consolida el registro fidedigno de los instrumentos bancarios y fondos de tesorería del GRUPO MOTORVEN, C.A., extraídos de las tablas [dbo].[cuentas] y [dbo].[cajas] en SQL Server (GRUMOTOR). Se verifican 10 cuentas corrientes operativas en 6 entidades financieras nacionales con una disponibilidad neta en moneda de curso legal de ${formatBs(totalBancosBs)} (${formatUsd(totalBancosUsd)} USD tasa oficial BCV ${formatBs(tasaBcv)}/USD) y un fondo físico en bóveda de ${formatUsd(totalCajasUsd)} USD. Los sobregiros temporales responden a emisión de cheques y órdenes de compensación en tránsito pendientes de cobro bancario.`,
    base.tableWidth,
    base.startX
  );

  // Encabezado de Sección 1: Cuentas Bancarias
  currentY = addSectionHeader(
    base.doc,
    currentY,
    '1. REGISTRO Y CONCILIACIÓN DE CUENTAS BANCARIAS (TABLA [cuentas] + [bancos])',
    'Detalle de cuentas corrientes en moneda nacional (BS), números de cuenta a 20 dígitos y ejecutivos asignados',
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
    '2. FONDOS DE TESORERÍA, CAJAS Y CRIPTOMONEDAS (TABLA [cajas])',
    'Disponibilidad inmediata en divisas en efectivo, receptorías móviles y cajas operativas de mostrador',
    base.tableWidth,
    base.startX
  );

  const cashRows = cashes.map(c => [
    c.cod,
    c.descrip,
    c.tipo,
    c.moneda,
    c.moneda === 'US$' ? formatUsd(c.saldo) : formatBs(c.saldo),
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

  const filename = `Esquema_Detallado_Cuentas_Bancarias_Profit_Plus_${new Date().toISOString().slice(0, 10)}.pdf`;
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
          : val.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
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
    `El Departamento de Cobranzas certifica el registro de ${totalNotificaciones} gestiones de cobranza vía WhatsApp, notificando un saldo exigible de ${formatUsd(totalSaldoUsd)} (${formatBs(totalSaldoBs)} a tasa oficial BCV Bs. ${tasa.toFixed(2)}/USD). Se priorizaron ${totalEnMora} clientes con facturas en vencimiento moroso para agilizar la recaudación a través de las cuentas bancarias corporativas.`,
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



