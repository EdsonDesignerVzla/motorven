/**
 * Suite de Verificación para los 3 Nuevos Documentos Empresariales y Legales de Venezuela:
 * 1. Solicitud de Línea de Crédito Comercial & Pagaré Mercantil Ejecutivo (Código de Comercio Art. 486)
 * 2. Recibo Individual de Pago de Salario & Beneficios Sociales LOTTT (Art. 106 LOTTT)
 * 3. Comprobante Anual de Retenciones de ISLR - Formulario ARC (Decreto 1.808 Art. 24)
 */

import fs from 'fs';

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

import {
  generateCreditApplicationAndPromissoryNotePDF,
  generatePayrollSlipPDF,
  generateAnnualArcRetentionPDF
} from '../services/pdfReportService.js';

async function runTests() {
  console.log('--- INICIANDO PRUEBAS DE DOCUMENTOS EMPRESARIALES VENEZUELA ---');
  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
    }
  }

  const mockConfig = {
    nombreEmpresa: 'SIGNUM MOTORVEN, C.A.',
    rif: 'J-30401927-4',
    direccion: 'Barquisimeto, Estado Lara',
    telefono: '+58 (251) 269.13.96',
    tasaDolar: 827.73
  };

  const mockUser = {
    nombre: 'Edson Designer',
    username: 'admin',
    rol: 'Administrador Master',
    cargo: 'Gerente General',
    departamento: 'DIRECCIÓN'
  };

  // -------------------------------------------------------------
  // Test 1: Solicitud de Crédito & Pagaré Mercantil Ejecutivo
  // -------------------------------------------------------------
  try {
    const mockClient = {
      nombre: 'INVERSIONES Y REPUESTOS EL VALLE, C.A.',
      rif: 'J-40982314-2',
      responsable: 'Carlos Alberto Mendoza',
      ciRepLegal: 'V-15.489.201',
      cargo: 'Presidente',
      direccion: 'Av. Libertador con Calle 42, Barquisimeto',
      telefonos: '0414-5123456',
      email: 'repuestosvalle@gmail.com',
      ramo: 'Taller Mecánico & Venta de Lubricantes',
      vendedor: 'Marcos Pérez (V-01)',
      diasCredito: 15,
      limiteCreditoUsd: 1500,
      bancoRef: 'Banco Provincial Cuenta Corriente N° 0108-0059-12-0100293847'
    };

    const doc = generateCreditApplicationAndPromissoryNotePDF({
      client: mockClient,
      config: mockConfig,
      currentUser: mockUser
    });

    assert(doc && typeof doc.getNumberOfPages === 'function', '1.1 Genera Pagaré Mercantil con objeto jsPDF válido');
    assert(doc.getNumberOfPages() >= 1, `1.2 Pagaré Mercantil tiene páginas válidas (${doc.getNumberOfPages()} pág.)`);
  } catch (err) {
    console.error('Error en Test 1:', err);
    assert(false, `1.x Falló generación de Pagaré Mercantil: ${err.message}`);
  }

  // -------------------------------------------------------------
  // Test 2: Recibo Individual LOTTT (Art. 106 LOTTT)
  // -------------------------------------------------------------
  try {
    const mockEmployee = {
      id: 'EMP-001',
      cedula: 'V-18.765.432',
      nombre: 'José Gregorio Ramos',
      cargo: 'Asesor Técnico de Ventas',
      departamento: 'VENTAS',
      fechaIngreso: '2023-03-15',
      salarioBaseUsd: 300,
      bonoFijoUsd: 100,
      frecuencia: 'QUINCENAL'
    };

    const mockPayrollItem = {
      periodo: '1ra Quincena Mayo 2026',
      frecuencia: 'QUINCENAL',
      salarioUsd: 150,
      bonoUsd: 50,
      bonoExtraUsd: 25,
      deduccionesUsd: 10,
      fechaPago: '2026-05-15'
    };

    const doc = generatePayrollSlipPDF({
      employee: mockEmployee,
      payrollItem: mockPayrollItem,
      config: mockConfig,
      currentUser: mockUser
    });

    assert(doc && typeof doc.getNumberOfPages === 'function', '2.1 Genera Recibo LOTTT con objeto jsPDF válido');
    assert(doc.getNumberOfPages() >= 1, `2.2 Recibo LOTTT tiene páginas válidas (${doc.getNumberOfPages()} pág.)`);
  } catch (err) {
    console.error('Error en Test 2:', err);
    assert(false, `2.x Falló generación de Recibo LOTTT: ${err.message}`);
  }

  // -------------------------------------------------------------
  // Test 3: Comprobante Anual ARC (Art. 24 Decreto 1.808)
  // -------------------------------------------------------------
  try {
    const mockSupplier = {
      nombre: 'LUBRICANTES Y ADITIVOS KEYSTONE, C.A.',
      rif: 'J-31115365-9',
      direccion: 'Zona Industrial II, Carrera 5, Barquisimeto, Lara'
    };

    const mockRecords = [
      {
        periodoFiscal: '202601',
        proveedorRif: 'J-31115365-9',
        baseImponibleBs: 50000,
        montoRetenidoBs: 1000,
        baseImponibleUsd: 60.40,
        montoRetenidoUsd: 1.20,
        moneda: 'BS'
      },
      {
        periodoFiscal: '202603',
        proveedorRif: 'J-31115365-9',
        baseImponibleBs: 75000,
        montoRetenidoBs: 1500,
        baseImponibleUsd: 90.60,
        montoRetenidoUsd: 1.81,
        moneda: 'BS'
      },
      {
        periodoFiscal: '202605',
        proveedorRif: 'J-31115365-9',
        baseImponibleBs: 120000,
        montoRetenidoBs: 2400,
        baseImponibleUsd: 144.97,
        montoRetenidoUsd: 2.90,
        moneda: 'BS'
      }
    ];

    const doc = generateAnnualArcRetentionPDF({
      supplier: mockSupplier,
      year: 2026,
      retentionRecords: mockRecords,
      config: mockConfig,
      currentUser: mockUser
    });

    assert(doc && typeof doc.getNumberOfPages === 'function', '3.1 Genera Comprobante ARC con objeto jsPDF válido');
    assert(doc.getNumberOfPages() >= 1, `3.2 Comprobante ARC tiene páginas válidas (${doc.getNumberOfPages()} pág.)`);
  } catch (err) {
    console.error('Error en Test 3:', err);
    assert(false, `3.x Falló generación de Comprobante ARC: ${err.message}`);
  }

  // Limpieza de PDFs generados en Node
  try {
    const cwdFiles = fs.readdirSync(process.cwd());
    for (const f of cwdFiles) {
      if (f.endsWith('.pdf')) {
        try { fs.unlinkSync(f); } catch (_) {}
      }
    }
  } catch (_) {}

  console.log(`\n======================================================`);
  console.log(`RESULTADOS: ${passed}/${total} PRUEBAS SUPERADAS EXITOSAMENTE`);
  console.log(`======================================================\n`);

  if (passed !== total) {
    process.exit(1);
  }
}

runTests();
