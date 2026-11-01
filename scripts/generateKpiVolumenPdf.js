import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function generateKpiVolumenPdf() {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const primaryColor = [2, 132, 199]; // #0284c7 Motorven Cyan / Blue
  const navyColor = [0, 43, 122];     // #002b7a Motorven Navy
  const darkTextColor = [15, 23, 42]; // #0f172a Slate 900
  const mutedTextColor = [100, 116, 139]; // #64748b Slate 500
  const emeraldColor = [16, 185, 129]; // #10b981
  const goldColor = [245, 158, 11]; // #f59e0b

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 15;
  const contentWidth = pageWidth - (marginX * 2);

  // Helper Header
  const renderHeader = (pageNum, totalPages) => {
    // Barra superior decorativa
    doc.setFillColor(...navyColor);
    doc.rect(0, 0, pageWidth, 5, 'F');
    doc.setFillColor(...primaryColor);
    doc.rect(0, 5, pageWidth, 1.5, 'F');

    // Membrete Superior
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...navyColor);
    doc.text('SIGNUM MOTORVEN S.A. • LUBRICANTES OILSTONE ®', marginX, 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...mutedTextColor);
    doc.text('DIVISIÓN DE AUDITORÍA DE DATOS, INGENIERÍA & CONTROL DE INVENTARIOS', marginX, 18);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('DOCUMENTO TÉCNICO OFICIAL', pageWidth - marginX, 14, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...mutedTextColor);
    doc.text(`Ref: FT-KPI-INV-2026-001 • Fecha: ${new Date().toLocaleDateString('es-VE')}`, pageWidth - marginX, 18, { align: 'right' });

    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(marginX, 21, pageWidth - marginX, 21);
  };

  // Helper Footer
  const renderFooter = (pageNum, totalPages) => {
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.4);
    doc.line(marginX, pageHeight - 14, pageWidth - marginX, pageHeight - 14);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...mutedTextColor);
    doc.text('Signum Motorven Cloud • Sincronización Profit Plus 2K8 (SQL Server) ↔ Supabase', marginX, pageHeight - 9);
    doc.text(`Página ${pageNum} de ${totalPages} • Documento Certificado`, pageWidth - marginX, pageHeight - 9, { align: 'right' });

    // Barra inferior decorativa
    doc.setFillColor(...navyColor);
    doc.rect(0, pageHeight - 3, pageWidth, 3, 'F');
  };

  // Título del Reporte
  let currentY = 27;

  doc.setFillColor(241, 245, 249);
  doc.roundedRect(marginX, currentY, contentWidth, 20, 3, 3, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(marginX, currentY, contentWidth, 20, 3, 3, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...navyColor);
  doc.text('FICHA TÉCNICA Y AUDITORÍA DE KPI: "VOLUMEN EN BODEGA"', marginX + 6, currentY + 8);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...darkTextColor);
  doc.text('Interpretación algorítmica, trazabilidad de datos en bases de datos y cálculo volumétrico de lubricantes.', marginX + 6, currentY + 14);

  currentY += 25;

  // =========================================================================
  // SECCIÓN 1: DEFINICIÓN Y FÓRMULA MATEMÁTICA
  // =========================================================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...primaryColor);
  doc.text('1. LA FÓRMULA MATEMÁTICA EXACTA', marginX, currentY);
  currentY += 4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.2);
  doc.setTextColor(...darkTextColor);
  const introTxt = 'En el código fuente (src/views/InventoryView.jsx), la métrica se calcula dinámicamente mediante un acumulador lineal sobre los 47 productos activos del catálogo de lubricantes:';
  doc.text(doc.splitTextToSize(introTxt, contentWidth), marginX, currentY);
  currentY += 8;

  // Caja de Fórmula Matemática
  doc.setFillColor(238, 242, 255); // Indigo light
  doc.roundedRect(marginX, currentY, contentWidth, 14, 2, 2, 'F');
  doc.setDrawColor(199, 210, 254);
  doc.roundedRect(marginX, currentY, contentWidth, 14, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(30, 58, 138);
  doc.text('Volumen en Bodega (L) = Σ  ( Stock Físico [i]  ×  Litros por Unidad [i] )   [i = 1 hasta 47]', marginX + contentWidth / 2, currentY + 9, { align: 'center' });
  currentY += 18;

  // Caja de Código React
  doc.setFillColor(15, 23, 42); // Slate 900
  doc.roundedRect(marginX, currentY, contentWidth, 23, 2, 2, 'F');

  doc.setFont('courier', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(56, 189, 248);
  doc.text('// src/views/InventoryView.jsx (Línea 104 y Línea 529)', marginX + 6, currentY + 6);

  doc.setTextColor(248, 250, 252);
  doc.text('const totalLitros = products.reduce((acc, p) =>', marginX + 6, currentY + 11);
  doc.text('  acc + ((Number(p.stock) || 0) * (Number(p.litrosPorUnidad) || 1)), 0', marginX + 10, currentY + 15);
  doc.text('); // Renderizado: {inventoryKpis.totalLitros.toLocaleString(\'es-VE\')} L', marginX + 6, currentY + 19);

  currentY += 28;

  // =========================================================================
  // SECCIÓN 2: ORIGEN Y EXTRACCIÓN DE DATOS
  // =========================================================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...primaryColor);
  doc.text('2. EXTRACCIÓN Y MAPEO BIDIRECCIONAL DE DATOS', marginX, currentY);
  currentY += 3;

  autoTable(doc, {
    startY: currentY,
    head: [['Variable', 'Origen Profit Plus 2K8 (SQL Server)', 'Origen Supabase (DB Cloud)', 'Significado Operativo']],
    body: [
      [
        'p.stock',
        'Tabla [art] -> Columna [stock_act]\n(o desglose por almacén en [st_almac])',
        'Tabla [products] -> Columna [stock]\n(tipo numeric)',
        'Cantidad física real de unidades o empaques existentes en almacén (ej: 197 cajas).'
      ],
      [
        'p.litrosPorUnidad',
        'Tabla [art] -> Columna [uni_venta]\n+ análisis semántico de descripción',
        'Tabla [products] -> [litros_por_unidad]\n(tipo numeric)',
        'Factor multiplicador exacto según la presentación del lubricante (ej: 11.35 L por caja).'
      ]
    ],
    theme: 'grid',
    styles: {
      fontSize: 7.8,
      cellPadding: 3,
      textColor: darkTextColor,
      lineColor: [226, 232, 240],
      lineWidth: 0.3
    },
    headStyles: {
      fillColor: navyColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { cellWidth: 26, fontStyle: 'bold', textColor: primaryColor },
      1: { cellWidth: 54 },
      2: { cellWidth: 48 },
      3: { cellWidth: 51.8 }
    },
    margin: { left: marginX, right: marginX }
  });

  currentY = doc.lastAutoTable.finalY + 7;

  // =========================================================================
  // SECCIÓN 3: FACTORES DE CONVERSIÓN POR EMPAQUE
  // =========================================================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...primaryColor);
  doc.text('3. FACTORES OFICIALES DE CONVERSIÓN POR PRESENTACIÓN', marginX, currentY);
  currentY += 3;

  autoTable(doc, {
    startY: currentY,
    head: [['Presentación / Empaque', 'Factor Multiplicador', 'Equivalencia Internacional y Técnica']],
    body: [
      ['Caja 12 x 1 Litro (12 x 946 ml)', 'x 11.35 Litros', 'Estándar internacional de 3 galones / 12 cuartos de galón (US Quarts)'],
      ['Cuñete / Paila (5 Galones)', 'x 19.00 Litros', '5 galones americanos exactos de lubricante pesado o hidráulico'],
      ['Tambor Industrial (55 Galones)', 'x 208.00 Litros', 'Tambor metálico industrial estandarizado internacional (55 US Gallons)'],
      ['Tótem / Contenedor IBC', 'x 1,000.00 Litros', 'Contenedor cúbico para despacho a granel e industrial'],
      ['Litro Suelto / Botella individual', 'x 1.00 Litro', 'Unidad unitaria directa para reposición y mostrador']
    ],
    theme: 'striped',
    styles: {
      fontSize: 7.8,
      cellPadding: 2.8,
      textColor: darkTextColor,
      lineColor: [226, 232, 240],
      lineWidth: 0.3
    },
    headStyles: {
      fillColor: [30, 41, 59], // Slate 800
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { cellWidth: 58, fontStyle: 'bold' },
      1: { cellWidth: 38, fontStyle: 'bold', textColor: primaryColor, halign: 'center' },
      2: { cellWidth: 83.8 }
    },
    margin: { left: marginX, right: marginX }
  });

  currentY = doc.lastAutoTable.finalY + 8;

  // =========================================================================
  // SECCIÓN 4: DESGLOSE EN VIVO Y TOP 5 DE PRODUCTOS
  // =========================================================================
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...primaryColor);
  doc.text('4. CONSOLIDADO EN VIVO Y TOP 5 EN VOLUMEN DISPONIBLE', marginX, currentY);
  currentY += 4;

  // 2 Tarjetas KPI en fila
  const cardW = (contentWidth - 6) / 2;
  
  // Tarjeta 1: Cajas
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(marginX, currentY, cardW, 16, 2, 2, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(marginX, currentY, cardW, 16, 2, 2, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(...mutedTextColor);
  doc.text('TOTAL UNIDADES FÍSICAS EN BODEGA', marginX + 6, currentY + 6);
  doc.setFontSize(13);
  doc.setTextColor(...darkTextColor);
  doc.text('2.962 Cajas / Empaques', marginX + 6, currentY + 13);

  // Tarjeta 2: Litros
  doc.setFillColor(240, 253, 244); // Green light
  doc.roundedRect(marginX + cardW + 6, currentY, cardW, 16, 2, 2, 'F');
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(marginX + cardW + 6, currentY, cardW, 16, 2, 2, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(22, 101, 52);
  doc.text('VOLUMEN NETO EN BODEGA (KPI)', marginX + cardW + 12, currentY + 6);
  doc.setFontSize(13);
  doc.setTextColor(21, 128, 61);
  doc.text('21.043,6 Litros Líquidos', marginX + cardW + 12, currentY + 13);

  currentY += 21;

  autoTable(doc, {
    startY: currentY,
    head: [['Código SKU', 'Descripción del Lubricante', 'Stock Físico', 'Litros / Empaque', 'Volumen Aportado']],
    body: [
      ['001208', 'Oilstone SAE 15W-40 API SL (Caja)', '197 cajas', '11.35 L', '2.235,9 L'],
      ['001201', 'Oilstone SAE 15W-40 Semisintético (Caja)', '163 cajas', '11.35 L', '1.850,0 L'],
      ['100102', 'Oilstone SAE 20W-50 API SL (Caja)', '156 cajas', '11.35 L', '1.770,6 L'],
      ['OIL-20W50-GAS', 'Oilstone SAE 20W-50 Gasolina Alto Rendimiento', '145 cajas', '11.35 L', '1.645,8 L'],
      ['100202', 'Oilstone SAE 25W-60 API SL Alto Kilometraje', '135 cajas', '11.35 L', '1.532,3 L']
    ],
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2.8,
      textColor: darkTextColor,
      lineColor: [226, 232, 240],
      lineWidth: 0.3
    },
    headStyles: {
      fillColor: navyColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold'
    },
    columnStyles: {
      0: { cellWidth: 28, fontStyle: 'bold', textColor: primaryColor },
      1: { cellWidth: 77.8 },
      2: { cellWidth: 26, halign: 'center' },
      3: { cellWidth: 24, halign: 'center' },
      4: { cellWidth: 24, halign: 'right', fontStyle: 'bold', textColor: [21, 128, 61] }
    },
    margin: { left: marginX, right: marginX }
  });

  currentY = doc.lastAutoTable.finalY + 6;

  // =========================================================================
  // SECCIÓN 5: RESUMEN Y DICTAMEN DE AUDITORÍA
  // =========================================================================
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(marginX, currentY, contentWidth, 18, 2, 2, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(marginX, currentY, contentWidth, 18, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(...navyColor);
  doc.text('5. RESUMEN Y DICTAMEN DE AUDITORÍA OPERACIONAL', marginX + 5, currentY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...darkTextColor);
  const conclusionTxt = 'El monto de "Volumen en Bodega" consolida la disponibilidad volumétrica total lista para despacho comercial. Permite a la Dirección, Ventas y Logística conocer la autonomía de suministro en litros, independientemente de la heterogeneidad de los envases (cajas, pailas o tambores), garantizando una correlación 1:1 entre los registros fiscales de Profit Plus y la base de datos cloud Supabase.';
  doc.text(doc.splitTextToSize(conclusionTxt, contentWidth - 10), marginX + 5, currentY + 10);

  currentY += 23;

  // =========================================================================
  // BLOQUE DE FIRMAS
  // =========================================================================
  const sigBoxW = (contentWidth - 10) / 3;
  const sigY = currentY;

  // Firma 1: Auditoría de Sistemas
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.4);
  doc.line(marginX + 5, sigY + 12, marginX + sigBoxW - 5, sigY + 12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(...darkTextColor);
  doc.text('ING. EDSON DESIGNER', marginX + sigBoxW / 2, sigY + 16, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...mutedTextColor);
  doc.text('Auditoría de Sistemas & TI', marginX + sigBoxW / 2, sigY + 19, { align: 'center' });

  // Firma 2: Jefe de Almacén
  const sig2X = marginX + sigBoxW + 5;
  doc.line(sig2X + 5, sigY + 12, sig2X + sigBoxW - 5, sigY + 12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(...darkTextColor);
  doc.text('JEFE DE ALMACÉN & LOGÍSTICA', sig2X + sigBoxW / 2, sigY + 16, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...mutedTextColor);
  doc.text('Custodia Física de Bodega', sig2X + sigBoxW / 2, sigY + 19, { align: 'center' });

  // Firma 3: Gerencia de Operaciones
  const sig3X = marginX + (sigBoxW * 2) + 10;
  doc.line(sig3X + 5, sigY + 12, sig3X + sigBoxW - 5, sigY + 12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(...darkTextColor);
  doc.text('GERENCIA DE OPERACIONES', sig3X + sigBoxW / 2, sigY + 16, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(...mutedTextColor);
  doc.text('Signum Motorven S.A.', sig3X + sigBoxW / 2, sigY + 19, { align: 'center' });

  // Renderizar Headers y Footers en todas las páginas
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    renderHeader(i, totalPages);
    renderFooter(i, totalPages);
  }

  return doc;
}

// Generar y Guardar
const doc = generateKpiVolumenPdf();
const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

// Rutas de guardado
const pathsToSave = [
  path.join(__dirname, '..', 'public', 'Ficha_Tecnica_KPI_Volumen_en_Bodega.pdf'),
  path.join(__dirname, '..', 'dist', 'Ficha_Tecnica_KPI_Volumen_en_Bodega.pdf'),
  path.join('C:', 'Users', 'edson', '.gemini', 'antigravity', 'brain', '30fd449b-98f4-44cf-ab64-1400939d3758', 'Ficha_Tecnica_KPI_Volumen_en_Bodega.pdf')
];

pathsToSave.forEach(targetPath => {
  try {
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(targetPath, pdfBuffer);
    console.log(`[PDF Generado con éxito]: ${targetPath} (${pdfBuffer.length} bytes)`);
  } catch (err) {
    console.warn(`[Aviso al guardar en ${targetPath}]:`, err.message);
  }
});
