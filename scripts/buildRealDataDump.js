import fs from 'fs';
import path from 'path';

const stepsBase = 'C:/Users/edson/.gemini/antigravity/brain/d3e165a0-bf91-44e1-b667-f3625375421a/.system_generated/steps';

function parseStep(filePath) {
  const content = fs.readFileSync(path.join(stepsBase, filePath), 'utf8');
  const str = JSON.parse(content).result;
  const startIdx = str.indexOf('[');
  const endIdx = str.lastIndexOf(']');
  return JSON.parse(str.substring(startIdx, endIdx + 1));
}

const rawConfig = [
  {
    id: 1,
    nombre_empresa: "GRUPO MOTORVEN C.A.",
    marca_oficial: "OILSTONE ® por KEYSTONE, C.A.",
    rif: "J-31115365-9",
    direccion: "Zona Industrial III, Carrera 2 con Calle 4, Barquisimeto / Los Ruices, Caracas",
    telefono: "+58 (251) 269.13.964 / +58 (212) 555-8899",
    email: "ventas@keystone.net.ve",
    instagram: "@oilstone_vzla",
    tasa_dolar: "886.22",
    moneda_principal: "USD",
    moneda_secundaria: "Bs.",
    almacen_actual: "ALM-01 Planta Principal Oilstone",
    iva_porcentaje: "16.00",
    igtf_porcentaje: "3.00",
    meta_comercial_litros: "20000.00",
    tasa_keystone: "909.9"
  }
];

const rawSellers = parseStep('102/output.txt')[0].json_agg || [];
const rawProducts = parseStep('108/output.txt')[0].json_agg || [];
const rawClients = parseStep('110/output.txt')[0].json_agg || [];
const rawInvoices = parseStep('112/output.txt')[0].json_agg || [];
const rawCollections = parseStep('114/output.txt')[0].json_agg || [];
const g1 = parseStep('116/output.txt')[0].json_build_object || {};
const g2 = parseStep('118/output.txt')[0].json_build_object || {};

console.log('Data loaded:');
console.log(`- Sellers: ${rawSellers.length}`);
console.log(`- Products: ${rawProducts.length}`);
console.log(`- Clients: ${rawClients.length}`);
console.log(`- Invoices: ${rawInvoices.length}`);
console.log(`- Collections: ${rawCollections.length}`);

// Map config
const mappedConfig = {
  nombreEmpresa: rawConfig[0].nombre_empresa,
  marcaOficial: rawConfig[0].marca_oficial,
  rif: rawConfig[0].rif,
  direccion: rawConfig[0].direccion,
  telefono: rawConfig[0].telefono,
  email: rawConfig[0].email,
  instagram: rawConfig[0].instagram,
  tasaDolar: Number(rawConfig[0].tasa_dolar),
  tasaKeystone: Number(rawConfig[0].tasa_keystone || 909.9),
  monedaPrincipal: rawConfig[0].moneda_principal,
  monedaSecundaria: rawConfig[0].moneda_secundaria,
  almacenActual: rawConfig[0].almacen_actual,
  ivaPorcentaje: Number(rawConfig[0].iva_porcentaje),
  igtfPorcentaje: Number(rawConfig[0].igtf_porcentaje),
  metaComercialLitros: Number(rawConfig[0].meta_comercial_litros),
  aprobadorCreditoDefecto: "Ricardo Sánchez (Gerente General / Dirección)",
  aprobadoresCredito: [
    "Edson Designer (Administrador Master / Dirección)",
    "Ricardo Sánchez (Gerente General / Dirección)",
    "Luiggy Silva (Administración & Finanzas)",
    "José Martínez (Analista de Cobranzas y Crédito)"
  ],
  sonidosNotificacion: true
};

// Map products
const mappedProducts = rawProducts.map(p => ({
  id: p.id,
  codigo: p.codigo,
  oem: p.oem,
  descripcion: p.descripcion,
  marca: p.marca,
  categoria: p.categoria,
  viscosidad: p.viscosidad,
  normaApi: p.norma_api,
  presentacionesDisponibles: p.presentaciones_disponibles,
  unidad: p.unidad,
  litrosPorUnidad: Number(p.litros_por_unidad),
  stock: Number(p.stock || 0),
  comprometido: Number(p.comprometido || 0),
  stockMinimo: Number(p.stock_minimo || 0),
  costoUsd: Number(p.costo_usd || 0),
  precioUsdDetal: Number(p.precio_usd_detal || 0),
  precioUsdMayor: Number(p.precio_usd_mayor || 0),
  aplicaIva: p.aplica_iva,
  colorEtiqueta: p.color_etiqueta,
  imagen: p.imagen,
  especificaciones: p.especificaciones
}));

// Map clients
const mappedClients = rawClients.map(c => ({
  id: c.id,
  codigo: c.codigo || c.id,
  nombre: c.nombre || '',
  rif: c.rif || '',
  telefono: c.telefono || '',
  email: c.email || '',
  direccion: c.direccion || '',
  limiteCreditoUsd: Number(c.limite_credito_usd || 0),
  saldoDeudorUsd: Number(c.saldo_deudor_usd || 0),
  diasCredito: Number(c.dias_credito || 0),
  tipoCliente: c.tipo_cliente || 'Mayorista',
  nit: c.nit || '',
  direccion2: c.direccion2 || '',
  ciudad: c.ciudad || '',
  estado: c.estado || '',
  zip: c.zip || '',
  fax: c.fax || '',
  website: c.website || '',
  responsable: c.responsable || '',
  saldoInicial: Number(c.saldo_inicial || 0),
  descuentoProntoPago: Number(c.descuento_pronto_pago || 0),
  descuentoGlobal: Number(c.descuento_global || 0),
  zonaVenta: c.zona_venta || '',
  segmento: c.segmento || '',
  vendedorAsignado: c.vendedor_asignado || '',
  tipoIva: c.tipo_iva || '1',
  esContribuyente: Boolean(c.es_contribuyente),
  esContribuyenteEspecial: Boolean(c.es_contribuyente_especial),
  porcentajeRetencionEspecial: Number(c.porcentaje_retencion_especial || 0),
  inactivo: Boolean(c.inactivo),
  sinCredito: Boolean(c.sin_credito),
  fechaRegistro: c.fecha_registro,
  ultimaFactura: c.ultima_factura,
  fechaUltimaVenta: c.fecha_ultima_venta,
  montoUltimaVenta: Number(c.monto_ultima_venta || 0),
  comentarios: c.comentarios || ''
}));

// Map sellers
const mappedSellers = rawSellers.map(s => ({
  id: s.id,
  coVen: s.co_ven,
  venDes: s.ven_des,
  cedula: s.cedula || '',
  telefonos: s.telefonos || '',
  direccion: s.direccion || '',
  tipo: s.tipo || 'A',
  comisionPct: Number(s.comision_pct || 3.0),
  metaLitrosMes: Number(s.meta_litros_mes || 3000),
  activo: Boolean(s.activo),
  foto: s.foto || '',
  avatar: s.avatar || '',
  coZon: s.co_zon || '',
  zona: s.zona || '',
  createdAt: s.created_at,
  updatedAt: s.updated_at
}));

// Map invoices
const mappedInvoices = rawInvoices.map(f => ({
  id: f.id,
  factNum: f.fact_num,
  fechaEmision: f.fec_emis,
  fechaVencimiento: f.fec_venc,
  clienteId: f.cliente_id,
  clienteNombre: f.cliente_nombre,
  clienteRif: f.cliente_rif,
  vendedorId: f.vendedor_id,
  totBrutoUsd: Number(f.tot_bruto_usd || 0),
  totBrutoBs: Number(f.tot_bruto_bs || 0),
  ivaUsd: Number(f.iva_usd || 0),
  ivaBs: Number(f.iva_bs || 0),
  totNetoUsd: Number(f.tot_neto_usd || 0),
  totNetoBs: Number(f.tot_neto_bs || 0),
  saldoUsd: Number(f.saldo_usd || 0),
  saldoBs: Number(f.saldo_bs || 0),
  status: f.status,
  anulada: f.anulada,
  formaPago: f.forma_pag,
  totalLitros: Number(f.total_litros || 0),
  totalCajas: Number(f.total_cajas || 0),
  items: f.items || [],
  fechaSincronizacion: f.fecha_sincronizacion
}));

// Map collections
const mappedCollections = rawCollections.map(c => ({
  id: c.id,
  cobNum: c.cob_num,
  fecha: c.fec_cob,
  fechaCobro: c.fec_cob,
  clienteId: c.cliente_id,
  clienteNombre: c.cliente_nombre,
  clienteRif: c.cliente_rif,
  vendedorId: c.vendedor_id,
  montoUsd: Number(c.monto_usd || 0),
  montoBs: Number(c.monto_bs || 0),
  tasa: Number(c.tasa || 1),
  moneda: c.moneda || 'BS',
  descrip: c.descrip || '',
  anulado: Boolean(c.anulado),
  formaPago: c.forma_pag,
  banco: c.banco,
  formasPago: c.formas_pago || [],
  documentosAfectados: c.documentos_afectados || [],
  fechaSincronizacion: c.fecha_sincronizacion
}));

// Map accounts payable
const mappedAccountsPayable = (g1.profit_accounts_payable || []).map(d => ({
  id: d.id,
  tipoDoc: d.tipo_doc,
  nroDoc: d.nro_doc,
  coProv: d.co_prov,
  provNombre: d.prov_nombre,
  provRif: d.prov_rif,
  fechaEmision: d.fec_emis,
  fechaVencimiento: d.fec_venc,
  montoNetUsd: Number(d.monto_net_usd || 0),
  montoNetBs: Number(d.monto_net_bs || 0),
  saldoUsd: Number(d.saldo_usd || 0),
  saldoBs: Number(d.saldo_bs || 0),
  tasa: Number(d.tasa || 1),
  moneda: d.moneda || 'BS',
  anulado: Boolean(d.anulado),
  fechaSincronizacion: d.fecha_sincronizacion
}));

// Map supplier payments
const mappedSupplierPayments = (g1.profit_supplier_payments || []).map(p => ({
  id: p.id,
  pagoNum: p.pago_num,
  fechaPago: p.fec_pago,
  coProv: p.co_prov,
  provNombre: p.prov_nombre,
  provRif: p.prov_rif,
  montoUsd: Number(p.monto_usd || 0),
  montoBs: Number(p.monto_bs || 0),
  tasa: Number(p.tasa || 1),
  moneda: p.moneda || 'BS',
  descrip: p.descrip || '',
  anulado: Boolean(p.anulado),
  fechaSincronizacion: p.fecha_sincronizacion
}));

// Map purchases
const mappedPurchases = (g1.profit_purchases || []).map(p => ({
  id: p.id,
  factNum: p.fact_num,
  facturaProv: p.factura_prov,
  fechaEmision: p.fec_emis,
  fechaVencimiento: p.fec_venc,
  coProv: p.co_prov,
  provNombre: p.prov_nombre,
  provRif: p.prov_rif,
  totBrutoUsd: Number(p.tot_bruto_usd || 0),
  totBrutoBs: Number(p.tot_bruto_bs || 0),
  ivaUsd: Number(p.iva_usd || 0),
  ivaBs: Number(p.iva_bs || 0),
  totNetoUsd: Number(p.tot_neto_usd || 0),
  totNetoBs: Number(p.tot_neto_bs || 0),
  saldoUsd: Number(p.saldo_usd || 0),
  saldoBs: Number(p.saldo_bs || 0),
  status: p.status,
  anulada: p.anulada,
  formaPag: p.forma_pag,
  items: p.items || [],
  fechaSincronizacion: p.fecha_sincronizacion
}));

// Map suppliers
const mappedSuppliers = (g1.profit_suppliers || []).map(s => ({
  id: s.id,
  coProv: s.co_prov,
  provDes: s.prov_des,
  rif: s.rif,
  direccion: s.direccion || '',
  telefonos: s.telefonos || '',
  email: s.email || '',
  saldoBs: Number(s.saldo_bs || 0),
  saldoUsd: Number(s.saldo_usd || 0),
  limiteCredito: Number(s.limite_credito || 0),
  diasCredito: Number(s.dias_credito || 0),
  inactivo: Boolean(s.inactivo)
}));

// Map bank accounts
const mappedBankAccounts = (g1.profit_bank_accounts || []).map(b => ({
  id: b.id,
  coBan: b.co_ban,
  desBan: b.des_ban,
  nroCta: b.nro_cta,
  saldoActual: Number(b.saldo_actual || 0),
  saldoConciliado: Number(b.saldo_conciliado || 0),
  moneda: b.moneda || 'BS',
  fechaActualizacion: b.fecha_actualizacion
}));

// Map cash desks
const mappedCashDesks = (g1.profit_cash_desks || []).map(c => ({
  id: c.id,
  coCaja: c.co_caja,
  descripcion: c.descripcion || c.des_caja,
  desCaja: c.des_caja || c.descripcion,
  moneda: c.moneda || 'BS',
  saldoUsd: Number(c.saldo_usd || 0),
  saldoBs: Number(c.saldo_bs || 0),
  saldoActual: Number(c.saldo_actual || c.saldo_bs || 0),
  responsable: c.responsable || '',
  activa: Boolean(c.activa),
  fechaActualizacion: c.fecha_actualizacion
}));

// Map zones
const mappedZones = (g1.profit_zones || []).map(z => ({
  id: z.id,
  coZon: z.co_zon,
  zonDes: z.zon_des,
  disCen: z.dis_cen,
  createdAt: z.created_at,
  updatedAt: z.updated_at
}));

// Map transports
const mappedTransports = (g1.profit_transports || []).map(t => ({
  id: t.id,
  coTran: t.co_tran,
  desTran: t.des_tran,
  respTra: t.resp_tra,
  createdAt: t.created_at,
  updatedAt: t.updated_at
}));

// Map returns
const mappedReturns = (g1.profit_customer_returns || []).map(r => ({
  id: r.id,
  factNum: r.fact_num,
  fecEmis: r.fec_emis,
  coCli: r.co_cli,
  cliDes: r.cli_des,
  rif: r.rif,
  coVen: r.co_ven,
  venDes: r.ven_des,
  ncNum: r.nc_num,
  status: r.status,
  anulada: r.anulada,
  descrip: r.descrip,
  totBruto: Number(r.tot_bruto) || Number(r.total_neto_usd) || 0,
  totNeto: Number(r.tot_neto) || Number(r.total_neto_usd) || 0,
  iva: Number(r.iva) || 0,
  tasa: Number(r.tasa) || 1,
  totalNetoUsd: Number(r.total_neto_usd || 0),
  totalNetoBs: Number(r.total_neto_bs || 0),
  motivo: r.motivo || '',
  moneda: r.moneda || 'USD',
  coSucu: r.co_sucu,
  coUsIn: r.co_us_in,
  renglones: Array.isArray(r.renglones) ? r.renglones : [],
  items: r.items || [],
  createdAt: r.created_at,
  updatedAt: r.updated_at
}));

// Map adjustments
const mappedAdjustments = (g1.profit_inventory_adjustments || []).map(a => ({
  id: a.id,
  ajueNum: a.ajue_num,
  fecha: a.fecha,
  motivo: a.motivo || '',
  totalCostoUsd: Number(a.total_costo_usd || 0),
  totalCostoBs: Number(a.total_costo_bs || 0),
  anulada: Boolean(a.anulada),
  coSucu: a.co_sucu,
  coUsIn: a.co_us_in,
  totalItems: Number(a.total_items) || 0,
  renglones: Array.isArray(a.renglones) ? a.renglones : [],
  items: a.items || [],
  createdAt: a.created_at,
  updatedAt: a.updated_at
}));

// Map transfers
const mappedTransfers = (g1.profit_warehouse_transfers || []).map(t => ({
  id: t.id,
  trasNum: t.tras_num,
  fecha: t.fecha,
  almOrig: t.alm_orig || t.alm_origen,
  almDest: t.alm_dest || t.alm_destino,
  almOrigen: t.alm_origen || t.alm_orig,
  almDestino: t.alm_destino || t.alm_dest,
  motivo: t.motivo || '',
  confirma: t.confirma,
  anulada: Boolean(t.anulada),
  coSucu: t.co_sucu,
  coUsIn: t.co_us_in,
  totalItems: Number(t.total_items) || 0,
  renglones: Array.isArray(t.renglones) ? t.renglones : [],
  items: t.items || [],
  createdAt: t.created_at,
  updatedAt: t.updated_at
}));

// Map ISLR concepts
const mappedIslrConcepts = (g2.profit_islr_concepts || []).map(c => ({
  id: c.id,
  coIslr: c.co_islr || c.cod_concepto,
  codConcepto: c.cod_concepto || c.co_islr,
  descripcion: c.descripcion || c.islr_des,
  islrDes: c.islr_des || c.descripcion,
  islrDes2: c.islr_des2,
  numeral: c.numeral,
  literal: c.literal,
  porcentajeRetencionPn: Number(c.porcentaje_retencion_pn || 0),
  porcentajeRetencionPj: Number(c.porcentaje_retencion_pj || 0),
  sustraendo: Number(c.sustraendo || 0),
  createdAt: c.created_at,
  updatedAt: c.updated_at
}));

// Map beneficiaries
const mappedBeneficiaries = (g2.profit_beneficiaries || []).map(b => ({
  id: b.id,
  codBen: b.cod_ben,
  benDes: b.ben_des || b.nombre,
  nombre: b.nombre || b.ben_des,
  rif: b.rif,
  direc1: b.direc1,
  telefono: b.telefono,
  tipoPersona: b.tipo_persona || b.tipo_per,
  tipoPer: b.tipo_per || b.tipo_persona,
  createdAt: b.created_at,
  updatedAt: b.updated_at
}));

// Map payment orders
const mappedPaymentOrders = (g2.profit_payment_orders || []).map(o => ({
  id: o.id,
  ordNum: o.ord_num,
  fecha: o.fecha,
  codBen: o.cod_ben || o.beneficiario,
  benDes: o.ben_des || o.beneficiario,
  beneficiario: o.beneficiario || o.ben_des,
  descrip: o.descrip || o.concepto,
  concepto: o.concepto || o.descrip,
  monto: Number(o.monto || o.monto_usd || 0),
  montoUsd: Number(o.monto_usd || o.monto || 0),
  montoBs: Number(o.monto_bs || 0),
  montoRet: Number(o.monto_ret || 0),
  formaPag: o.forma_pag,
  codCta: o.cod_cta,
  cheNum: o.che_num,
  status: o.status,
  anulada: Boolean(o.anulada),
  tasa: Number(o.tasa) || 1,
  moneda: o.moneda,
  coSucu: o.co_sucu,
  createdAt: o.created_at,
  updatedAt: o.updated_at
}));

// Map warehouses
const mappedWarehouses = (g2.profit_warehouses || []).map(w => ({
  id: w.id,
  coAlma: w.co_alma || w.co_alm,
  desAlma: w.des_alma || w.des_alm,
  coAlm: w.co_alm || w.co_alma,
  desAlm: w.des_alm || w.des_alma,
  campo1: w.campo1 || '',
  campo2: w.campo2 || '',
  fechaActualizacion: w.fecha_actualizacion
}));

// Map product lines
const mappedLines = (g2.profit_product_lines || []).map(l => ({
  id: l.id,
  coLin: l.co_lin,
  linDes: l.lin_des,
  campo1: l.campo1 || '',
  fechaActualizacion: l.fecha_actualizacion
}));

// Map product categories
const mappedCategories = (g2.profit_product_categories || []).map(c => ({
  id: c.id,
  coCat: c.co_cat,
  catDes: c.cat_des,
  fechaActualizacion: c.fecha_actualizacion
}));

// Map currencies
const mappedCurrencies = (g2.profit_currencies || []).map(c => ({
  id: c.id,
  coMone: c.co_mone,
  desMone: c.des_mone,
  fechaActualizacion: c.fecha_actualizacion
}));

// Map users
const mappedUsers = (g2.users || []).map(u => ({
  id: u.id,
  name: u.name,
  username: u.username,
  role: u.role,
  cedula: u.cedula || '',
  seller_id: u.seller_id || null,
  active: Boolean(u.active),
  password: u.password || '',
  phone: u.phone || '',
  email: u.email || '',
  avatar: u.avatar || '',
  created_at: u.created_at,
  last_login: u.last_login
}));

// Map orders & items
const orderItems = g2.order_items || [];
const mappedOrders = (g2.orders || []).map(o => {
  const items = orderItems.filter(it => it.order_id === o.id).map(it => ({
    id: it.id,
    productoId: it.producto_id,
    codigo: it.codigo,
    descripcion: it.descripcion,
    cantidad: Number(it.cantidad || 0),
    precioUnitarioUsd: Number(it.precio_unitario_usd || 0),
    totalUsd: Number(it.total_usd || 0),
    litrosTotales: Number(it.litros_totales || 0)
  }));
  return {
    id: o.id,
    numeroOrden: o.numero_orden,
    clienteId: o.cliente_id,
    clienteNombre: o.cliente_nombre,
    clienteRif: o.cliente_rif,
    vendedorId: o.vendedor_id,
    vendedorNombre: o.vendedor_nombre,
    fechaCreacion: o.fecha_creacion,
    fechaEntregaRequerida: o.fecha_entrega_requerida,
    fechaDespacho: o.fecha_despacho,
    status: o.status,
    totalUsd: Number(o.total_usd || 0),
    totalBs: Number(o.total_bs || 0),
    tasaBcv: Number(o.tasa_bcv || 0),
    totalLitros: Number(o.total_litros || 0),
    condicionPago: o.condicion_pago,
    metodoPago: o.metodo_pago,
    direccionDespacho: o.direccion_despacho,
    transportista: o.transportista,
    observaciones: o.observaciones,
    items
  };
});

// Map sales
const mappedSales = (g2.sales || []).map(s => ({
  id: s.id,
  numeroControl: s.numero_control,
  numeroFactura: s.numero_factura,
  fecha: s.fecha,
  clienteId: s.cliente_id,
  clienteNombre: s.cliente_nombre,
  clienteRif: s.cliente_rif,
  tipoVenta: s.tipo_venta,
  vendedorId: s.vendedor_id,
  baseImponibleUsd: Number(s.base_imponible_usd || 0),
  baseImponibleBs: Number(s.base_imponible_bs || 0),
  montoIvaUsd: Number(s.monto_iva_usd || 0),
  montoIvaBs: Number(s.monto_iva_bs || 0),
  montoIgtfUsd: Number(s.monto_igtf_usd || 0),
  montoIgtfBs: Number(s.monto_igtf_bs || 0),
  totalUsd: Number(s.total_usd || 0),
  totalBs: Number(s.total_bs || 0),
  tasaBcv: Number(s.tasa_bcv || 0),
  status: s.status,
  items: s.items || []
}));

// Map native purchases
const mappedNativePurchases = (g2.purchases || []).map(p => ({
  id: p.id,
  numeroFacturaProveedor: p.numero_factura_proveedor,
  numeroControl: p.numero_control,
  proveedorId: p.proveedor_id,
  proveedorNombre: p.proveedor_nombre,
  proveedorRif: p.proveedor_rif,
  fechaEmision: p.fecha_emision,
  fechaRecepcion: p.fecha_recepcion,
  baseImponibleUsd: Number(p.base_imponible_usd || 0),
  baseImponibleBs: Number(p.base_imponible_bs || 0),
  montoIvaUsd: Number(p.monto_iva_usd || 0),
  montoIvaBs: Number(p.monto_iva_bs || 0),
  totalUsd: Number(p.total_usd || 0),
  totalBs: Number(p.total_bs || 0),
  tasaBcv: Number(p.tasa_bcv || 0),
  status: p.status,
  items: p.items || []
}));

// Map native suppliers
const mappedNativeSuppliers = (g2.suppliers || []).map(s => ({
  id: s.id,
  nombre: s.nombre,
  rif: s.rif,
  telefono: s.telefono || '',
  email: s.email || '',
  direccion: s.direccion || '',
  personaContacto: s.persona_contacto || '',
  tipoProveedor: s.tipo_proveedor || 'Nacional'
}));

// Map cash movements
const mappedCashMovements = (g2.cash_movements || []).map(m => ({
  id: m.id,
  fecha: m.fecha,
  tipo: m.tipo,
  categoria: m.categoria,
  montoUsd: Number(m.monto_usd || 0),
  montoBs: Number(m.monto_bs || 0),
  moneda: m.moneda,
  descripcion: m.descripcion,
  referencia: m.referencia,
  cajaOBanco: m.caja_o_banco,
  usuarioId: m.usuario_id
}));

// Map fiscal closures
const mappedFiscalClosures = (g2.fiscal_closures || []).map(c => ({
  id: c.id,
  tipo: c.tipo,
  numeroCierre: Number(c.numero_cierre || 0),
  fecha: c.fecha,
  granTotalHistoricoBs: Number(c.gran_total_historico_bs || 0),
  totalVentasBs: Number(c.total_ventas_bs || 0),
  totalIvaBs: Number(c.total_iva_bs || 0),
  totalIgtfBs: Number(c.total_igtf_bs || 0),
  hashSeguridad: c.hash_seguridad
}));

// Map notifications
const mappedNotifications = (g2.notifications || []).map(n => ({
  id: n.id,
  tipo: n.tipo,
  titulo: n.titulo,
  mensaje: n.mensaje,
  icono: n.icono,
  leido: Boolean(n.leido),
  fecha: n.fecha,
  metadata: n.metadata || {}
}));

// Export file
const outputFilePath = path.resolve('src/data/supabaseRealData.js');
const fileContent = `/**
 * DUMP REAL Y SINCRONIZADO DE LA BASE DE DATOS SUPABASE (PostgreSQL)
 * Generado el: ${new Date().toISOString()}
 * 
 * Contiene datos vivos y completos:
 * - ${mappedClients.length} Clientes reales
 * - ${mappedProducts.length} Productos reales con stock y precios
 * - ${mappedInvoices.length} Facturas de Venta Profit
 * - ${mappedCollections.length} Cobros Profit
 * - ${mappedAccountsPayable.length} Cuentas por Pagar (CxP)
 * - ${mappedSupplierPayments.length} Pagos a Proveedores
 * - ${mappedPurchases.length} Compras Profit
 * - ${mappedSuppliers.length} Proveedores Profit
 * - ${mappedSellers.length} Vendedores con fotos y metas
 * - ${mappedBankAccounts.length} Cuentas Bancarias
 * - ${mappedCashDesks.length} Cajas Chicas
 * - ${mappedZones.length} Zonas
 * - ${mappedTransports.length} Transportes
 * - ${mappedReturns.length} Devoluciones
 * - ${mappedAdjustments.length} Ajustes de Inventario
 * - ${mappedTransfers.length} Traslados
 * - ${mappedUsers.length} Usuarios del Sistema
 * - ${mappedOrders.length} Pedidos
 */

export const REAL_CONFIG = ${JSON.stringify(mappedConfig, null, 2)};
export const REAL_PRODUCTS = ${JSON.stringify(mappedProducts, null, 2)};
export const REAL_CLIENTS = ${JSON.stringify(mappedClients, null, 2)};
export const REAL_PROFIT_SELLERS = ${JSON.stringify(mappedSellers, null, 2)};
export const REAL_PROFIT_INVOICES = ${JSON.stringify(mappedInvoices, null, 2)};
export const REAL_PROFIT_COLLECTIONS = ${JSON.stringify(mappedCollections, null, 2)};
export const REAL_PROFIT_ACCOUNTS_PAYABLE = ${JSON.stringify(mappedAccountsPayable, null, 2)};
export const REAL_PROFIT_SUPPLIER_PAYMENTS = ${JSON.stringify(mappedSupplierPayments, null, 2)};
export const REAL_PROFIT_PURCHASES = ${JSON.stringify(mappedPurchases, null, 2)};
export const REAL_PROFIT_SUPPLIERS = ${JSON.stringify(mappedSuppliers, null, 2)};
export const REAL_PROFIT_BANK_ACCOUNTS = ${JSON.stringify(mappedBankAccounts, null, 2)};
export const REAL_PROFIT_CASH_DESKS = ${JSON.stringify(mappedCashDesks, null, 2)};
export const REAL_PROFIT_ZONES = ${JSON.stringify(mappedZones, null, 2)};
export const REAL_PROFIT_TRANSPORTS = ${JSON.stringify(mappedTransports, null, 2)};
export const REAL_PROFIT_CUSTOMER_RETURNS = ${JSON.stringify(mappedReturns, null, 2)};
export const REAL_PROFIT_INVENTORY_ADJUSTMENTS = ${JSON.stringify(mappedAdjustments, null, 2)};
export const REAL_PROFIT_WAREHOUSE_TRANSFERS = ${JSON.stringify(mappedTransfers, null, 2)};
export const REAL_PROFIT_ISLR_CONCEPTS = ${JSON.stringify(mappedIslrConcepts, null, 2)};
export const REAL_PROFIT_BENEFICIARIES = ${JSON.stringify(mappedBeneficiaries, null, 2)};
export const REAL_PROFIT_PAYMENT_ORDERS = ${JSON.stringify(mappedPaymentOrders, null, 2)};
export const REAL_PROFIT_WAREHOUSES = ${JSON.stringify(mappedWarehouses, null, 2)};
export const REAL_PROFIT_PRODUCT_LINES = ${JSON.stringify(mappedLines, null, 2)};
export const REAL_PROFIT_PRODUCT_CATEGORIES = ${JSON.stringify(mappedCategories, null, 2)};
export const REAL_PROFIT_CURRENCIES = ${JSON.stringify(mappedCurrencies, null, 2)};
export const REAL_USERS = ${JSON.stringify(mappedUsers, null, 2)};
export const REAL_ORDERS = ${JSON.stringify(mappedOrders, null, 2)};
export const REAL_SALES = ${JSON.stringify(mappedSales, null, 2)};
export const REAL_PURCHASES = ${JSON.stringify(mappedNativePurchases, null, 2)};
export const REAL_SUPPLIERS = ${JSON.stringify(mappedNativeSuppliers, null, 2)};
export const REAL_CASH_MOVEMENTS = ${JSON.stringify(mappedCashMovements, null, 2)};
export const REAL_FISCAL_CLOSURES = ${JSON.stringify(mappedFiscalClosures, null, 2)};
export const REAL_NOTIFICATIONS = ${JSON.stringify(mappedNotifications, null, 2)};
`;

fs.writeFileSync(outputFilePath, fileContent, 'utf8');
console.log('Successfully generated src/data/supabaseRealData.js!');
