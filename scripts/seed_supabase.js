import { createClient } from '@supabase/supabase-js';
import {
  INITIAL_CONFIG,
  INITIAL_PRODUCTS,
  INITIAL_CLIENTS,
  INITIAL_SUPPLIERS,
  INITIAL_SALES,
  INITIAL_PURCHASES,
  INITIAL_CASH_MOVEMENTS,
  INITIAL_FISCAL_CLOSURES
} from '../src/data/mockData.js';

const supabaseUrl = 'https://lccnevmjvcxjxesvlmak.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxjY25ldm1qdmN4anhlc3ZsbWFrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5MTY0OTAsImV4cCI6MjEwMDQ5MjQ5MH0.u5iyMytGaemAkOwOgyZVOhGqoxAtCCygCZb0LtLiiEw';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runSeed() {
  console.log("=== INICIANDO SEED EN SUPABASE ===");

  // 1. Config
  try {
    const { data: existingConfig } = await supabase.from('config').select('id').limit(1);
    if (!existingConfig || existingConfig.length === 0) {
      console.log("Sembrando config...");
      const configPayload = {
        id: 1,
        nombre_empresa: INITIAL_CONFIG.nombreEmpresa,
        marca_oficial: INITIAL_CONFIG.marcaOficial,
        rif: INITIAL_CONFIG.rif,
        direccion: INITIAL_CONFIG.direccion,
        telefono: INITIAL_CONFIG.telefono,
        email: INITIAL_CONFIG.email,
        instagram: INITIAL_CONFIG.instagram,
        tasa_dolar: INITIAL_CONFIG.tasaDolar,
        tasa_keystone: INITIAL_CONFIG.tasaKeystone || 38.50,
        moneda_principal: INITIAL_CONFIG.monedaPrincipal,
        moneda_secundaria: INITIAL_CONFIG.monedaSecundaria,
        almacen_actual: INITIAL_CONFIG.almacenActual,
        iva_porcentaje: INITIAL_CONFIG.ivaPorcentaje,
        igtf_porcentaje: INITIAL_CONFIG.igtfPorcentaje,
        meta_comercial_litros: INITIAL_CONFIG.metaComercialLitros
      };
      const { error } = await supabase.from('config').upsert([configPayload]);
      if (error) console.error("Error en config:", error);
      else console.log("Config sembrado exitosamente.");
    } else {
      console.log("Config ya existe (saltando).");
    }
  } catch (e) {
    console.error("Excepción en config:", e);
  }

  // 2. Clients
  try {
    const { data: existingClients } = await supabase.from('clients').select('id').limit(1);
    if (!existingClients || existingClients.length === 0) {
      console.log(`Sembrando ${INITIAL_CLIENTS.length} clientes...`);
      const mappedClients = INITIAL_CLIENTS.map(c => ({
        id: c.id,
        codigo: c.codigo,
        nombre: c.nombre,
        rif: c.rif,
        telefono: c.telefono,
        email: c.email,
        direccion: c.direccion,
        limite_credito_usd: c.limiteCreditoUsd || 0,
        saldo_deudor_usd: c.saldoDeudorUsd || 0,
        dias_credito: c.diasCredito || 0,
        tipo_cliente: c.tipoCliente || 'TALLER'
      }));
      const { error } = await supabase.from('clients').upsert(mappedClients);
      if (error) console.error("Error en clients:", error);
      else console.log("Clientes sembrados exitosamente.");
    } else {
      console.log("Clientes ya existen.");
    }
  } catch (e) {
    console.error("Excepción en clients:", e);
  }

  // 3. Products
  try {
    const { data: existingProducts } = await supabase.from('products').select('id').limit(1);
    if (!existingProducts || existingProducts.length === 0) {
      console.log(`Sembrando ${INITIAL_PRODUCTS.length} productos...`);
      const mappedProducts = INITIAL_PRODUCTS.map(p => ({
        id: p.id,
        codigo: p.codigo,
        oem: p.oem,
        descripcion: p.descripcion,
        marca: p.marca,
        categoria: p.categoria,
        viscosidad: p.viscosidad,
        norma_api: p.normaApi,
        presentaciones_disponibles: p.presentacionesDisponibles || [],
        unidad: p.unidad,
        litros_por_unidad: p.litrosPorUnidad || 0,
        stock: p.stock || 0,
        comprometido: p.comprometido || 0,
        stock_minimo: p.stockMinimo || 0,
        costo_usd: p.costoUsd || 0,
        precio_usd_detal: p.precioUsdDetal || 0,
        precio_usd_mayor: p.precioUsdMayor || 0,
        aplica_iva: p.aplicaIva !== undefined ? p.aplicaIva : true,
        color_etiqueta: p.colorEtiqueta || '#002b7a',
        imagen: p.imagen || '',
        especificaciones: p.especificaciones || {}
      }));
      const { error } = await supabase.from('products').upsert(mappedProducts);
      if (error) console.error("Error en products:", error);
      else console.log("Productos sembrados exitosamente.");
    } else {
      console.log("Productos ya existen.");
    }
  } catch (e) {
    console.error("Excepción en products:", e);
  }

  // 4. Suppliers
  try {
    const { data: existingSuppliers } = await supabase.from('suppliers').select('id').limit(1);
    if (!existingSuppliers || existingSuppliers.length === 0) {
      console.log(`Sembrando ${INITIAL_SUPPLIERS.length} proveedores...`);
      const mappedSuppliers = INITIAL_SUPPLIERS.map(s => ({
        id: s.id,
        codigo: s.codigo,
        nombre: s.nombre,
        rif: s.rif,
        telefono: s.telefono,
        email: s.email,
        direccion: s.direccion,
        saldo_pendiente_usd: s.saldoPendienteUsd || 0
      }));
      const { error } = await supabase.from('suppliers').upsert(mappedSuppliers);
      if (error) console.error("Error en suppliers:", error);
      else console.log("Proveedores sembrados exitosamente.");
    } else {
      console.log("Proveedores ya existen.");
    }
  } catch (e) {
    console.error("Excepción en suppliers:", e);
  }

  // 5. Sales
  try {
    const { data: existingSales } = await supabase.from('sales').select('id').limit(1);
    if (!existingSales || existingSales.length === 0) {
      console.log(`Sembrando ${INITIAL_SALES.length} ventas...`);
      const mappedSales = INITIAL_SALES.map(s => ({
        id: s.id,
        numero_doc: s.numeroDoc || s.numero_doc,
        numero_control: s.numeroControl || '00-000000',
        tipo_doc: s.tipoDoc || 'FACTURA',
        documento_afectado: s.documentoAfectado || '',
        fecha: s.fecha,
        cliente_id: s.clienteId,
        cliente_nombre: s.clienteNombre,
        cliente_rif: s.clienteRif,
        tasa_dolar: s.tasaDolar,
        condicion_pago: s.condicionPago,
        items: s.items || [],
        subtotal_usd: s.subtotalUsd || 0,
        base_exenta_usd: s.baseExentaUsd || 0,
        base_general_usd: s.baseGeneralUsd || s.subtotalUsd || 0,
        iva_general_usd: s.ivaGeneralUsd || s.ivaUsd || 0,
        base_reducida_usd: s.baseReducidaUsd || 0,
        iva_reducida_usd: s.ivaReducidaUsd || 0,
        base_adicional_usd: s.baseAdicionalUsd || 0,
        iva_adicional_usd: s.ivaAdicionalUsd || 0,
        iva_usd: s.ivaUsd || 0,
        igtf_usd: s.igtfUsd || 0,
        total_usd: s.totalUsd || 0,
        subtotal_bs: s.subtotalBs || 0,
        base_exenta_bs: s.baseExentaBs || 0,
        base_general_bs: s.baseGeneralBs || s.subtotalBs || 0,
        iva_general_bs: s.ivaGeneralBs || s.ivaBs || 0,
        base_reducida_bs: s.baseReducidaBs || 0,
        iva_reducida_bs: s.ivaReducidaBs || 0,
        base_adicional_bs: s.baseAdicionalBs || 0,
        iva_adicional_bs: s.ivaAdicionalBs || 0,
        iva_bs: s.ivaBs || 0,
        igtf_bs: s.igtfBs || 0,
        total_bs: s.totalBs || 0,
        retencion_iva_bs: s.retencionIvaBs || 0,
        comprobante_retencion_iva: s.comprobanteRetencionIva || '',
        estado: s.estado,
        metodo_pago: s.metodoPago,
        vendedor: s.vendedor,
        cierre_z_id: s.cierreZId || null,
        cerrada: Boolean(s.cerrada)
      }));
      const { error } = await supabase.from('sales').upsert(mappedSales);
      if (error) console.error("Error en sales:", error);
      else console.log("Ventas sembradas exitosamente.");
    } else {
      console.log("Ventas ya existen.");
    }
  } catch (e) {
    console.error("Excepción en sales:", e);
  }

  // 6. Purchases
  try {
    const { data: existingPurchases } = await supabase.from('purchases').select('id').limit(1);
    if (!existingPurchases || existingPurchases.length === 0) {
      console.log(`Sembrando ${INITIAL_PURCHASES.length} compras...`);
      const mappedPurchases = INITIAL_PURCHASES.map(p => ({
        id: p.id,
        numero_factura_prov: p.numeroFacturaProv,
        numero_control: p.numeroControl || '00-000000',
        tipo_doc: p.tipoDoc || 'FACTURA',
        documento_afectado: p.documentoAfectado || '',
        fecha: p.fecha,
        proveedor_id: p.proveedorId,
        proveedor_nombre: p.proveedorNombre,
        proveedor_rif: p.proveedorRif,
        proveedor_direccion: p.proveedorDireccion || '',
        tasa_dolar: p.tasaDolar || 36.50,
        producto: p.producto,
        cantidad: p.cantidad || 0,
        costo_unitario_usd: p.costoUnitarioUsd || 0,
        subtotal_usd: p.subtotalUsd || 0,
        base_exenta_usd: p.baseExentaUsd || 0,
        base_general_usd: p.baseGeneralUsd || p.subtotalUsd || 0,
        iva_general_usd: p.ivaGeneralUsd || 0,
        total_usd: p.totalUsd || 0,
        subtotal_bs: p.subtotalBs || 0,
        base_exenta_bs: p.baseExentaBs || 0,
        base_general_bs: p.baseGeneralBs || 0,
        iva_general_bs: p.ivaGeneralBs || 0,
        total_bs: p.totalBs || 0,
        retencion_iva_usd: p.retencionIvaUsd || 0,
        retencion_iva_bs: p.retencionIvaBs || 0,
        retencion_islr_usd: p.retencionIslrUsd || 0,
        retencion_islr_bs: p.retencionIslrBs || 0,
        numero_comprobante_retencion_iva: p.numeroComprobanteRetencionIva || '',
        numero_comprobante_retencion_islr: p.numeroComprobanteRetencionIslr || '',
        codigo_concepto_islr: p.codigoConceptoIslr || '055',
        receptor: p.receptor || 'Pedro Gómez'
      }));
      const { error } = await supabase.from('purchases').upsert(mappedPurchases);
      if (error) console.error("Error en purchases:", error);
      else console.log("Compras sembradas exitosamente.");
    } else {
      console.log("Compras ya existen.");
    }
  } catch (e) {
    console.error("Excepción en purchases:", e);
  }

  // 7. Cash Movements
  try {
    const { data: existingCash } = await supabase.from('cash_movements').select('id').limit(1);
    if (!existingCash || existingCash.length === 0) {
      console.log(`Sembrando ${INITIAL_CASH_MOVEMENTS.length} movimientos de caja...`);
      const mappedCash = INITIAL_CASH_MOVEMENTS.map(c => ({
        id: c.id,
        fecha: c.fecha,
        tipo: c.tipo,
        concepto: c.concepto,
        monto_usd: c.montoUsd,
        monto_bs: c.montoBs,
        metodo: c.metodo,
        usuario: c.usuario
      }));
      const { error } = await supabase.from('cash_movements').upsert(mappedCash);
      if (error) console.error("Error en cash_movements:", error);
      else console.log("Movimientos de caja sembrados exitosamente.");
    } else {
      console.log("Movimientos de caja ya existen.");
    }
  } catch (e) {
    console.error("Excepción en cash_movements:", e);
  }

  // 8. Fiscal Closures
  try {
    const { data: existingClosures } = await supabase.from('fiscal_closures').select('id').limit(1);
    if (!existingClosures || existingClosures.length === 0) {
      console.log(`Sembrando ${INITIAL_FISCAL_CLOSURES.length} cierres fiscales...`);
      const mappedClosures = INITIAL_FISCAL_CLOSURES.map(c => ({
        id: c.id,
        tipo: c.tipo || 'REPORTE_Z',
        numero_z: c.numeroZ || 1,
        fecha_apertura: c.fechaApertura,
        fecha_cierre: c.fechaCierre,
        primera_factura: c.primeraFactura || '',
        ultima_factura: c.ultimaFactura || '',
        primera_nc: c.primeraNc || '',
        ultima_nc: c.ultimaNc || '',
        primera_nd: c.primeraNd || '',
        ultima_nd: c.ultimaNd || '',
        cantidad_facturas: c.cantidadFacturas || 0,
        cantidad_nc: c.cantidadNc || 0,
        cantidad_nd: c.cantidadNd || 0,
        total_documentos: c.totalDocumentos || 0,
        ventas_exentas_bs: c.ventasExentasBs || 0,
        base_general_bs: c.baseGeneralBs || 0,
        debito_general_bs: c.debitoGeneralBs || 0,
        base_reducida_bs: c.baseReducidaBs || 0,
        debito_reducido_bs: c.debitoReducidoBs || 0,
        base_adicional_bs: c.baseAdicionalBs || 0,
        debito_adicional_bs: c.debitoAdicionalBs || 0,
        total_debito_fiscal_bs: c.totalDebitoFiscalBs || 0,
        base_igtf_bs: c.baseIgtfBs || 0,
        total_igtf_bs: c.totalIgtfBs || 0,
        total_ventas_bs: c.totalVentasBs || 0,
        total_ventas_usd: c.totalVentasUsd || 0,
        tasa_bcv: c.tasaBcv || 36.50,
        gran_total_historico_bs: c.granTotalHistoricoBs || 0,
        desglose_pagos: c.desglosePagos || {},
        usuario_id: c.usuarioId || 'usr-admin',
        usuario_nombre: c.usuarioNombre || 'Luiggy Silva',
        firma_hash_sha256: c.firmaHashSha256 || ''
      }));
      const { error } = await supabase.from('fiscal_closures').upsert(mappedClosures);
      if (error) console.error("Error en fiscal_closures:", error);
      else console.log("Cierres fiscales sembrados exitosamente.");
    } else {
      console.log("Cierres fiscales ya existen.");
    }
  } catch (e) {
    console.error("Excepción en fiscal_closures:", e);
  }

  console.log("=== SEED COMPLETADO ===");
}

runSeed().catch(console.error);
