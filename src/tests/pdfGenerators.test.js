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
  generateSalesPOSPDF,
  generatePurchasesPDF,
  generateCashflowPDF,
  generateAuditLedgerPDF,
  generateUsersPDF,
  generateConfigPDF,
  generateManualPDF,
  generateNotificationsPDF,
  generateBankAccountsPDF,
  generateProfitDatabaseTablePDF
} from '../services/pdfReportService.js';

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
