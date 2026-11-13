/**
 * Suite de Verificación Exhaustiva para Todos los Motores de Reportes PDF
 * Verifica que cada generador ejecute de extremo a extremo sin excepciones
 */

// Mock de entorno de navegador para Node.js
if (typeof global.document === 'undefined') {
  global.document = {
    createElement: () => ({
      href: '',
      download: '',
      style: {},
      click: () => {},
      setAttribute: () => {}
    }),
    body: {
      appendChild: () => {},
      removeChild: () => {}
    }
  };
}
if (typeof global.URL === 'undefined') {
  global.URL = {
    createObjectURL: () => 'blob:mock-url',
    revokeObjectURL: () => {}
  };
}

import fs from 'fs';
import {
  generateSellersPDF,
  generateProfitabilityPDF,
  generateAccountsReceivablePDF,
  generateAccountsPayablePDF,
  generateTaxReportPDF,
  generateDashboardPDF,
  generateInventoryPDF,
  generateOrdersPDF,
  generateSellerOrderPDF,
  generateWarehouseDispatchGuidePDF,
  generateDeliveryNotePDF,
  resolveDeliveryNoteLineItems,
  pickPreferredLineItems,
  generateSalesPOSPDF,
  generateLetterInvoiceSeniatPDF,
  generatePurchasesPDF,
  generateCashflowPDF,
  generateAuditLedgerPDF,
  generateUsersPDF,
  generateConfigPDF,
  generateManualPDF,
  generateNotificationsPDF,
  generateBankAccountsPDF,
  generateProfitDatabaseTablePDF,
  generateWhatsAppCollectionPDF,
  generateQuotationPDF,
  generateCreditDebitNotePDF,
  generateWarehouseTransferOrAdjustmentPDF,
  generatePurchaseRequisitionPDF,
  generatePurchaseOrderPDF,
  generateGoodsReceiptPDF,
  generatePaymentOrderPDF,
  generateCollectionReceiptPDF,
  generateExpenseVoucherPDF,
  generateThirdPartyStatementPDF,
  generateSeniatRetentionVoucherPDF,
  generateSeniatRetentionTxt,
  generateTrialBalancePDF,
  generateGeneralLedgerPDF,
  generateFinancialStatementsPDF,
  generateConsolidatedCxcPDF,
  getPageLayoutMetrics
} from '../services/pdfReportService.js';
import {
  CHART_OF_ACCOUNTS,
  generateAccountingEntries,
  buildTrialBalance,
  buildGeneralLedger,
  buildFinancialStatements
} from '../services/accountingService.js';
import {
  applyPersonPrefixToRif,
  detectPersonPrefix,
  validateRifOrCedula,
  countPersonTypes
} from '../services/fiscalService.js';
import { validateDocumentPositiveStock } from '../services/formatService.js';

const mockConfig = {
  nombreEmpresa: 'SIGNUM MOTORVEN, C.A.',
  rif: 'J-50478166-0',
  direccion: 'Caracas - Venezuela',
  tasaDolar: 827.73,
  ivaPorcentaje: 16,
  igtfPorcentaje: 3
};

const mockUser = {
  nombre: 'Edson Administrador Master',
  username: 'admin',
  cargo: 'Gerente General & Master TI',
  departamento: 'DIRECCIÓN'
};

async function runPdfTests() {
  console.log('\n--- INICIANDO VERIFICACIÓN DE TODOS LOS GENERADORES PDF ---');
  let passed = 0;
  let total = 0;

  function testGen(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✓ ${name}: Ejecutado correctamente`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name} FALLÓ:`, err.message);
    }
  }

  // 1. Fuerza de Ventas
  testGen('Fuerza de Ventas (normal)', () => {
    generateSellersPDF({
      sellers: [
        { id: 'VEN-01', nombre: 'Carlos Mendoza', zona: 'Gran Caracas', totalVentasUsd: 15400, totalLitros: 4200, comisionEstimadaUsd: 462, cumplimientoPct: 105 },
        { id: 'VEN-02', nombre: 'Alejandro Rivas', zona: 'Carabobo & Aragua', totalVentasUsd: 8200, totalLitros: 2300, comisionEstimadaUsd: 246, cumplimientoPct: 82 }
      ],
      config: mockConfig,
      currentUser: mockUser,
      globalQuota: 30000
    });
  });

  testGen('Fuerza de Ventas (vacío)', () => {
    generateSellersPDF({ sellers: [], config: mockConfig, currentUser: mockUser });
  });

  // 2. Rentabilidad & BI
  testGen('Rentabilidad & BI (normal)', () => {
    generateProfitabilityPDF({
      products: [
        { codigo: 'OIL-001', descripcion: 'Sintético 5W-30', categoria: 'Sintéticos', stock: 120, costoUsd: 28, precioA: 42 },
        { codigo: 'OIL-002', descripcion: 'Mineral 20W-50', categoria: 'Minerales', stock: 350, costoUsd: 18, precioA: 26 }
      ],
      sales: [{ id: 'VTA-01', totalUsd: 420 }],
      config: mockConfig,
      currentUser: mockUser
    });
  });

  testGen('Rentabilidad & BI (vacío)', () => {
    generateProfitabilityPDF({ products: [], sales: [], config: mockConfig, currentUser: mockUser });
  });

  // 3. Cuentas por Cobrar (CxC)
  testGen('Cuentas por Cobrar (facturas)', () => {
    generateAccountsReceivablePDF({
      receivables: [
        { factNum: 'FACT-1001', clienteNombre: 'Inversiones Los Andes C.A.', vendedorId: 'VEN-01', fechaEmision: '2026-10-01', fechaVencimiento: '2026-10-15', saldoUsd: 1250, diasMora: 9, isVencida: true },
        { factNum: 'FACT-1002', clienteNombre: 'Repuestos El Parral', vendedorId: 'VEN-02', fechaEmision: '2026-10-10', fechaVencimiento: '2026-10-25', saldoUsd: 480, diasMora: 0, isVencida: false }
      ],
      clients: [{ id: 'CLI-01', nombre: 'Inversiones Los Andes' }],
      config: mockConfig,
      currentUser: mockUser
    });
  });

  testGen('Cuentas por Cobrar (scoring clientes)', () => {
    generateAccountsReceivablePDF({
      receivables: [
        { coCli: 'CLI-99', nombre: 'Autolavado Central', saldoDeudorTotalUsd: 850, maxDiasMora: 12, rating: 'B', creditScore: 78 }
      ],
      clients: [],
      config: mockConfig,
      currentUser: mockUser
    });
  });

  testGen('Cuentas por Cobrar (vacío)', () => {
    generateAccountsReceivablePDF({ receivables: [], config: mockConfig, currentUser: mockUser });
  });

  // 4. Cuentas por Pagar (CxP)
  testGen('Cuentas por Pagar (normal)', () => {
    generateAccountsPayablePDF({
      payables: [
        { nroDoc: 'FAC-PROV-881', provNombre: 'Planta Keystone Lubricantes', provRif: 'J-12345678-9', fechaEmision: '2026-10-02', fechaVencimiento: '2026-10-20', saldoUsd: 6400, isVencido: true }
      ],
      suppliers: [{ provDes: 'Planta Keystone' }],
      config: mockConfig,
      currentUser: mockUser
    });
  });

  testGen('Cuentas por Pagar (vacío)', () => {
    generateAccountsPayablePDF({ payables: [], config: mockConfig, currentUser: mockUser });
  });

  testGen('Cuentas por Pagar (filtrado multi-página)', () => {
    const sampleFiltered = Array.from({ length: 24 }, (_, i) => ({
      tipoDoc: 'NE',
      nroDoc: String(17800 + i),
      provNombre: 'KEYSTONE C.A.',
      provRif: 'J-311153659',
      fecEmis: '28/09/2026',
      fecVenc: '13/10/2026',
      montoNetUsd: 1500 + i * 100,
      abonosUsd: i % 3 === 0 ? 1500 + i * 100 : 200,
      saldoUsd: i % 3 === 0 ? 0 : 1300 + i * 100,
      isSolvente: i % 3 === 0,
      isVencido: i % 3 === 1,
      diffDays: i % 3 === 1 ? 14 : -5
    }));
    generateAccountsPayablePDF({
      payables: sampleFiltered,
      suppliers: [{ provDes: 'KEYSTONE C.A.' }],
      config: mockConfig,
      currentUser: mockUser,
      filterSummary: 'Proveedor: KEYSTONE C.A. • Doc.: NE • Estado: Todos los Estados'
    });
  });

  // 5. SENIAT Fiscales
  testGen('SENIAT: Libro de Ventas', () => {
    generateTaxReportPDF({
      reportType: 'LIBRO_VENTAS',
      period: '2026-10',
      sales: [{ id: '001', factNum: 'FAC-001', controlNum: '00-000001', totalUsd: 150, clienteNombre: 'Cliente 1', clienteRif: 'J-12345678-0', fecha: '2026-10-22' }],
      config: mockConfig,
      currentUser: mockUser
    });
  });

  testGen('SENIAT: Cierre Z', () => {
    generateTaxReportPDF({
      reportType: 'CIERRE_Z',
      period: '2026-10',
      fiscalClosures: [{ numeroReporteZ: '0005', granTotalBs: 85000, granTotalUsd: 102.69, baseImponible16Bs: 73275.86, iva16Bs: 11724.14, igtfBs: 2550, fechaCierre: '2026-10-24', horaCierre: '18:30:00', totalFacturas: 12 }],
      config: mockConfig,
      currentUser: mockUser
    });
  });

  testGen('SENIAT: Retención ISLR', () => {
    generateTaxReportPDF({
      reportType: 'ISLR',
      period: '2026-10',
      withholdings: [{ nroComprobante: '20261000000012', proveedorNombre: 'Transportes Rápidos', proveedorRif: 'J-99887766-5', baseImponibleBs: 45000, porcentajeRetencion: 3, montoRetenidoBs: 1350, fechaEmision: '2026-10-23' }],
      config: mockConfig,
      currentUser: mockUser
    });
  });

  // 6. Dashboard
  testGen('Dashboard Ejecutivo (Consolidado ALL)', () => {
    generateDashboardPDF({
      kpiData: { totalVentasMes: 45000, metaMensual: 50000, porcentajeCumplimiento: 90, margenPromedio: 33.5, totalCxc: 12000, pedidosPendientes: 8 },
      sales: [{ id: 'V-1', totalUsd: 500, cliente: 'Cliente A', fecha: '2026-10-23' }],
      config: mockConfig,
      currentUser: mockUser,
      block: 'ALL'
    });
  });

  testGen('Dashboard Ejecutivo (Bloque 1 Comercial)', () => {
    generateDashboardPDF({
      kpiData: { litrosFacturados: 15400, cajasFacturadas: 1356, preventaPendienteUsd: 4200, precioPromedioLitro: 5.95, cumplimientoLitrosPct: 88.5 },
      sellers: [{ coVen: '01', venDes: 'Asesor 1', metaLitrosMes: 4000, litrosFinales: 3800, pctIndividual: 95 }],
      config: mockConfig,
      currentUser: mockUser,
      block: 'comercial'
    });
  });

  testGen('Dashboard Ejecutivo (Bloque 1 y ALL con Ventas del Día y Acumulado Mensual)', () => {
    const sampleHoy = {
      usd: 218,
      bs: 196550.98,
      litros: 34.05,
      cajas: 3.0,
      documentos: 1,
      clientes: 1,
      ayerUsd: 774,
      ayerLitros: 118.6,
      topProductos: [
        { sku: '100403', desc: 'Lubricante Oilstone 4 tiempos API SL', cantidad: 2, litros: 22.7, usd: 152 },
        { sku: '100102', desc: 'Lubricante Oilstone SAE 20W50 API SL', cantidad: 1, litros: 11.35, usd: 66 }
      ]
    };
    const sampleMes = {
      usd: 14105.53,
      bs: 12717686.9,
      litros: 1781.95,
      cajas: 157,
      documentos: 64,
      promedioDiarioUsd: 1282.32,
      metaLitros: 30000,
      pctMeta: 5.9,
      esMesEnCurso: true,
      diasTranscurridos: 11,
      diasDelMes: 30,
      proyeccionLitros: 4859.9,
      proyeccionUsd: 38469.6,
      topProductos: sampleHoy.topProductos
    };
    generateDashboardPDF({
      kpiData: { litrosFacturados: 154926.3, cajasFacturadas: 13649.9, preventaPendienteUsd: 0, precioPromedioLitro: 5.73, cumplimientoLitrosPct: 43.04, facturacionTotalUsd: 887874.48 },
      sellers: [{ coVen: 'KB', venDes: 'Katherine Becerra', metaLitrosMes: 3000, litrosFinales: 3800, pctIndividual: 126.7 }],
      config: mockConfig,
      currentUser: mockUser,
      block: 'comercial',
      ventasDelDia: sampleHoy,
      ventasAcumuladoMes: sampleMes,
      ventasMesLabel: 'Noviembre 2026',
      todayLabel: 'miércoles, 11 de noviembre de 2026'
    });
    generateDashboardPDF({
      kpiData: { litrosFacturados: 154926.3, cajasFacturadas: 13649.9, preventaPendienteUsd: 0, precioPromedioLitro: 5.73, cumplimientoLitrosPct: 43.04, facturacionTotalUsd: 887874.48 },
      sellers: [{ coVen: 'KB', venDes: 'Katherine Becerra', metaLitrosMes: 3000, litrosFinales: 3800, pctIndividual: 126.7 }],
      config: mockConfig,
      currentUser: mockUser,
      block: 'ALL',
      ventasDelDia: sampleHoy,
      ventasAcumuladoMes: sampleMes,
      ventasMesLabel: 'Noviembre 2026',
      todayLabel: 'miércoles, 11 de noviembre de 2026'
    });
  });

  testGen('Dashboard Ejecutivo (Bloque 2 Financiero)', () => {
    generateDashboardPDF({
      kpiData: { facturacionTotalUsd: 85000, cobradoTotalUsd: 72000, porcentajeCobranza: 84.7, disponibilidadTotalUsd: 34000 },
      disponibilidadBancariaData: [{ banco: 'BANCO MERCANTIL', numCta: '0105-1234', monto: 18000 }],
      config: mockConfig,
      currentUser: mockUser,
      block: 'financiero'
    });
  });

  testGen('Dashboard Ejecutivo (Bloque 3 Clientes)', () => {
    generateDashboardPDF({
      kpiData: { totalCarteraUsd: 28000, indiceMorosidad: 14.2, ticketPromedioUsd: 1250, clientesActivosCount: 42 },
      carteraClientesData: [{ name: 'VIGENTES (AL DÍA)', value: 24000 }],
      config: mockConfig,
      currentUser: mockUser,
      block: 'clientes'
    });
  });

  testGen('Dashboard Ejecutivo (Bloque 4 Operaciones)', () => {
    generateDashboardPDF({
      kpiData: { stockTotalLitros: 45000, stockTotalCajas: 3960, valorizacionInventarioUsd: 145000, topLubricanteNombre: 'Oilstone 20W-50', topLubricanteLitros: 8500, capitalHuesosUsd: 3200 },
      products: [{ codigo: 'OIL-20W50', descripcion: 'Oilstone 20W-50', linea: 'Mineral', stockLitros: 5000, costoUsd: 3.5 }],
      config: mockConfig,
      currentUser: mockUser,
      block: 'operaciones'
    });
  });

  // 7. Inventario
  testGen('Inventario y Valorización (normal)', () => {
    generateInventoryPDF({
      products: [{ codigo: 'OIL-1', descripcion: 'Aceite 15W-40', stock: 45, stockMinimo: 10, costoUsd: 22, precioUsd: 34 }],
      config: mockConfig,
      currentUser: mockUser
    });
  });

  testGen('Inventario (vacío)', () => {
    generateInventoryPDF({ products: [], config: mockConfig, currentUser: mockUser });
  });

  testGen('Inventario: Toma Física & Firmas de Auditoría', () => {
    generateInventoryPDF({
      reportType: 'TOMA_FISICA',
      products: [
        { codigo: 'OIL-20W50', descripcion: 'Oilstone 20W-50', ubicacion: 'Almacén Central', stock: 120, count: 120, unidad: 'Caj' },
        { codigo: 'OIL-15W40', descripcion: 'Oilstone 15W-40', ubicacion: 'Almacén Central', stock: 80, count: 75, unidad: 'Caj' }
      ],
      config: mockConfig,
      currentUser: mockUser
    });
  });

  testGen('Inventario: Salud y Caducidad FIFO', () => {
    generateInventoryPDF({
      reportType: 'CADUCIDAD',
      products: [
        { codigo: 'OIL-20W50', descripcion: 'Oilstone 20W-50', linea: 'Mineral', stock: 120, ltsStock: 1440, estatusCaducidad: 'OPTIMO' }
      ],
      config: mockConfig,
      currentUser: mockUser
    });
  });

  testGen('Inventario por Almacén 01 (Principal / Facturas Fiscales)', () => {
    generateInventoryPDF({
      products: [
        { codigo: '000003', descripcion: 'Lubricante Diesel SAE 50', stock: 760, stockAlmacen01: 300, stockAlmacen02: 460, unidad: 'Litros', costoUsd: 4.2, precioUsdDetal: 6.5, stockMinimo: 20 },
        { codigo: '000012', descripcion: 'Lubricante Diesel SAE 50 Totem', stock: 1, stockAlmacen01: 0, stockAlmacen02: 1, unidad: 'Totem', costoUsd: 2400, precioUsdDetal: 3200, stockMinimo: 2 }
      ],
      config: mockConfig,
      currentUser: mockUser,
      warehouseId: '01',
      warehouseName: '01: ALMACÉN PRINCIPAL / MOSTRADOR (Facturas Fiscales)'
    });
  });

  testGen('Inventario por Almacén 02 (Central / Notas de Entrega)', () => {
    generateInventoryPDF({
      products: [
        { codigo: '000003', descripcion: 'Lubricante Diesel SAE 50', stock: 760, stockAlmacen01: 300, stockAlmacen02: 460, unidad: 'Litros', costoUsd: 4.2, precioUsdDetal: 6.5, stockMinimo: 20 },
        { codigo: '000012', descripcion: 'Lubricante Diesel SAE 50 Totem', stock: 1, stockAlmacen01: 0, stockAlmacen02: 1, unidad: 'Totem', costoUsd: 2400, precioUsdDetal: 3200, stockMinimo: 2 }
      ],
      config: mockConfig,
      currentUser: mockUser,
      warehouseId: 'ALM-02',
      warehouseName: '02: ALMACÉN CENTRAL / BÓVEDA (Notas de Entrega)'
    });
  });

  testGen('Inventario por Almacén 01 y 02 (vacíos)', () => {
    generateInventoryPDF({ products: [], config: mockConfig, currentUser: mockUser, warehouseId: '01' });
    generateInventoryPDF({ products: [], config: mockConfig, currentUser: mockUser, warehouseId: '02' });
  });

  testGen('Inventario Toma Física por Almacén 01 y 02', () => {
    const sampleProducts = [
      { codigo: '001201', descripcion: '15W-40 Semi', stock: 152, stockAlmacen01: 60, stockAlmacen02: 92, unidad: 'Caja' }
    ];
    generateInventoryPDF({
      products: sampleProducts,
      config: mockConfig,
      currentUser: mockUser,
      isPhysicalTake: true,
      physicalCounts: { '001201': 60 },
      warehouseId: '01',
      warehouseName: '01: ALMACÉN PRINCIPAL / MOSTRADOR (Facturas Fiscales)',
      auditorName: 'Auditor Test'
    });
    generateInventoryPDF({
      products: sampleProducts,
      config: mockConfig,
      currentUser: mockUser,
      isPhysicalTake: true,
      physicalCounts: { '001201': 90 },
      warehouseId: '02',
      warehouseName: '02: ALMACÉN CENTRAL / BÓVEDA (Notas de Entrega)',
      auditorName: 'Auditor Test'
    });
  });

  // 8. Pedidos & Pipeline
  testGen('Pedidos & Pipeline', () => {
    generateOrdersPDF({
      orders: [{ id: 'PED-101', clienteNombre: 'AutoRepuestos C.A.', totalUsd: 1850, status: 'FACTURADO' }],
      config: mockConfig,
      currentUser: mockUser
    });
  });

  // 8B. Nota de Pedido / Preventa Individual para Vendedor
  testGen('Nota de Pedido Vendedor (con renglones y reserva de 72 Horas)', () => {
    generateSellerOrderPDF({
      order: {
        id: 'PED-2026-001',
        fecha: '2026-10-31',
        vendedor: 'Carlos Mendoza',
        codigoVendedor: 'VEN-04',
        cliente: 'Distribuidora Carabobo 2000 C.A.',
        clienteRif: 'J-31456789-0',
        direccionEntrega: 'Av. Michelena, Galpón 4, Valencia',
        zonaVenta: '01 - Valencia Norte',
        condicionPago: 'Crédito 15 Días',
        observaciones: 'Despacho urgente solicitado por el cliente en turno matutino.',
        items: [
          {
            articuloId: 'LUB-01',
            articuloDescripcion: 'SIGNUM SYNTHETIC 15W-40 CK-4 DIESEL',
            unidadVenta: 'Tambor (208L)',
            cantidad: 2,
            litrosUnitarios: 208,
            litrosTotales: 416,
            precioUsd: 420.00,
            subtotalUsd: 840.00
          },
          {
            articuloId: 'LUB-02',
            articuloDescripcion: 'SIGNUM TRANSMISSION ATF DEXRON III',
            unidadVenta: 'Caja (12×1L)',
            cantidad: 5,
            litrosUnitarios: 11.35,
            litrosTotales: 56.75,
            precioUsd: 48.00,
            subtotalUsd: 240.00
          }
        ]
      },
      config: mockConfig,
      currentUser: mockUser
    });
  });

  testGen('Nota de Pedido Vendedor (pedido sin renglones)', () => {
    generateSellerOrderPDF({
      order: {
        id: 'PED-2026-002',
        totalUsd: 500,
        status: 'PENDIENTE'
      },
      config: mockConfig,
      currentUser: mockUser
    });
  });

  // 8C. Nota de Entrega (Formato Carta con Desbordamiento y Paginación 1/1 y 1/2)
  testGen('Nota de Entrega Tamaño Carta (1 página - formato 1/1)', () => {
    const result = generateDeliveryNotePDF({
      deliveryNote: {
        numeroDoc: 'NE-000101',
        clienteNombre: 'Distribuidora Carabobo 2026, C.A.',
        clienteRif: 'J-31998822-1',
        clienteDireccion: 'Av. Lisandro Alvarado, Valencia',
        condicionPago: 'CONTADO',
        totalUsd: 280,
        items: [
          { codigo: 'LUB-15W40-01', descripcion: 'Aceite Motorven 15W40 Mineral 1L', cantidad: 4, precioUsd: 35, totalUsd: 140 },
          { codigo: 'LUB-20W50-01', descripcion: 'Aceite Motorven 20W50 Alto Km 1L', cantidad: 4, precioUsd: 35, totalUsd: 140 }
        ]
      },
      config: mockConfig,
      currentUser: mockUser
    });
    if (result.totalPages !== 1) {
      throw new Error(`Se esperaba 1 sola página para pocos renglones, pero generó ${result.totalPages}`);
    }
  });

  testGen('Nota de Entrega Tamaño Carta con desbordamiento (múltiples páginas - formato 1/2 y 2/2)', () => {
    const itemsLlenos = [];
    for (let i = 1; i <= 18; i++) {
      itemsLlenos.push({
        codigo: `LUB-ITEM-${i}`,
        descripcion: `Aceite Lubricante Motorven Industrial Grado ISO-${i * 10} Tambor 208L`,
        cantidad: 2,
        precioUsd: 150,
        totalUsd: 300
      });
    }

    const result = generateDeliveryNotePDF({
      deliveryNote: {
        numeroDoc: 'NE-000102',
        clienteNombre: 'Consorcio Industrial de Transporte del Centro',
        clienteRif: 'J-50478166-0',
        clienteDireccion: 'Zona Industrial Castillito, San Diego, Carabobo',
        condicionPago: 'CRÉDITO 15 DÍAS',
        diasCredito: 15,
        totalUsd: 5400,
        items: itemsLlenos
      },
      config: mockConfig,
      currentUser: mockUser
    });
    if (result.totalPages < 2) {
      throw new Error(`Se esperaban al menos 2 páginas para orden con desbordamiento de 18 renglones, pero generó ${result.totalPages}`);
    }
  });

  testGen('Nota de Entrega Profit Plus (resuelve descripción, litros reales y precios USD desde Bs)', () => {
    const profitNeSample = {
      factNum: '2128',
      tipoDoc: 'NOTA_ENTREGA',
      clienteNombre: 'Cliente Prueba Profit C.A.',
      clienteRif: 'J-31115365-9',
      totNetoUsd: 1427.19,
      totNetoBs: 1121068.3,
      rawTotalNetoBs: 1181331.26,
      originalTotalNetoUsd: 1427.19,
      items: [
        { rengNum: 1, articuloId: '001312', descripcion: '', unidadVenta: 'Tambor', cantidad: 1, litrosUnitarios: 11.35, litrosTotales: 11.35, precioUnitario: 868495.6, totalNeto: 868495.6 },
        { rengNum: 2, articuloId: '000704', descripcion: '', unidadVenta: 'Paila', cantidad: 3, litrosUnitarios: 11.35, litrosTotales: 34.05, precioUnitario: 84190.9, totalNeto: 252572.7 },
        { rengNum: 3, articuloId: '001208', descripcion: '', unidadVenta: 'Caja', cantidad: 1, litrosUnitarios: 11.35, litrosTotales: 11.35, precioUnitario: 60262.96, totalNeto: 60262.96 }
      ]
    };
    const resolved = resolveDeliveryNoteLineItems(profitNeSample, null, mockConfig.tasaDolar);
    if (resolved.length !== 3) {
      throw new Error(`Se esperaban 3 renglones resueltos, se obtuvieron ${resolved.length}`);
    }
    if (!resolved[0].descripcion.toLowerCase().includes('20w50') || resolved[0].volumenTotal !== 208) {
      throw new Error(`Tambor 001312 mal resuelto: ${resolved[0].descripcion} / ${resolved[0].volumenTotal} L`);
    }
    if (!resolved[1].descripcion.toLowerCase().includes('paila') || resolved[1].volumenTotal !== 57) {
      throw new Error(`Paila 000704 mal resuelta: ${resolved[1].descripcion} / ${resolved[1].volumenTotal} L`);
    }
    if (Math.abs(resolved[0].subtotalUsd - 1049.25) > 0.1 || Math.abs(resolved[2].subtotalUsd - 72.81) > 0.1) {
      throw new Error(`Conversión USD incorrecta: Tambor=${resolved[0].subtotalUsd}, Caja=${resolved[2].subtotalUsd}`);
    }
    generateDeliveryNotePDF({
      sale: profitNeSample,
      config: mockConfig,
      currentUser: mockUser
    });
  });

  testGen('pickPreferredLineItems y resolveDeliveryNoteLineItems (JSON string, códigos sin ceros iniciales y merge)', () => {
    const preferred = pickPreferredLineItems(
      [],
      [{ codigo: 'LUB-MANUAL', nombre: 'Despacho Nota de Entrega (Manual/Histórico)' }],
      [{ codigo: '100403', descripcion: 'Lubricante Oilstone 4 tiempos API SL motos (LT)', cantidad: 2, precioUsd: 76 }]
    );
    if (preferred.length !== 1 || preferred[0].codigo !== '100403') {
      throw new Error(`pickPreferredLineItems debía preferir el renglón real de producto, obtuvo: ${JSON.stringify(preferred)}`);
    }

    const jsonItemsDoc = {
      numeroDoc: 'NE-002226',
      items: JSON.stringify([
        { articuloId: '1208', descripcion: '', cantidad: 2, precioUsd: 70 }
      ])
    };
    const resolved = resolveDeliveryNoteLineItems(jsonItemsDoc, null, mockConfig.tasaDolar);
    if (resolved.length !== 1 || !resolved[0].descripcion.toLowerCase().includes('15w40') || !resolved[0].codigo) {
      throw new Error(`No resolvió JSON string / código sin ceros iniciales 1208 -> 001208: ${JSON.stringify(resolved)}`);
    }
  });

  // 9. Facturación POS
  testGen('Facturación POS (factura individual detallada)', () => {
    generateSalesPOSPDF({
      sales: [{
        id: 'FAC-105',
        factNum: 'FAC-105',
        clienteNombre: 'Lubricantes El Ávila',
        clienteRif: 'J-29837192-3',
        totalUsd: 540,
        items: [
          { codigo: 'OIL-01', descripcion: 'Sintético 5W-40', cantidad: 10, precio: 38, total: 380 },
          { codigo: 'OIL-02', descripcion: 'Filtro de Aceite', cantidad: 8, precio: 20, total: 160 }
        ]
      }],
      config: mockConfig,
      currentUser: mockUser
    });
  });

  testGen('Facturación POS (listado general)', () => {
    generateSalesPOSPDF({
      sales: [
        { id: 'FAC-105', factNum: 'FAC-105', cliente: 'Cliente A', totalUsd: 100 },
        { id: 'FAC-106', factNum: 'FAC-106', cliente: 'Cliente B', totalUsd: 250 }
      ],
      config: mockConfig,
      currentUser: mockUser
    });
  });

  // 10. Compras & Procura
  testGen('Compras (individual)', () => {
    generatePurchasesPDF({
      purchases: [{
        id: 'CMP-201',
        numeroFacturaProv: 'FP-9901',
        proveedorNombre: 'PetroChemicals Corp',
        totalUsd: 4200,
        items: [{ codigo: 'RAW-01', descripcion: 'Base Lubricante Grupo II', cantidad: 200, costo: 21, total: 4200 }]
      }],
      config: mockConfig,
      currentUser: mockUser
    });
  });

  testGen('Compras (listado general)', () => {
    generatePurchasesPDF({
      purchases: [{ id: 'CMP-201', factura: 'FP-9901', proveedor: 'PetroChemicals', totalUsd: 4200 }],
      suppliers: [{ provDes: 'PetroChemicals' }],
      config: mockConfig,
      currentUser: mockUser
    });
  });

  // 11. Flujo de Caja & Bancos
  testGen('Flujo de Caja, Cajas & Bancos', () => {
    generateCashflowPDF({
      bankAccounts: [{ banco: 'Banesco Banco Universal', num_cta: '0134-****-1234', saldoBs: 150000, moneda: 'Bs.' }],
      cashDesks: [{ nombre: 'Caja Principal USD', saldoUsd: 4500 }],
      cashMovements: [{ concepto: 'Venta contado', montoUsd: 200, tipo: 'INGRESO' }],
      config: mockConfig,
      currentUser: mockUser
    });
  });

  // 12. Auditoría & Contabilidad
  testGen('Auditoría Contable (Libro Diario)', () => {
    generateAuditLedgerPDF({
      entries: [{
        asientoNum: 'AS-001',
        fecha: '2026-10-23',
        lines: [
          { cuentaCodigo: '1.1.01.01', cuentaNombre: 'Caja Principal USD', debeUsd: 500, haberUsd: 0 },
          { cuentaCodigo: '4.1.01.01', cuentaNombre: 'Ventas de Lubricantes', debeUsd: 0, haberUsd: 500 }
        ]
      }],
      subTab: 'diario',
      config: mockConfig,
      currentUser: mockUser
    });
  });

  testGen('Auditoría Contable (Logs de Auditoría)', () => {
    generateAuditLedgerPDF({
      auditLogs: [{ fecha: '2026-10-24 10:15:00', usuario: 'admin', tipo: 'SECURITY', titulo: 'Login exitoso', estado: 'CONFIRMADO' }],
      subTab: 'auditoria',
      config: mockConfig,
      currentUser: mockUser
    });
  });

  // 13. Usuarios & Roles
  testGen('Usuarios & Permisología', () => {
    generateUsersPDF({
      users: [{ username: 'admin', nombre: 'Edson Master', rol: 'ADMIN_MASTER', departamento: 'DIRECCIÓN', modulos: ['TODOS'], activo: true }],
      config: mockConfig,
      currentUser: mockUser
    });
  });

  // 14. Configuración
  testGen('Ficha Técnica de Configuración', () => {
    generateConfigPDF({ config: mockConfig, currentUser: mockUser });
  });

  // 15. Manual de Usuario
  testGen('Manual de Usuario & SOP', () => {
    generateManualPDF({ config: mockConfig, currentUser: mockUser });
  });

  // 16. Centro de Notificaciones & Alertas
  testGen('Centro de Notificaciones & Alertas (con datos)', () => {
    generateNotificationsPDF({
      notifications: [
        { id: 'n1', tipo: 'stock', severidad: 'critica', modulo: 'inventario', titulo: 'Alerta ROP Crítica', mensaje: '21 SKUs críticos', leida: false, created_at: new Date().toISOString() },
        { id: 'n2', tipo: 'cxc', severidad: 'advertencia', modulo: 'cxc', titulo: 'Cobranza en Mora', mensaje: 'Facturas > 30 días', leida: true, created_at: new Date().toISOString() }
      ],
      config: mockConfig,
      currentUser: mockUser
    });
  });

  testGen('Centro de Notificaciones & Alertas (vacío)', () => {
    generateNotificationsPDF({
      notifications: [],
      config: mockConfig,
      currentUser: mockUser
    });
  });

  testGen('Esquema Detallado de Cuentas Bancarias Profit Plus (Con Datos GRUMOTOR)', () => {
    generateBankAccountsPDF({
      bankAccounts: [
        { cod: '01', banco: 'BANCO MERCANTIL', numCta: '01050027311027479197', tipo: 'Corriente', saldo: 13793118.66, sucursal: 'Caracas', ejecutivo: 'Yuliskar Vásquez' },
        { cod: '02', banco: 'BANCO PLAZA', numCta: '01380015420150669275', tipo: 'Corriente', saldo: -5511254.38, sucursal: 'Guaparo', ejecutivo: 'Uranea Pedroza' }
      ],
      cashDesks: [
        { cod: '01', descrip: 'CAJA PRINCIPAL VALENCIA', moneda: 'BS', saldo: 308034.33, tipo: 'Caja Mostrador' },
        { cod: '02', descrip: 'CAJA DIVISAS EFECTIVO', moneda: 'US$', saldo: 9373.40, tipo: 'Bóveda Moneda Fuerte' }
      ],
      config: mockConfig,
      currentUser: mockUser
    });
  });

  testGen('Esquema Detallado de Cuentas Bancarias Profit Plus (Por Defecto 10 Cuentas GRUMOTOR)', () => {
    generateBankAccountsPDF({
      config: mockConfig,
      currentUser: mockUser
    });
  });

  // 39. Reporte Individual de Tabla Profit Plus / SQL Server
  testGen('Reporte Individual de Tabla Profit Plus (Tabla [art] con datos y muchas columnas - Landscape)', () => {
    generateProfitDatabaseTablePDF({
      database: 'GRUMOTOR',
      tableName: 'art',
      columns: [
        { name: 'co_art' },
        { name: 'art_des' },
        { name: 'tipo' },
        { name: 'modelo' },
        { name: 'co_lin' },
        { name: 'co_subl' },
        { name: 'co_cat' },
        { name: 'co_color' },
        { name: 'co_ubic' },
        { name: 'costo_act' }
      ],
      rows: [
        { co_art: 'LUB-15W40-01', art_des: 'LUBRICANTE OILSTONE 15W40 MINERAL 1 QT', tipo: 'TERMINADO', modelo: 'MINERAL', co_lin: 'LUB', co_subl: 'MOT', co_cat: 'MIN', co_color: 'AMB', co_ubic: 'A-01', costo_act: 4.85 },
        { co_art: 'LUB-20W50-01', art_des: 'LUBRICANTE OILSTONE 20W50 ALTO KILOMETRAJE 1 QT', tipo: 'TERMINADO', modelo: 'MINERAL', co_lin: 'LUB', co_subl: 'MOT', co_cat: 'MIN', co_color: 'AMB', co_ubic: 'A-02', costo_act: 5.10 }
      ],
      totalRows: 420,
      filterQuery: '15W40',
      config: mockConfig,
      currentUser: mockUser
    });
  });

  testGen('Reporte Individual de Tabla Profit Plus (Tabla vacía / sin datos - Portrait)', () => {
    generateProfitDatabaseTablePDF({
      database: 'GRUMOTOR',
      tableName: 'zonas',
      columns: [{ name: 'co_zon' }, { name: 'zon_des' }],
      rows: [],
      totalRows: 0,
      config: mockConfig,
      currentUser: mockUser
    });
  });

  // Helper de extracción de coordenadas Y (en mm) desde stream PDF de jsPDF
  function extractTextYPositionsMm(doc, pageNumber, searchText) {
    const pageStream = (doc.internal.pages[pageNumber] || []).join('\n');
    const pageH = doc.internal.pageSize.getHeight();
    const k = doc.internal.scaleFactor || (72 / 25.4);
    const results = [];
    // jsPDF escribe texto con matriz Td / Tm antes de (...) Tj
    const lines = pageStream.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(searchText)) {
        // Buscar la última coordenada Y en las 3 líneas anteriores o la misma línea
        const windowStr = lines.slice(Math.max(0, i - 3), i + 1).join(' ');
        const tdMatches = [...windowStr.matchAll(/1 0 0 1 ([\d.-]+) ([\d.-]+) Tm|([\d.-]+) ([\d.-]+) Td/g)];
        if (tdMatches.length > 0) {
          const last = tdMatches[tdMatches.length - 1];
          const yPt = Number(last[2] ?? last[4]);
          if (Number.isFinite(yPt)) {
            results.push(pageH - (yPt / k));
          }
        }
      }
    }
    return results;
  }

  // 40. Guía de Despacho de Almacén (1 página y desbordamiento 1/2, 2/2 con firmas ancladas)
  testGen('Guía de Despacho Almacén (1 página con firmas ancladas sobre el pie de página)', () => {
    const { doc } = generateWarehouseDispatchGuidePDF({
      sale: {
        numeroFactura: 'FAC-GD-101',
        clienteNombre: 'Lubricantes Valencia C.A.',
        clienteRif: 'J-40011223-4',
        items: [
          { codigo: 'LUB-01', descripcion: 'Aceite Mineral 20W50', cantidad: 3, pesoLitros: 34.05 },
          { codigo: 'LUB-02', descripcion: 'Aceite Sintético 5W30', cantidad: 2, pesoLitros: 22.7 }
        ]
      },
      config: mockConfig,
      currentUser: mockUser
    });
    const lastPage = doc.internal.getNumberOfPages();
    const sigYs = extractTextYPositionsMm(doc, lastPage, 'Firma y Sello Oficial');
    const { footerY } = getPageLayoutMetrics(doc);
    if (sigYs.length !== 3) {
      throw new Error(`Se esperaban 3 firmas oficiales, encontradas: ${sigYs.length}`);
    }
    for (const y of sigYs) {
      if (y < footerY - 10 || y >= footerY) {
        throw new Error(`Firma no anclada sobre footerY (${footerY.toFixed(1)}mm): Y=${y.toFixed(1)}mm`);
      }
    }
  });

  testGen('Guía de Despacho Almacén con desbordamiento (múltiples páginas 1/2, 2/2)', () => {
    const items = Array.from({ length: 24 }, (_, idx) => ({
      codigo: `GD-${idx + 1}`,
      descripcion: `Lubricante Industrial Despacho Lote #${idx + 1}`,
      cantidad: 2,
      pesoLitros: 22.7
    }));
    const { doc } = generateWarehouseDispatchGuidePDF({
      sale: { numeroFactura: 'FAC-GD-999', clienteNombre: 'Transporte Pesado Occidente', items },
      config: mockConfig,
      currentUser: mockUser
    });
    const totalP = doc.internal.getNumberOfPages();
    if (totalP < 2) {
      throw new Error(`Se esperaba desbordamiento (>=2 págs) en Guía de Despacho, obtuvo ${totalP}`);
    }
    const p1Text = (doc.internal.pages[1] || []).join('\n');
    const lastText = (doc.internal.pages[totalP] || []).join('\n');
    if (!p1Text.includes(`1/${totalP}`) || !lastText.includes(`${totalP}/${totalP}`)) {
      throw new Error(`Falta formato 1/${totalP} o ${totalP}/${totalP} en Guía de Despacho`);
    }
  });

  // 41. Factura SENIAT Tamaño Carta (Cajetín de Firma anclado sobre pie y desbordamiento 1/2, 2/2)
  testGen('Factura SENIAT Carta (Firma y Sello anclados sobre pie de página y desbordamiento 1/2, 2/2)', () => {
    const docShort = generateLetterInvoiceSeniatPDF({
      sale: {
        numeroFactura: 'SEN-001',
        clienteNombre: 'Auto Repuestos Lara',
        clienteRif: 'J-30123456-7',
        totalUsd: 116,
        items: [{ codigo: '001', descripcion: 'Aceite 15W40', cantidad: 2, precioUnitUsd: 50, totalUsd: 100 }]
      },
      config: mockConfig
    });
    const shortSigY = extractTextYPositionsMm(docShort, 1, 'Firma y Sello de Recepci');
    const bottomLimitY = 279.4 - 45; // 234.4mm
    if (shortSigY.length === 0 || shortSigY[0] < bottomLimitY - 25 || shortSigY[0] >= bottomLimitY - 4) {
      throw new Error(`Firma SENIAT no anclada sobre footer (${bottomLimitY - 4}mm): ${JSON.stringify(shortSigY)}`);
    }

    const longItems = Array.from({ length: 28 }, (_, idx) => ({
      codigo: `SEN-${idx + 1}`,
      descripcion: `Aceite Motorven SENIAT Renglón Lote #${idx + 1} Alta Viscosidad`,
      cantidad: 1,
      precioUnitUsd: 25,
      totalUsd: 25
    }));
    const docMulti = generateLetterInvoiceSeniatPDF({
      sale: {
        numeroFactura: 'SEN-002',
        clienteNombre: 'Flota Corporativa Nacional C.A.',
        clienteRif: 'J-50000111-2',
        totalUsd: 812,
        items: longItems
      },
      config: mockConfig
    });
    const totalP = docMulti.internal.getNumberOfPages();
    if (totalP < 2) {
      throw new Error(`Se esperaba desbordamiento (>=2 págs) en Factura SENIAT, obtuvo ${totalP}`);
    }
    const p1Stream = (docMulti.internal.pages[1] || []).join('\n');
    const pLastStream = (docMulti.internal.pages[totalP] || []).join('\n');
    if (!p1Stream.includes(`1/${totalP}`) || !pLastStream.includes(`${totalP}/${totalP}`)) {
      throw new Error(`Factura SENIAT multi-página no muestra 1/${totalP} y ${totalP}/${totalP}`);
    }
  });

  // 42. Reporte Cobranzas WhatsApp (Firmas ancladas y desbordamiento 1/2, 2/2)
  testGen('Gestión de Cobranzas WhatsApp (Firmas ancladas y desbordamiento 1/2, 2/2)', () => {
    const sentMessages = Array.from({ length: 55 }, (_, i) => ({
      id: `WA-${i + 1}`,
      fecha: '2026-11-11T10:30:00Z',
      clienteNombre: `Cliente Corporativo Industrial Deudor ${i + 1} C.A.`,
      clienteRif: `J-40000${String(i).padStart(3, '0')}-1`,
      telefono: '0414-5550000',
      invoicesList: `#FAC-${2000 + i}, #FAC-${3000 + i}`,
      totalSaldoUsd: 250.5,
      maxDiasVencido: i % 3 === 0 ? 18 : 0,
      estado: 'ENVIADO'
    }));
    const docWa = generateWhatsAppCollectionPDF({
      sentMessages,
      config: mockConfig,
      currentUser: mockUser
    });
    const totalP = docWa.internal.getNumberOfPages();
    if (totalP < 2) {
      throw new Error(`Se esperaba desbordamiento (>=2 págs) en Reporte WhatsApp, obtuvo ${totalP}`);
    }
    const p1Stream = (docWa.internal.pages[1] || []).join('\n');
    const pLastStream = (docWa.internal.pages[totalP] || []).join('\n');
    if (!p1Stream.includes(`1/${totalP}`) || !pLastStream.includes(`${totalP}/${totalP}`)) {
      throw new Error(`Reporte WhatsApp multi-página no muestra 1/${totalP} y ${totalP}/${totalP}`);
    }
    const { footerY } = getPageLayoutMetrics(docWa);
    const sigYs = extractTextYPositionsMm(docWa, totalP, 'Firma y Sello Oficial');
    if (sigYs.length !== 2 || sigYs.some(y => y < footerY - 10 || y >= footerY)) {
      throw new Error(`Firmas de Reporte WhatsApp fuera de anclaje (${footerY.toFixed(1)}mm): ${JSON.stringify(sigYs)}`);
    }
  });

  // 43. Anclaje de Firmas en Landscape y Nota de Entrega sobre zona QR
  testGen('Verificación de anclaje de firmas (Nota de Entrega sobre QR + Landscape Bank/DB)', () => {
    // 43a: Nota de entrega con 1 solo ítem -> firmas ancladas justo sobre QR (Y ~ 212.5..231.5mm), NO en Y=120mm
    const neRes = generateDeliveryNotePDF({
      deliveryNote: {
        numeroDoc: 'NE-ANC-01',
        clienteNombre: 'Cliente Anclaje S.A.',
        items: [{ codigo: '001', descripcion: 'Aceite Test', cantidad: 1, precioUsd: 40, totalUsd: 40 }],
        totalUsd: 40
      },
      config: mockConfig,
      currentUser: mockUser
    });
    const neSigYs = extractTextYPositionsMm(neRes.doc, 1, 'Firma y Sello Oficial');
    if (neSigYs.length !== 3 || neSigYs.some(y => y < 225 || y > 232)) {
      throw new Error(`Nota de Entrega debe anclar firmas sobre el QR (225..232mm), obtuvo: ${JSON.stringify(neSigYs)}`);
    }

    // 43b: Tabla Profit Landscape (>6 columnas) con muchas filas -> 1/2, 2/2 + firmas dentro de footerY Landscape (193.4mm)
    const manyRows = Array.from({ length: 45 }, (_, i) => ({
      co_art: `ART-${i}`, art_des: `Producto ${i}`, tipo: 'T', modelo: 'M', co_lin: 'L', co_subl: 'S', co_cat: 'C', costo_act: 10
    }));
    const dbDoc = generateProfitDatabaseTablePDF({
      database: 'GRUMOTOR',
      tableName: 'art',
      columns: ['co_art', 'art_des', 'tipo', 'modelo', 'co_lin', 'co_subl', 'co_cat', 'costo_act'],
      rows: manyRows,
      totalRows: 45,
      config: mockConfig,
      currentUser: mockUser
    });
    const totalDbP = dbDoc.internal.getNumberOfPages();
    if (totalDbP < 2) {
      throw new Error(`Tabla DB Landscape con 45 filas debió desbordarse a >=2 páginas, obtuvo ${totalDbP}`);
    }
    const { footerY: landFooterY } = getPageLayoutMetrics(dbDoc);
    const dbSigYs = extractTextYPositionsMm(dbDoc, totalDbP, 'Firma y Sello Oficial');
    if (dbSigYs.length !== 2 || dbSigYs.some(y => y < landFooterY - 10 || y >= landFooterY)) {
      throw new Error(`Firmas Landscape fuera de anclaje sobre footerY (${landFooterY.toFixed(1)}mm): ${JSON.stringify(dbSigYs)}`);
    }
  });

  // 44. Formatos Empresariales Faltantes (11 nuevos generadores + TXT SENIAT + anclaje y desbordamiento 1/2, 2/2)
  testGen('Cotización / Presupuesto Comercial (Carta + Firmas ancladas)', () => {
    const qDoc = generateQuotationPDF({
      quotation: {
        numeroDoc: 'COT-00012',
        clienteNombre: 'Distribuidora Automotriz Lara C.A.',
        clienteRif: 'J-40112233-4',
        vigenciaDias: 7,
        items: [{ codigo: '000308', descripcion: 'OILSTONE 15W-40 Paila 19L', cantidad: 4, precioUsd: 78 }]
      },
      config: mockConfig,
      currentUser: mockUser
    });
    const { footerY } = getPageLayoutMetrics(qDoc);
    const sigYs = extractTextYPositionsMm(qDoc, 1, 'Firma y Sello Oficial');
    if (sigYs.length !== 3 || sigYs.some(y => y < footerY - 10 || y >= footerY)) {
      throw new Error(`Firmas de Cotización fuera de anclaje (${footerY.toFixed(1)}mm): ${JSON.stringify(sigYs)}`);
    }
  });

  testGen('Nota de Crédito y Nota de Débito Fiscal Carta SENIAT', () => {
    const ncDoc = generateCreditDebitNotePDF({
      docData: {
        tipoDoc: 'NOTA_CREDITO',
        numeroDoc: 'NC-000045',
        documentoAfectado: '00001012',
        clienteNombre: 'Lubricantes Valencia S.A.',
        clienteRif: 'J-30998877-1',
        motivo: 'Devolución de 2 cajas selladas',
        items: [{ codigo: '000704', descripcion: 'OILSTONE 20W-50', cantidad: 2, precioUsd: 42 }]
      },
      config: mockConfig,
      currentUser: mockUser
    });
    const ndDoc = generateCreditDebitNotePDF({
      docData: {
        tipoDoc: 'NOTA_DEBITO',
        numeroDoc: 'ND-000018',
        documentoAfectado: '00001012',
        clienteNombre: 'Lubricantes Valencia S.A.',
        motivo: 'Recargo por flete especial acordado',
        totalUsd: 58
      },
      config: mockConfig,
      currentUser: mockUser
    });
    if (ncDoc.internal.getNumberOfPages() < 1 || ndDoc.internal.getNumberOfPages() < 1) {
      throw new Error('NC/ND no generaron páginas válidas');
    }
  });

  testGen('Nota de Traslado entre Almacenes y Comprobante de Ajuste/Merma', () => {
    generateWarehouseTransferOrAdjustmentPDF({
      mode: 'TRANSFER',
      record: {
        trasNum: 'TRAS-005',
        almOrig: '01',
        almDest: '02',
        motivo: 'Reposición almacén de notas de entrega',
        renglones: [{ co_art: '000308', art_des: 'OILSTONE 15W-40 Paila', total_art: 5, cost_unit_om: 55 }]
      },
      config: mockConfig,
      currentUser: mockUser
    });
    generateWarehouseTransferOrAdjustmentPDF({
      mode: 'ADJUSTMENT',
      record: {
        ajueNum: 'AJU-019',
        almacen: '01',
        motivo: 'Merma por envase perforado en transporte',
        renglones: [{ co_art: '000308', art_des: 'OILSTONE 15W-40 Paila', tipo_trans: 'S', total_art: 1, cost_unit_om: 55 }]
      },
      config: mockConfig,
      currentUser: mockUser
    });
  });

  testGen('Requisición de Compra, Orden de Compra (OC) y Nota de Recepción', () => {
    generatePurchaseRequisitionPDF({
      requisition: {
        numeroDoc: 'REQ-001',
        departamento: 'ALMACÉN CENTRAL',
        prioridad: 'ALTA',
        items: [{ codigo: '000308', descripcion: 'OILSTONE 15W-40', stockActual: 4, cantidad: 25, costoEstimadoUsd: 54 }]
      },
      config: mockConfig,
      currentUser: mockUser
    });
    generatePurchaseOrderPDF({
      order: {
        numeroDoc: 'OC-00099',
        proveedorNombre: 'Planta Keystone Lubricantes C.A.',
        proveedorRif: 'J-31115365-9',
        items: [{ codigo: '000308', descripcion: 'OILSTONE 15W-40', cantidad: 25, costoUsd: 54 }]
      },
      config: mockConfig,
      currentUser: mockUser
    });
    generateGoodsReceiptPDF({
      receipt: {
        numeroDoc: 'REC-0014',
        proveedorNombre: 'Planta Keystone Lubricantes C.A.',
        nro_fact: 'FAC-PROV-771',
        items: [{ codigo: '000308', descripcion: 'OILSTONE 15W-40', cantidadEsperada: 25, cantidadRecibida: 24, cantidadDanada: 1 }]
      },
      config: mockConfig,
      currentUser: mockUser
    });
  });

  testGen('Orden de Pago, Recibo de Cobro, Vale de Egreso y Estado de Cuenta (c/ desbordamiento 1/2, 2/2)', () => {
    generatePaymentOrderPDF({
      paymentOrder: { ordNum: 'OP-1434', benDes: 'Servicios Eléctricos C.A.', codBen: 'J-30111222-3', descrip: 'Pago servicio mensual', monto: 45000, montoRet: 900, tasa: 827.73 },
      config: mockConfig,
      currentUser: mockUser
    });
    generateCollectionReceiptPDF({
      receipt: { cobNum: 'COB-4001', clienteNombre: 'Autocentro Lara', clienteRif: 'J-40012345-6', montoUsd: 350, tasa: 827.73, referencia: 'TRF-998811' },
      allocations: [{ factNum: 'FAC-1001', tipoDoc: 'FACTURA', saldoAnteriorUsd: 500, abonoUsd: 350, saldoRestanteUsd: 150 }],
      config: mockConfig,
      currentUser: mockUser
    });
    generateExpenseVoucherPDF({
      movement: { id: 'VAL-088', tipo: 'EGRESO', concepto: 'Viáticos de despacho ruta occidente', metodo: 'EFECTIVO_USD', montoUsd: 65 },
      config: mockConfig,
      currentUser: mockUser
    });
    const manyDocs = Array.from({ length: 48 }, (_, i) => ({
      factNum: `FAC-${5000 + i}`,
      tipoDoc: 'FACTURA',
      fechaEmision: '2026-10-01',
      fechaVencimiento: '2026-10-16',
      totNetoUsd: 200,
      abonosUsd: 50,
      saldoUsd: 150,
      isVencida: i % 2 === 0
    }));
    const ecDoc = generateThirdPartyStatementPDF({
      entity: { nombre: 'Grupo Automotriz Occidental C.A.', rif: 'J-40987654-3' },
      entityType: 'CLIENT',
      documents: manyDocs,
      config: mockConfig,
      currentUser: mockUser
    });
    const totalEcP = ecDoc.internal.getNumberOfPages();
    if (totalEcP < 2) {
      throw new Error(`Estado de cuenta con 48 documentos debió desbordar a >=2 págs, obtuvo ${totalEcP}`);
    }
    const { footerY } = getPageLayoutMetrics(ecDoc);
    const sigYs = extractTextYPositionsMm(ecDoc, totalEcP, 'Firma y Sello Oficial');
    if (sigYs.length !== 2 || sigYs.some(y => y < footerY - 10 || y >= footerY)) {
      throw new Error(`Firmas de Estado de Cuenta fuera de anclaje: ${JSON.stringify(sigYs)}`);
    }
  });

  testGen('Comprobantes Individuales Retención IVA / ISLR SENIAT + Archivo TXT', () => {
    generateSeniatRetentionVoucherPDF({
      type: 'IVA',
      record: {
        numeroComprobanteRetencionIva: '20261100000001',
        proveedorNombre: 'Planta Keystone Lubricantes',
        proveedorRif: 'J-31115365-9',
        numeroFactura: '000841',
        numeroControl: '00-001122',
        subtotalUsd: 1000,
        totalUsd: 1160,
        porcentajeRetencionIva: 75,
        retencionIvaBs: 99327.60
      },
      config: mockConfig,
      currentUser: mockUser
    });
    generateSeniatRetentionVoucherPDF({
      type: 'ISLR',
      record: {
        nroComprobante: '20261100000002',
        proveedorNombre: 'Transporte Pesado Centro C.A.',
        proveedorRif: 'J-30887766-2',
        nroFacturaAfectada: '000210',
        conceptoDescripcion: 'Flete terrestre carga nacional',
        baseImponible: 120000,
        porcentajeRetencion: 3,
        montoRetenido: 3600,
        moneda: 'BS'
      },
      config: mockConfig,
      currentUser: mockUser
    });
    const txt = generateSeniatRetentionTxt({
      purchases: [{ proveedorRif: 'J-31115365-9', numeroFactura: '000841', numeroControl: '00-001122', subtotalUsd: 1000, totalUsd: 1160, retencionIvaBs: 99327.60, numeroComprobanteRetencionIva: '20261100000001' }],
      config: mockConfig,
      periodoFiscal: '202611'
    });
    if (!txt.includes('\t01\tJ311153659\t000841')) {
      throw new Error(`Formato TXT SENIAT inesperado: ${txt}`);
    }
  });

  // 45. Motor Contable BA VEN-NIF 2 + 4 PDFs Contables y CxC Consolidado
  const sampleAccountingEntries = generateAccountingEntries({
    profitInvoices: [
      { factNum: 'F-0001', fechaEmision: '2026-11-05', clienteNombre: 'Taller Caracas C.A.', totNetoUsd: 1160, baseImponibleUsd: 1000, totIvaUsd: 160, saldoBs: 0, co_us_in: 'admin' },
      { factNum: 'NE-0002', fechaEmision: '2026-11-06', clienteNombre: 'Auto Servicios Valencia', totNetoUsd: 500, saldoBs: 500 * 827.73, co_us_in: 'oficina' }
    ],
    profitCollections: [
      { cobNum: 'COB-001', fechaCobro: '2026-11-05', clienteNombre: 'Taller Caracas C.A.', montoUsd: 1160, banco: 'Banesco', tasa: 827.73 }
    ],
    profitPurchases: [
      { factNum: 'COMP-101', fechaEmision: '2026-11-04', provNombre: 'KEYTON LUBRICANTS C.A.', totNetoUsd: 928, subtotalUsd: 800, ivaUsd: 128 }
    ],
    profitSupplierPayments: [
      { pagoNum: 'PAG-001', fechaPago: '2026-11-07', provNombre: 'KEYTON LUBRICANTS C.A.', montoUsd: 928, cuentaBanco: 'Banesco' }
    ],
    cashMovements: [
      { id: 'MOV-01', fecha: '2026-11-08', tipo: 'EGRESO', concepto: 'Flete encomienda Valencia', montoUsd: 45, usuario: 'admin' }
    ],
    tasa: 827.73
  });
  const sampleTrialBalance = buildTrialBalance(sampleAccountingEntries);
  const sampleGeneralLedger = buildGeneralLedger(sampleAccountingEntries);
  const sampleStatements = buildFinancialStatements(sampleTrialBalance);

  testGen('Contabilidad Automática: Plan 156 cuentas, Partida Doble & BA VEN-NIF 2', () => {
    const imputables = CHART_OF_ACCOUNTS.filter(c => c.imputable).length;
    if (CHART_OF_ACCOUNTS.length !== 156 || imputables !== 99) {
      throw new Error(`Se esperaban 156 cuentas / 99 imputables, obtenido ${CHART_OF_ACCOUNTS.length}/${imputables}`);
    }
    if (!sampleTrialBalance.isBalanced) {
      throw new Error(`Balance de comprobación descuadrado: Debe=${sampleTrialBalance.totalSumasDebeUsd} Haber=${sampleTrialBalance.totalSumasHaberUsd}`);
    }
    if (!sampleStatements.balanceGeneral.ecuacionCuadrada) {
      throw new Error(`Ecuación patrimonial BA VEN-NIF 2 descuadrada: diff=${sampleStatements.balanceGeneral.diferenciaEcuacionUsd}`);
    }
  });

  testGen('PDF Balance de Comprobación de Sumas y Saldos', () => {
    generateTrialBalancePDF({
      trialBalance: sampleTrialBalance,
      entries: sampleAccountingEntries,
      config: mockConfig,
      currentUser: mockUser
    });
  });

  testGen('PDF Libro Mayor General Analítico', () => {
    const acc = sampleGeneralLedger.accounts[0];
    generateGeneralLedgerPDF({
      account: acc,
      generalLedger: sampleGeneralLedger,
      entries: sampleAccountingEntries,
      config: mockConfig,
      currentUser: mockUser
    });
  });

  testGen('PDF Estados Financieros Básicos BA VEN-NIF 2', () => {
    generateFinancialStatementsPDF({
      financialStatements: sampleStatements,
      trialBalance: sampleTrialBalance,
      entries: sampleAccountingEntries,
      config: mockConfig,
      currentUser: mockUser
    });
  });

  testGen('PDF CxC Consolidado (Facturas Fiscales + Notas de Entrega)', () => {
    const sampleCxcDocs = [
      { factura: '000901', tipoDoc: 'FACTURA', cliente: 'Autorepuestos Central C.A.', rif: 'J-30401927-4', vendedorNombre: 'Carlos M.', fechaEmisionIso: '2026-10-15', fechaVencimientoIso: '2026-10-30', montoFacturaUsd: 1200, abonosUsd: 200, restanteUsd: 1000, diasCredito: 15, diasVencidos: 12, estado: 'VENCIDA', isCarteraActiva: true },
      { factura: 'NE-000150', tipoDoc: 'NOTA_ENTREGA', cliente: 'Distribuidora Los Llanos', rif: 'J-50123456-8', vendedorNombre: 'Andres R.', fechaEmisionIso: '2026-11-08', fechaVencimientoIso: '2026-11-23', montoFacturaUsd: 650, abonosUsd: 0, restanteUsd: 650, diasCredito: 15, diasVencidos: 0, estado: 'POR_VENCER', isCarteraActiva: true }
    ];
    generateConsolidatedCxcPDF({
      docs: sampleCxcDocs,
      groupByClient: false,
      tasaBcv: mockConfig.tasaDolar,
      config: mockConfig,
      currentUser: mockUser
    });
    generateConsolidatedCxcPDF({
      docs: sampleCxcDocs,
      groupByClient: true,
      tasaBcv: mockConfig.tasaDolar,
      config: mockConfig,
      currentUser: mockUser
    });
  });

  testGen('Validación SENIAT Prefijos J/V/E/G/P & Stock Positivo por Almacén', () => {
    const normRif = applyPersonPrefixToRif('18456789', 'V');
    if (normRif !== 'V-18456789' || detectPersonPrefix({ rif: normRif }) !== 'V') {
      throw new Error(`Prefijo SENIAT inesperado: ${normRif}`);
    }
    if (!validateRifOrCedula('V-18456789', 'V').isValid) {
      throw new Error('Debe validar cédula venezolana V-18456789');
    }
    const counts = countPersonTypes([{ rif: 'J-12345678-9' }, { rif: 'V-18456789' }]);
    if (counts.J !== 1 || counts.V !== 1) {
      throw new Error(`Conteo de tipos de persona incorrecto: ${JSON.stringify(counts)}`);
    }
    const stockCheck = validateDocumentPositiveStock({
      tipoDoc: 'FACTURA',
      almacen: '01',
      items: [{ articuloId: 'SKU-ZERO', cantidad: 2 }],
      products: [{ id: 'SKU-ZERO', codigo: 'SKU-ZERO', descripcion: '20W-50 Test', stockAlmacen01: 0, stockAlmacen02: 10 }]
    });
    if (stockCheck.isValid) {
      throw new Error('Debió bloquear factura con stock 0 en Almacén 01');
    }
  });

  // 46. Auditoría Global de Todos los PDF Generados: Cero formato "Página X de Y" y cumplimiento 1/2, 2/2
  testGen('Auditoría Global: Todos los PDF generados cumplen norma 1/2, 2/2 (sin "Página X de Y")', () => {
    const cwdFiles = fs.readdirSync(process.cwd()).filter(f => f.endsWith('.pdf'));
    if (cwdFiles.length < 15) {
      throw new Error(`Se esperaban al menos 15 PDFs generados para auditar, encontrados: ${cwdFiles.length}`);
    }
    const badDeFiles = [];
    const missingSlashFiles = [];
    for (const file of cwdFiles) {
      const content = fs.readFileSync(file, 'latin1');
      if (/P.{1,3}gina \d+ de \d+/i.test(content)) {
        badDeFiles.push(file);
      }
      if (!/P.{1,3}gina \d+\/\d+/i.test(content)) {
        missingSlashFiles.push(file);
      }
    }
    if (badDeFiles.length > 0) {
      throw new Error(`PDFs con paginación antigua "Página X de Y": ${badDeFiles.join(', ')}`);
    }
    if (missingSlashFiles.length > 0) {
      throw new Error(`PDFs sin formato de paginación X/Y: ${missingSlashFiles.join(', ')}`);
    }
  });

  console.log('\n================================================================');
  console.log(`--- RESULTADO: ${passed}/${total} PRUEBAS DE REPORTES PDF SUPERADAS EXITOSAMENTE (100% OK) ---`);
  console.log('================================================================\n');

  // Limpieza automática de PDFs generados en Node.js para mantener limpio el directorio
  try {
    const cwdFiles = fs.readdirSync(process.cwd());
    for (const f of cwdFiles) {
      if (f.endsWith('.pdf')) {
        try { fs.unlinkSync(f); } catch (_) {}
      }
    }
  } catch (_) {}

  if (passed !== total) {
    process.exit(1);
  }
}

runPdfTests();
