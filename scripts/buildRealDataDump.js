import fs from 'fs';
import path from 'path';

const dbPath = path.resolve('supabase/local_database.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

const BCV_RATE = Number(db.config?.[0]?.tasa_dolar || db.config?.[0]?.tasaDolar || 886.22);
const KEYSTONE_RATE = Number(db.config?.[0]?.tasa_keystone || db.config?.[0]?.tasaKeystone || 909.9);
const NOW_ISO = new Date().toISOString();

// 1. Clean & normalize config
const rawCfg = db.config?.[0] || {};
const cleanConfigRow = {
  id: 1,
  nombre_empresa: rawCfg.nombre_empresa || rawCfg.nombreEmpresa || 'GRUPO MOTORVEN C.A.',
  nombreEmpresa: rawCfg.nombreEmpresa || rawCfg.nombre_empresa || 'GRUPO MOTORVEN C.A.',
  marca_oficial: rawCfg.marca_oficial || rawCfg.marcaOficial || 'OILSTONE ® por KEYSTONE, C.A.',
  marcaOficial: rawCfg.marcaOficial || rawCfg.marca_oficial || 'OILSTONE ® por KEYSTONE, C.A.',
  rif: rawCfg.rif || 'J-31115365-9',
  direccion: rawCfg.direccion || 'Zona Industrial III, Carrera 2 con Calle 4, Barquisimeto / Los Ruices, Caracas',
  telefono: rawCfg.telefono || '+58 (251) 269.13.964 / +58 (212) 555-8899',
  email: rawCfg.email || 'ventas@keystone.net.ve',
  instagram: rawCfg.instagram || '@oilstone_vzla',
  tasa_dolar: BCV_RATE,
  tasaDolar: BCV_RATE,
  tasa_keystone: KEYSTONE_RATE,
  tasaKeystone: KEYSTONE_RATE,
  moneda_principal: rawCfg.moneda_principal || rawCfg.monedaPrincipal || 'USD',
  monedaPrincipal: rawCfg.monedaPrincipal || rawCfg.moneda_principal || 'USD',
  moneda_secundaria: rawCfg.moneda_secundaria || rawCfg.monedaSecundaria || 'Bs.',
  monedaSecundaria: rawCfg.monedaSecundaria || rawCfg.moneda_secundaria || 'Bs.',
  almacen_actual: rawCfg.almacen_actual || rawCfg.almacenActual || 'ALM-01 Planta Principal Oilstone',
  almacenActual: rawCfg.almacenActual || rawCfg.almacen_actual || 'ALM-01 Planta Principal Oilstone',
  iva_porcentaje: Number(rawCfg.iva_porcentaje ?? rawCfg.ivaPorcentaje ?? 16),
  ivaPorcentaje: Number(rawCfg.ivaPorcentaje ?? rawCfg.iva_porcentaje ?? 16),
  igtf_porcentaje: Number(rawCfg.igtf_porcentaje ?? rawCfg.igtfPorcentaje ?? 3),
  igtfPorcentaje: Number(rawCfg.igtfPorcentaje ?? rawCfg.igtf_porcentaje ?? 3),
  meta_comercial_litros: Number(rawCfg.meta_comercial_litros ?? rawCfg.metaComercialLitros ?? 20000),
  metaComercialLitros: Number(rawCfg.metaComercialLitros ?? rawCfg.meta_comercial_litros ?? 20000),
  aprobador_credito_defecto: rawCfg.aprobador_credito_defecto || rawCfg.aprobadorCreditoDefecto || 'Ricardo Sánchez (Gerente General / Dirección)',
  aprobadorCreditoDefecto: rawCfg.aprobadorCreditoDefecto || rawCfg.aprobador_credito_defecto || 'Ricardo Sánchez (Gerente General / Dirección)',
  aprobadores_credito: rawCfg.aprobadores_credito || rawCfg.aprobadoresCredito || [
    'Edson Designer (Administrador Master / Dirección)',
    'Ricardo Sánchez (Gerente General / Dirección)',
    'Luiggy Silva (Administración & Finanzas)',
    'José Martínez (Analista de Cobranzas y Crédito)'
  ],
  aprobadoresCredito: rawCfg.aprobadoresCredito || rawCfg.aprobadores_credito || [
    'Edson Designer (Administrador Master / Dirección)',
    'Ricardo Sánchez (Gerente General / Dirección)',
    'Luiggy Silva (Administración & Finanzas)',
    'José Martínez (Analista de Cobranzas y Crédito)'
  ],
  sonidos_notificacion: rawCfg.sonidos_notificacion !== undefined ? Boolean(rawCfg.sonidos_notificacion) : true,
  sonidosNotificacion: rawCfg.sonidosNotificacion !== undefined ? Boolean(rawCfg.sonidosNotificacion) : true,
  updated_at: rawCfg.updated_at || NOW_ISO
};
db.config = [cleanConfigRow];

// 2. Clean & normalize products (29 canonical Profit SKUs available in Almacén 01 and Almacén 02)
const existingWhRowsByKey = new Map();
for (const row of (db.profit_stock_by_warehouse || [])) {
  if (!row) continue;
  const art = String(row.co_art || row.codigo || (row.id ? String(row.id).split('_')[0] : '')).trim();
  const alm = String(row.co_alma || row.coAlma || (row.id ? String(row.id).split('_')[1] : '')).trim().padStart(2, '0');
  if (art && alm) {
    existingWhRowsByKey.set(`${art}_${alm}`, row);
  }
}

const defaultPailaImg = (db.products || []).find(x => x && x.id === '000704' && x.imagen)?.imagen || null;
const seenProdIds = new Set();
db.products = (db.products || [])
  .filter(p => p && p.id && !String(p.id).startsWith('OIL-') && !seenProdIds.has(p.id) && seenProdIds.add(p.id))
  .map(p => {
    const prodId = String(p.id).trim();
    const litrosPorUnidad = Number(p.litros_por_unidad ?? p.litrosPorUnidad ?? 1);
    const rawStock = Number(p.stock ?? 0);
    const comprometido = Number(p.comprometido ?? 0);
    const stockMinimo = Number(p.stock_minimo ?? p.stockMinimo ?? 10);
    const costoUsd = Number(p.costo_usd ?? p.costoUsd ?? 0);
    const precioUsdDetal = Number(p.precio_usd_detal ?? p.precioUsdDetal ?? 0);
    const precioUsdMayor = Number(p.precio_usd_mayor ?? p.precioUsdMayor ?? precioUsdDetal);
    const normaApi = p.norma_api ?? p.normaApi ?? 'N/A';
    const presentaciones = p.presentaciones_disponibles || p.presentacionesDisponibles || [p.unidad || 'Caja'];
    const aplicaIva = p.aplica_iva !== undefined ? Boolean(p.aplica_iva) : (p.aplicaIva !== undefined ? Boolean(p.aplicaIva) : true);
    const colorEtiqueta = p.color_etiqueta || p.colorEtiqueta || '#D4AF37';
    const coLin = p.co_lin || p.coLin || 'LUB-GAS';
    const coSubl = p.co_subl || p.coSubl || 'MIN-GAS';
    const coCat = p.co_cat || p.coCat || 'TERM-01';
    const prodImg = p.imagen || (prodId === '000308' ? defaultPailaImg : null);

    const wh01Row = existingWhRowsByKey.get(`${prodId}_01`);
    const wh02Row = existingWhRowsByKey.get(`${prodId}_02`);
    const hasWhRows = wh01Row !== undefined || wh02Row !== undefined;

    const stockAlm01 = hasWhRows
      ? Number(wh01Row?.stock_act ?? wh01Row?.stockAct ?? 0)
      : Number(p.stockAlmacen01 ?? p.stock_almacen_01 ?? Math.round(rawStock * 0.4));
    const stockAlm02 = hasWhRows
      ? Number(wh02Row?.stock_act ?? wh02Row?.stockAct ?? 0)
      : Number(p.stockAlmacen02 ?? p.stock_almacen_02 ?? Math.max(0, rawStock - stockAlm01));
    const stock = hasWhRows ? (stockAlm01 + stockAlm02) : rawStock;

    return {
      ...p,
      id: prodId,
      codigo: String(p.codigo || prodId).trim(),
      oem: p.oem || `KEY-${prodId}`,
      descripcion: p.descripcion || '',
      marca: p.marca || 'OILSTONE',
      categoria: p.categoria || 'Motor a Gasolina',
      viscosidad: p.viscosidad || 'N/A',
      norma_api: normaApi,
      normaApi,
      presentaciones_disponibles: presentaciones,
      presentacionesDisponibles: presentaciones,
      unidad: p.unidad || 'Caja',
      litros_por_unidad: litrosPorUnidad,
      litrosPorUnidad,
      stock,
      comprometido,
      stock_minimo: stockMinimo,
      stockMinimo,
      stockAlmacen01: stockAlm01,
      stock_almacen_01: stockAlm01,
      stockAlmacen02: stockAlm02,
      stock_almacen_02: stockAlm02,
      costo_usd: costoUsd,
      costoUsd,
      precio_usd_detal: precioUsdDetal,
      precioUsdDetal,
      precio_usd_mayor: precioUsdMayor,
      precioUsdMayor,
      aplica_iva: aplicaIva,
      aplicaIva,
      color_etiqueta: colorEtiqueta,
      colorEtiqueta,
      imagen: prodImg,
      especificaciones: p.especificaciones || {},
      co_lin: coLin,
      coLin,
      co_subl: coSubl,
      coSubl,
      co_cat: coCat,
      coCat,
      almacen: '01: ALMACÉN PRINCIPAL / MOSTRADOR | 02: ALMACÉN CENTRAL / BÓVEDA',
      co_alm: '01,02',
      coAlm: '01,02',
      almacenes: ['01', '02'],
      ubicacion: '01: Almacén Principal • 02: Almacén Central'
    };
  });

// 2b. Clean & normalize profit_warehouses (only Almacén 01 and Almacén 02; remove Almacén 03)
db.profit_warehouses = [
  {
    id: 'ALM-01',
    coAlma: '01',
    co_alma: '01',
    desAlma: 'ALMACÉN PRINCIPAL / MOSTRADOR',
    des_alma: 'ALMACÉN PRINCIPAL / MOSTRADOR',
    coAlm: '01',
    co_alm: '01',
    desAlm: 'ALMACÉN PRINCIPAL / MOSTRADOR',
    des_alm: 'ALMACÉN PRINCIPAL / MOSTRADOR',
    campo1: 'Tienda & Despacho Inmediato',
    campo2: '',
    fechaActualizacion: '2026-10-22T04:16:48.076168+00:00'
  },
  {
    id: 'ALM-02',
    coAlma: '02',
    co_alma: '02',
    desAlma: 'ALMACÉN CENTRAL / BÓVEDA',
    des_alma: 'ALMACÉN CENTRAL / BÓVEDA',
    coAlm: '02',
    co_alm: '02',
    desAlm: 'ALMACÉN CENTRAL / BÓVEDA',
    des_alm: 'ALMACÉN CENTRAL / BÓVEDA',
    campo1: 'Custodia de Tambores y Paletas',
    campo2: '',
    fechaActualizacion: '2026-10-22T04:16:48.076168+00:00'
  }
];

// 2c. Sync profit_stock_by_warehouse preserving real stock and timestamps from the server
db.profit_stock_by_warehouse = db.products.flatMap(p => {
  const prev01 = existingWhRowsByKey.get(`${p.id}_01`);
  const prev02 = existingWhRowsByKey.get(`${p.id}_02`);
  return [
    {
      id: `${p.id}_01`,
      co_art: p.id,
      codigo: p.codigo,
      oem: p.oem,
      descripcion: p.descripcion,
      marca: p.marca,
      categoria: p.categoria,
      viscosidad: p.viscosidad,
      unidad: p.unidad,
      litros_por_unidad: p.litrosPorUnidad,
      costo_usd: p.costoUsd,
      precio_usd_detal: p.precioUsdDetal,
      precio_usd_mayor: p.precioUsdMayor,
      imagen: p.imagen,
      co_alma: '01',
      alma_des: 'ALMACÉN PRINCIPAL / MOSTRADOR',
      stock_act: Number(p.stockAlmacen01 ?? p.stock_almacen_01 ?? 0),
      stock_com: Number(prev01?.stock_com ?? p.comprometido ?? 0),
      stock_lle: Number(prev01?.stock_lle ?? 0),
      stock_des: Number(prev01?.stock_des ?? 0),
      updated_at: prev01?.updated_at || NOW_ISO
    },
    {
      id: `${p.id}_02`,
      co_art: p.id,
      codigo: p.codigo,
      oem: p.oem,
      descripcion: p.descripcion,
      marca: p.marca,
      categoria: p.categoria,
      viscosidad: p.viscosidad,
      unidad: p.unidad,
      litros_por_unidad: p.litrosPorUnidad,
      costo_usd: p.costoUsd,
      precio_usd_detal: p.precioUsdDetal,
      precio_usd_mayor: p.precioUsdMayor,
      imagen: p.imagen,
      co_alma: '02',
      alma_des: 'ALMACÉN CENTRAL / BÓVEDA',
      stock_act: Number(p.stockAlmacen02 ?? p.stock_almacen_02 ?? 0),
      stock_com: Number(prev02?.stock_com ?? p.comprometido ?? 0),
      stock_lle: Number(prev02?.stock_lle ?? 0),
      stock_des: Number(prev02?.stock_des ?? 0),
      updated_at: prev02?.updated_at || NOW_ISO
    }
  ];
});

// 3. Clean & normalize clients (631 clients)
const seenClientIds = new Set();
db.clients = (db.clients || [])
  .filter(c => c && c.id && !seenClientIds.has(c.id) && seenClientIds.add(c.id))
  .map(c => {
    const limiteCreditoUsd = Number(c.limite_credito_usd ?? c.limiteCreditoUsd ?? 0);
    const saldoDeudorUsd = Number(c.saldo_deudor_usd ?? c.saldoDeudorUsd ?? 0);
    const diasCredito = Number(c.dias_credito ?? c.diasCredito ?? 0);
    const tipoCliente = c.tipo_cliente || c.tipoCliente || 'Mayorista';
    const saldoInicial = Number(c.saldo_inicial ?? c.saldoInicial ?? 0);
    const descuentoProntoPago = Number(c.descuento_pronto_pago ?? c.descuentoProntoPago ?? 0);
    const descuentoGlobal = Number(c.descuento_global ?? c.descuentoGlobal ?? 0);
    const zonaVenta = c.zona_venta ?? c.zonaVenta ?? '';
    const vendedorAsignado = c.vendedor_asignado ?? c.vendedorAsignado ?? '';
    const tipoIva = c.tipo_iva ?? c.tipoIva ?? '1';
    const esContribuyente = Boolean(c.es_contribuyente ?? c.esContribuyente ?? true);
    const esContribuyenteEspecial = Boolean(c.es_contribuyente_especial ?? c.esContribuyenteEspecial ?? false);
    const porcentajeRetencion = Number(c.porcentaje_retencion_especial ?? c.porcentajeRetencionEspecial ?? 75);
    const inactivo = Boolean(c.inactivo ?? false);
    const sinCredito = Boolean(c.sin_credito ?? c.sinCredito ?? false);
    const fechaRegistro = c.fecha_registro ?? c.fechaRegistro ?? null;
    const ultimaFactura = c.ultima_factura ?? c.ultimaFactura ?? null;
    const fechaUltimaVenta = c.fecha_ultima_venta ?? c.fechaUltimaVenta ?? null;
    const montoUltimaVenta = Number(c.monto_ultima_venta ?? c.montoUltimaVenta ?? 0);
    return {
      ...c,
      id: String(c.id).trim(),
      codigo: String(c.codigo || c.id).trim(),
      nombre: c.nombre || '',
      rif: c.rif || '',
      telefono: c.telefono || '',
      email: c.email || '',
      direccion: c.direccion || '',
      limite_credito_usd: limiteCreditoUsd,
      limiteCreditoUsd,
      saldo_deudor_usd: saldoDeudorUsd,
      saldoDeudorUsd,
      dias_credito: diasCredito,
      diasCredito,
      tipo_cliente: tipoCliente,
      tipoCliente,
      nit: c.nit || '',
      direccion2: c.direccion2 || '',
      ciudad: c.ciudad || '',
      estado: c.estado || '',
      zip: c.zip || '',
      fax: c.fax || '',
      website: c.website || '',
      responsable: c.responsable || '',
      saldo_inicial: saldoInicial,
      saldoInicial,
      descuento_pronto_pago: descuentoProntoPago,
      descuentoProntoPago,
      descuento_global: descuentoGlobal,
      descuentoGlobal,
      zona_venta: zonaVenta,
      zonaVenta,
      segmento: c.segmento || '',
      vendedor_asignado: vendedorAsignado,
      vendedorAsignado,
      tipo_iva: tipoIva,
      tipoIva,
      es_contribuyente: esContribuyente,
      esContribuyente,
      es_contribuyente_especial: esContribuyenteEspecial,
      esContribuyenteEspecial,
      porcentaje_retencion_especial: porcentajeRetencion,
      porcentajeRetencionEspecial: porcentajeRetencion,
      inactivo,
      sin_credito: sinCredito,
      sinCredito,
      fecha_registro: fechaRegistro,
      fechaRegistro,
      ultima_factura: ultimaFactura,
      ultimaFactura,
      fecha_ultima_venta: fechaUltimaVenta,
      fechaUltimaVenta,
      monto_ultima_venta: montoUltimaVenta,
      montoUltimaVenta,
      comentarios: c.comentarios || ''
    };
  });

// 4. Clean & normalize profit_sellers (10 canonical sellers)
const seenSellerCodes = new Set();
db.profit_sellers = (db.profit_sellers || [])
  .filter(s => {
    if (!s) return false;
    const code = String(s.co_ven || s.coVen || s.id || '').trim().toUpperCase();
    if (!code || code.startsWith('USR-')) return false;
    if (seenSellerCodes.has(code)) return false;
    seenSellerCodes.add(code);
    return true;
  })
  .map(s => {
    const coVen = String(s.co_ven || s.coVen || s.id).trim().toUpperCase();
    const venDes = String(s.ven_des || s.venDes || coVen).trim();
    const comisionPct = Number(s.comision_pct ?? s.comisionPct ?? 3);
    const metaLitrosMes = Number(s.meta_litros_mes ?? s.metaLitrosMes ?? 2000);
    const coZon = String(s.co_zon || s.coZon || '').trim();
    const zona = String(s.zona || '').trim();
    const createdAt = s.created_at || s.createdAt || NOW_ISO;
    const updatedAt = s.updated_at || s.updatedAt || NOW_ISO;
    return {
      id: coVen,
      co_ven: coVen,
      coVen,
      ven_des: venDes,
      venDes,
      cedula: s.cedula || '',
      telefonos: s.telefonos || '',
      direccion: s.direccion || '',
      tipo: s.tipo || 'A',
      comision_pct: comisionPct,
      comisionPct,
      meta_litros_mes: metaLitrosMes,
      metaLitrosMes,
      activo: s.activo !== undefined ? Boolean(s.activo) : true,
      foto: s.foto || '',
      avatar: s.avatar || '',
      co_zon: coZon,
      coZon,
      zona,
      created_at: createdAt,
      createdAt,
      updated_at: updatedAt,
      updatedAt
    };
  });

const validSellerCodes = new Set(db.profit_sellers.map(s => s.coVen));

// 5. Clean & normalize users (22 canonical users, zero orphaned seller codes or broken external avatars)
const seenUserIds = new Set();
db.users = (db.users || [])
  .filter(u => {
    if (!u || !u.username) return false;
    const uname = String(u.username).trim().toLowerCase();
    if (!uname || uname === 'sysadmin' || uname.startsWith('autotest_')) return false;
    if (seenUserIds.has(u.id)) return false;
    seenUserIds.add(u.id);
    return true;
  })
  .map(u => {
    const rawCoVen = String(u.co_ven || u.coVen || u.seller_id || '').trim().replace(/^usr-seller-/i, '').toUpperCase();
    const validCoVen = validSellerCodes.has(rawCoVen) ? rawCoVen : null;
    const rawFoto = u.foto || u.photo_url || u.photoUrl || null;
    const cleanFoto = (typeof rawFoto === 'string' && rawFoto.includes('api.dicebear.com')) ? null : rawFoto;
    const nombre = u.nombre || u.name || u.username;
    const rol = u.rol || u.role || 'SOLO LECTURA';
    const telefono = u.telefono || u.phone || '';
    const activo = u.activo !== undefined ? Boolean(u.activo) : (u.active !== undefined ? Boolean(u.active) : true);
    const ultimoAcceso = u.ultimo_acceso || u.ultimoAcceso || u.last_login || null;
    const createdAt = u.created_at || u.createdAt || NOW_ISO;
    const updatedAt = u.updated_at || u.updatedAt || NOW_ISO;
    return {
      id: u.id,
      username: String(u.username).trim().toLowerCase(),
      nombre,
      name: nombre,
      rol,
      role: rol,
      cedula: u.cedula || '',
      email: u.email || '',
      telefono,
      phone: telefono,
      cargo: u.cargo || rol,
      departamento: u.departamento || 'Operaciones',
      co_ven: validCoVen,
      coVen: validCoVen,
      seller_id: validCoVen,
      activo,
      active: activo,
      password: u.password || '123456',
      foto: cleanFoto,
      photo_url: cleanFoto,
      photoUrl: cleanFoto,
      avatar: u.avatar || 'crown',
      modulos: Array.isArray(u.modulos) ? u.modulos : ['ALL'],
      ultimo_acceso: ultimoAcceso,
      ultimoAcceso,
      last_login: ultimoAcceso,
      created_at: createdAt,
      createdAt,
      updated_at: updatedAt,
      updatedAt
    };
  });

// 6. Clean user_activity_logs (remove all autotest_* and temporary test user logs)
db.user_activity_logs = (db.user_activity_logs || [])
  .filter(l => {
    if (!l) return false;
    const uname = String(l.username || '').toLowerCase();
    const uNombre = String(l.user_nombre || l.userNombre || '').toLowerCase();
    const det = String(l.detalles || '').toLowerCase();
    if (
      uname.startsWith('autotest_') ||
      uNombre.startsWith('autotest_') ||
      det.includes('autotest_') ||
      det.includes('usuario temporal de test') ||
      det.includes('prueba automatizada') ||
      det.includes('@undefined')
    ) {
      return false;
    }
    return true;
  })
  .map(l => ({
    id: l.id,
    user_id: l.user_id || l.userId || null,
    userId: l.userId || l.user_id || null,
    username: l.username || 'sistema',
    user_nombre: l.user_nombre || l.userNombre || l.username || 'Sistema',
    userNombre: l.userNombre || l.user_nombre || l.username || 'Sistema',
    user_rol: l.user_rol || l.userRol || 'SISTEMA',
    userRol: l.userRol || l.user_rol || 'SISTEMA',
    accion: l.accion || 'EVENTO',
    modulo: l.modulo || 'SISTEMA',
    detalles: l.detalles || '',
    ip: l.ip || '127.0.0.1',
    dispositivo: l.dispositivo || 'Web Browser',
    created_at: l.created_at || l.fecha || NOW_ISO,
    fecha: l.fecha || l.created_at || NOW_ISO
  }));

// 7. Deduplicate & normalize profit_transports (1,908 -> 2 unique rows)
const seenTransports = new Set();
db.profit_transports = (db.profit_transports || [])
  .filter(t => {
    if (!t) return false;
    const code = String(t.co_tran || t.coTran || t.id || '').replace(/^TRAN-/, '').trim();
    if (!code || seenTransports.has(code)) return false;
    seenTransports.add(code);
    return true;
  })
  .map(t => {
    const coTran = String(t.co_tran || t.coTran || t.id || '').replace(/^TRAN-/, '').trim();
    const desTran = String(t.des_tran || t.desTran || '').trim();
    const respTra = String(t.resp_tra ?? t.respTra ?? '').trim();
    const createdAt = t.created_at || t.createdAt || NOW_ISO;
    const updatedAt = t.updated_at || t.updatedAt || NOW_ISO;
    return {
      id: `TRAN-${coTran}`,
      co_tran: coTran,
      coTran,
      des_tran: desTran,
      desTran,
      resp_tra: respTra,
      respTra,
      created_at: createdAt,
      createdAt,
      updated_at: updatedAt,
      updatedAt
    };
  });

// 8. Normalize order_items and orders (13 orders, 24 order_items)
const productsById = new Map(db.products.map(p => [p.id, p]));
db.order_items = (db.order_items || []).map(it => {
  const artId = String(it.articulo_id || it.articuloId || it.producto_id || it.productoId || it.codigo || '').trim();
  const prod = productsById.get(artId);
  const desc = it.articulo_descripcion || it.articuloDescripcion || it.descripcion || prod?.descripcion || '';
  const unidad = it.unidad_venta || it.unidadVenta || prod?.unidad || 'CAJA';
  const cantidad = Number(it.cantidad || 0);
  const litrosUnit = Number(it.litros_unitarios ?? it.litrosUnitarios ?? prod?.litrosPorUnidad ?? 12);
  const litrosTot = Number(it.litros_totales ?? it.litrosTotales ?? (cantidad * litrosUnit));
  const precioUnit = Number(it.precio_unitario_usd ?? it.precioUnitarioUsd ?? 0);
  const totalUsd = Number(it.total_usd ?? it.totalUsd ?? (cantidad * precioUnit));
  const rengNum = Number(it.reng_num ?? it.rengNum ?? 1);
  const orderId = it.order_id || it.orderId;
  return {
    id: it.id || `${orderId}-R${rengNum}`,
    order_id: orderId,
    orderId,
    reng_num: rengNum,
    rengNum,
    articulo_id: artId,
    articuloId: artId,
    producto_id: artId,
    productoId: artId,
    codigo: artId,
    articulo_descripcion: desc,
    articuloDescripcion: desc,
    descripcion: desc,
    unidad_venta: unidad,
    unidadVenta: unidad,
    cantidad,
    litros_unitarios: litrosUnit,
    litrosUnitarios: litrosUnit,
    litros_totales: litrosTot,
    litrosTotales: litrosTot,
    precio_unitario_usd: precioUnit,
    precioUnitarioUsd: precioUnit,
    total_usd: totalUsd,
    totalUsd
  };
});

db.orders = (db.orders || []).map(o => {
  const joinedItems = db.order_items.filter(it => it.order_id === o.id);
  const items = joinedItems.length > 0 ? joinedItems : (o.items || []);
  const numeroPedido = o.numero_pedido || o.numeroPedido || o.numeroOrden || o.numero_orden || o.id;
  const fechaEmision = o.fecha_emision || o.fechaEmision || o.fechaCreacion || o.fecha_creacion || NOW_ISO;
  const fechaEntrega = o.fecha_entrega || o.fechaEntrega || o.fechaEntregaRequerida || o.fecha_entrega_requerida || fechaEmision;
  const clienteId = o.cliente_id || o.clienteId || '';
  const clienteNombre = o.cliente_nombre || o.clienteNombre || '';
  const clienteRif = o.cliente_rif || o.clienteRif || '';
  const vendedorId = o.vendedor_id || o.vendedorId || '';
  const vendedorNombre = o.vendedor_nombre || o.vendedorNombre || '';
  const almacenId = o.almacen_id || o.almacenId || '01';
  const condicionPago = o.condicion_pago || o.condicionPago || 'Contado';
  const diasCredito = Number(o.dias_credito ?? o.diasCredito ?? 0);
  const moneda = o.moneda || 'USD';
  const tasaCambio = Number(o.tasa_cambio ?? o.tasaCambio ?? o.tasaBcv ?? o.tasa_bcv ?? BCV_RATE);
  const subtotalUsd = Number(o.subtotal_usd ?? o.subtotalUsd ?? o.totalUsd ?? o.total_usd ?? 0);
  const descuentoGlobalPct = Number(o.descuento_global_pct ?? o.descuentoGlobalPct ?? 0);
  const descuentoUsd = Number(o.descuento_usd ?? o.descuentoUsd ?? 0);
  const baseImponibleUsd = Number(o.base_imponible_usd ?? o.baseImponibleUsd ?? subtotalUsd);
  const aplicaIva = o.aplica_iva !== undefined ? Boolean(o.aplica_iva) : (o.aplicaIva !== undefined ? Boolean(o.aplicaIva) : false);
  const ivaPorcentaje = Number(o.iva_porcentaje ?? o.ivaPorcentaje ?? 16);
  const ivaUsd = Number(o.iva_usd ?? o.ivaUsd ?? 0);
  const totalUsd = Number(o.total_usd ?? o.totalUsd ?? subtotalUsd);
  const totalBs = Number(o.total_bs ?? o.totalBs ?? (totalUsd * tasaCambio));
  const totalLitros = Number(o.total_litros ?? o.totalLitros ?? items.reduce((s, i) => s + Number(i.litrosTotales || 0), 0));
  const totalUnidades = Number(o.total_unidades ?? o.totalUnidades ?? items.reduce((s, i) => s + Number(i.cantidad || 0), 0));
  const estado = o.estado || o.status || 'Aprobado';
  const observaciones = o.observaciones || '';
  const creadoPor = o.creado_por || o.creadoPor || vendedorNombre || 'Sistema';
  const aprobadoPor = o.aprobado_por ?? o.aprobadoPor ?? null;
  const fechaAprobacion = o.fecha_aprobacion ?? o.fechaAprobacion ?? null;
  const motivoRechazo = o.motivo_rechazo ?? o.motivoRechazo ?? null;
  const facturaId = o.factura_id ?? o.facturaId ?? null;
  const createdAt = o.created_at || o.createdAt || fechaEmision;
  const updatedAt = o.updated_at || o.updatedAt || fechaEmision;

  return {
    id: o.id,
    numero_pedido: numeroPedido,
    numeroPedido,
    numeroOrden: numeroPedido,
    fecha_emision: fechaEmision,
    fechaEmision,
    fechaCreacion: fechaEmision,
    fecha_entrega: fechaEntrega,
    fechaEntrega,
    fechaEntregaRequerida: fechaEntrega,
    cliente_id: clienteId,
    clienteId,
    cliente_nombre: clienteNombre,
    clienteNombre,
    cliente_rif: clienteRif,
    clienteRif,
    vendedor_id: vendedorId,
    vendedorId,
    vendedor_nombre: vendedorNombre,
    vendedorNombre,
    almacen_id: almacenId,
    almacenId,
    condicion_pago: condicionPago,
    condicionPago,
    dias_credito: diasCredito,
    diasCredito,
    moneda,
    tasa_cambio: tasaCambio,
    tasaCambio,
    tasaBcv: tasaCambio,
    subtotal_usd: subtotalUsd,
    subtotalUsd,
    descuento_global_pct: descuentoGlobalPct,
    descuentoGlobalPct,
    descuento_usd: descuentoUsd,
    descuentoUsd,
    base_imponible_usd: baseImponibleUsd,
    baseImponibleUsd,
    aplica_iva: aplicaIva,
    aplicaIva,
    iva_porcentaje: ivaPorcentaje,
    ivaPorcentaje,
    iva_usd: ivaUsd,
    ivaUsd,
    total_usd: totalUsd,
    totalUsd,
    total_bs: totalBs,
    totalBs,
    total_litros: totalLitros,
    totalLitros,
    total_unidades: totalUnidades,
    totalUnidades,
    estado,
    status: estado,
    observaciones,
    creado_por: creadoPor,
    creadoPor,
    aprobado_por: aprobadoPor,
    aprobadoPor,
    fecha_aprobacion: fechaAprobacion,
    fechaAprobacion,
    motivo_rechazo: motivoRechazo,
    motivoRechazo,
    factura_id: facturaId,
    facturaId,
    created_at: createdAt,
    createdAt,
    updated_at: updatedAt,
    updatedAt,
    items,
    order_items: items
  };
});

// 9. Normalize profit_accounts_payable (191 rows) & fix BS==USD anomaly
db.profit_accounts_payable = (db.profit_accounts_payable || []).map(d => {
  const tipoDoc = d.tipo_doc || d.tipoDoc || 'FACT';
  const nroDoc = String(d.nro_doc || d.nroDoc || '').trim();
  const coProv = String(d.co_prov || d.coProv || '').trim();
  const provNombre = d.prov_nombre || d.provNombre || '';
  const provRif = d.prov_rif || d.provRif || coProv;
  const fecEmis = d.fec_emis || d.fechaEmision || NOW_ISO;
  const fecVenc = d.fec_venc || d.fechaVencimiento || fecEmis;
  const moneda = d.moneda || 'BS';
  const rawTasa = Number(d.tasa || 1);
  const rawNetBs = Number(d.monto_net_bs ?? d.montoNetBs ?? 0);
  let rawNetUsd = Number(d.monto_net_usd ?? d.montoNetUsd ?? 0);
  const rawSaldoBs = Number(d.saldo_bs ?? d.saldoBs ?? 0);
  let rawSaldoUsd = Number(d.saldo_usd ?? d.saldoUsd ?? 0);

  // Fix rows where moneda === 'BS' and USD was set equal to BS instead of converted
  const effectiveRate = rawTasa > 1 ? rawTasa : BCV_RATE;
  if (moneda === 'BS' && rawNetBs > 0 && Math.abs(rawNetUsd - rawNetBs) < 0.05) {
    rawNetUsd = Number((rawNetBs / effectiveRate).toFixed(2));
  }
  if (moneda === 'BS' && rawSaldoBs > 0 && Math.abs(rawSaldoUsd - rawSaldoBs) < 0.05) {
    rawSaldoUsd = Number((rawSaldoBs / effectiveRate).toFixed(2));
  }
  const fechaSinc = d.fecha_sincronizacion || d.fechaSincronizacion || NOW_ISO;

  return {
    id: d.id,
    tipo_doc: tipoDoc,
    tipoDoc,
    nro_doc: nroDoc,
    nroDoc,
    co_prov: coProv,
    coProv,
    prov_nombre: provNombre,
    provNombre,
    prov_rif: provRif,
    provRif,
    fec_emis: fecEmis,
    fechaEmision: fecEmis,
    fec_venc: fecVenc,
    fechaVencimiento: fecVenc,
    monto_net_usd: rawNetUsd,
    montoNetUsd: rawNetUsd,
    monto_net_bs: rawNetBs,
    montoNetBs: rawNetBs,
    saldo_usd: rawSaldoUsd,
    saldoUsd: rawSaldoUsd,
    saldo_bs: rawSaldoBs,
    saldoBs: rawSaldoBs,
    tasa: rawTasa,
    moneda,
    anulado: Boolean(d.anulado),
    fecha_sincronizacion: fechaSinc,
    fechaSincronizacion: fechaSinc
  };
});

// 10. Normalize profit_supplier_payments (195 rows) & fix BS==USD anomaly
db.profit_supplier_payments = (db.profit_supplier_payments || []).map(p => {
  const pagoNum = p.pago_num ?? p.pagoNum;
  const fecPago = p.fec_pago || p.fechaPago || NOW_ISO;
  const coProv = String(p.co_prov || p.coProv || '').trim();
  const provNombre = p.prov_nombre || p.provNombre || '';
  const provRif = p.prov_rif || p.provRif || coProv;
  const moneda = p.moneda || 'BS';
  const rawTasa = Number(p.tasa || 1);
  const rawBs = Number(p.monto_bs ?? p.montoBs ?? 0);
  let rawUsd = Number(p.monto_usd ?? p.montoUsd ?? 0);
  const effectiveRate = rawTasa > 1 ? rawTasa : BCV_RATE;
  if (moneda === 'BS' && rawBs > 0 && Math.abs(rawUsd - rawBs) < 0.05) {
    rawUsd = Number((rawBs / effectiveRate).toFixed(2));
  }
  const fechaSinc = p.fecha_sincronizacion || p.fechaSincronizacion || NOW_ISO;
  return {
    id: p.id,
    pago_num: pagoNum,
    pagoNum,
    fec_pago: fecPago,
    fechaPago: fecPago,
    co_prov: coProv,
    coProv,
    prov_nombre: provNombre,
    provNombre,
    prov_rif: provRif,
    provRif,
    monto_usd: rawUsd,
    montoUsd: rawUsd,
    monto_bs: rawBs,
    montoBs: rawBs,
    tasa: rawTasa,
    moneda,
    descrip: p.descrip || '',
    anulado: Boolean(p.anulado),
    fecha_sincronizacion: fechaSinc,
    fechaSincronizacion: fechaSinc
  };
});

// 11. Normalize profit_bank_accounts (10+ rows)
db.profit_bank_accounts = (db.profit_bank_accounts || []).map(b => {
  const codCta = String(b.cod_cta || b.codCta || b.co_ban || b.coBan || b.id?.replace(/^CTA-/, '') || '').trim();
  const numCta = String(b.num_cta || b.numCta || b.nro_cta || b.nroCta || '').trim();
  const bancoNombre = String(b.banco_nombre || b.bancoNombre || b.des_ban || b.desBan || '').trim();
  const titular = String(
    b.cuenta_a_nombre_de ||
    b.cuentaANombreDe ||
    b.titular ||
    'GRUPO MOTORVEN, C.A.'
  ).trim();
  const saldoBs = Number(b.saldo_bs ?? b.saldoBs ?? b.saldo_actual ?? b.saldoActual ?? 0);
  const saldoUsd = Number(b.saldo_usd ?? b.saldoUsd ?? 0);
  const moneda = b.moneda || 'BS';
  const fechaAct = b.fecha_actualizacion || b.fechaActualizacion || NOW_ISO;
  return {
    id: b.id || `CTA-${codCta}`,
    cod_cta: codCta,
    codCta,
    co_ban: codCta,
    coBan: codCta,
    num_cta: numCta,
    numCta,
    nro_cta: numCta,
    nroCta: numCta,
    banco_nombre: bancoNombre,
    bancoNombre,
    des_ban: bancoNombre,
    desBan: bancoNombre,
    titular,
    cuenta_a_nombre_de: titular,
    cuentaANombreDe: titular,
    saldo_bs: saldoBs,
    saldoBs,
    saldo_usd: saldoUsd,
    saldoUsd,
    saldo_actual: saldoBs,
    saldoActual: saldoBs,
    saldo_conciliado: saldoBs,
    saldoConciliado: saldoBs,
    moneda,
    fecha_actualizacion: fechaAct,
    fechaActualizacion: fechaAct
  };
});

// 12. Normalize profit_cash_desks (6+ rows)
db.profit_cash_desks = (db.profit_cash_desks || []).map(c => {
  const coCaja = String(c.co_caja || c.coCaja || c.id || '').trim();
  const descripcion = String(c.descripcion || c.des_caja || c.desCaja || '').trim();
  const moneda = c.moneda || 'USD';
  const saldoUsd = Number(c.saldo_usd ?? c.saldoUsd ?? 0);
  const saldoBs = Number(c.saldo_bs ?? c.saldoBs ?? c.saldo_actual ?? c.saldoActual ?? 0);
  const responsable = c.responsable || 'Administración';
  const fechaAct = c.fecha_actualizacion || c.fechaActualizacion || NOW_ISO;
  return {
    id: c.id || coCaja.toLowerCase(),
    co_caja: coCaja,
    coCaja,
    descripcion,
    des_caja: descripcion,
    desCaja: descripcion,
    moneda,
    saldo_usd: saldoUsd,
    saldoUsd,
    saldo_bs: saldoBs,
    saldoBs,
    saldo_actual: saldoBs,
    saldoActual: saldoBs,
    responsable,
    activa: c.activa !== false,
    fecha_actualizacion: fechaAct,
    fechaActualizacion: fechaAct
  };
});

// 13. Normalize profit_currencies (3 rows)
const currencyMeta = {
  BS: { name: 'Bolívares Soberanos (VES)', rate: BCV_RATE },
  USD: { name: 'Dólares Americanos (USD)', rate: 1 },
  EUR: { name: 'Euros Comunidad Europea (EUR)', rate: Number((BCV_RATE * 1.08).toFixed(2)) }
};
db.profit_currencies = (db.profit_currencies || []).map(m => {
  const coMone = String(m.co_mone || m.coMone || m.id?.replace(/^MON-/, '') || 'USD').trim().toUpperCase();
  const meta = currencyMeta[coMone] || { name: coMone, rate: 1 };
  const moneDes = m.mone_des || m.moneDes || m.des_mone || m.desMone || meta.name;
  const cambio = Number(m.cambio || meta.rate);
  const fechaAct = m.fecha_actualizacion || m.fechaActualizacion || NOW_ISO;
  return {
    id: m.id || `MON-${coMone}`,
    co_mone: coMone,
    coMone,
    mone_des: moneDes,
    moneDes,
    des_mone: moneDes,
    desMone: moneDes,
    cambio,
    fecha_actualizacion: fechaAct,
    fechaActualizacion: fechaAct
  };
});

// 14. Normalize native purchases, suppliers, cash_movements, fiscal_closures, notifications
db.purchases = (db.purchases || []).map((p, idx) => {
  const totalUsd = Number(p.total_usd ?? p.totalUsd ?? 0);
  const subtotalUsd = Number(p.subtotal_usd ?? p.base_imponible_usd ?? p.baseImponibleUsd ?? (totalUsd > 0 ? Number((totalUsd / 1.16).toFixed(2)) : 0));
  const ivaUsd = Number(p.iva_usd ?? p.monto_iva_usd ?? p.montoIvaUsd ?? Number((totalUsd - subtotalUsd).toFixed(2)));
  const totalBs = Number(p.total_bs ?? p.totalBs ?? Number((totalUsd * BCV_RATE).toFixed(2)));
  const tasaBcv = Number(p.tasa_bcv || p.tasaBcv || (totalUsd > 0 && totalBs > 0 ? Number((totalBs / totalUsd).toFixed(2)) : BCV_RATE));
  const nroControl = p.nro_control || p.numero_control || p.numeroControl || `00-00582${idx + 1}`;
  const nroFactura = p.nro_factura || p.numero_factura_proveedor || p.numeroFacturaProveedor || `FAC-PROV-00${idx + 1}`;
  const proveedorId = p.proveedor_id || p.proveedorId || 'PROV-001';
  const proveedorNombre = p.proveedor_nombre || p.proveedorNombre || 'KEYSTONE, C.A. (Planta Barquisimeto)';
  const proveedorRif = p.proveedor_rif || p.proveedorRif || 'J-31115365-9';
  const fechaCompra = p.fecha_compra || p.fecha_emision || p.fechaEmision || '2026-08-01T12:00:00.000Z';
  const estadoPago = p.estado_pago || p.status || 'Pagada';
  return {
    id: p.id,
    fecha_compra: fechaCompra,
    fechaCompra,
    fecha_emision: fechaCompra,
    fechaEmision: fechaCompra,
    fecha_recepcion: p.fecha_recepcion || p.fechaRecepcion || fechaCompra,
    fechaRecepcion: p.fechaRecepcion || p.fecha_recepcion || fechaCompra,
    nro_factura: nroFactura,
    nroFactura,
    numero_factura_proveedor: nroFactura,
    numeroFacturaProveedor: nroFactura,
    nro_control: nroControl,
    nroControl,
    numero_control: nroControl,
    numeroControl: nroControl,
    proveedor_id: proveedorId,
    proveedorId,
    proveedor_nombre: proveedorNombre,
    proveedorNombre,
    proveedor_rif: proveedorRif,
    proveedorRif,
    subtotal_usd: subtotalUsd,
    subtotalUsd,
    base_imponible_usd: subtotalUsd,
    baseImponibleUsd: subtotalUsd,
    base_imponible_bs: Number((subtotalUsd * tasaBcv).toFixed(2)),
    baseImponibleBs: Number((subtotalUsd * tasaBcv).toFixed(2)),
    iva_usd: ivaUsd,
    ivaUsd,
    monto_iva_usd: ivaUsd,
    montoIvaUsd: ivaUsd,
    monto_iva_bs: Number((ivaUsd * tasaBcv).toFixed(2)),
    montoIvaBs: Number((ivaUsd * tasaBcv).toFixed(2)),
    total_usd: totalUsd,
    totalUsd,
    total_bs: totalBs,
    totalBs,
    tasa_bcv: tasaBcv,
    tasaBcv,
    estado_pago: estadoPago,
    estadoPago,
    status: estadoPago,
    items: Array.isArray(p.items) ? p.items : []
  };
});

db.suppliers = (db.suppliers || []).map(s => {
  const contacto = s.contacto || s.persona_contacto || s.personaContacto || 'Departamento Comercial Keystone';
  const tipoProveedor = s.tipo_proveedor || s.tipoProveedor || 'Nacional';
  const saldoPendienteUsd = Number(s.saldo_pendiente_usd ?? s.saldoPendienteUsd ?? 0);
  const diasCredito = Number(s.dias_credito ?? s.diasCredito ?? 30);
  return {
    id: s.id,
    rif: s.rif || 'J-31115365-9',
    nombre: s.nombre || 'KEYSTONE, C.A.',
    contacto,
    persona_contacto: contacto,
    personaContacto: contacto,
    telefono: s.telefono || '',
    email: s.email || '',
    direccion: s.direccion || '',
    tipo_proveedor: tipoProveedor,
    tipoProveedor,
    saldo_pendiente_usd: saldoPendienteUsd,
    saldoPendienteUsd,
    dias_credito: diasCredito,
    diasCredito
  };
});

db.cash_movements = (db.cash_movements || []).map(m => {
  const montoUsd = Number(m.monto_usd ?? m.montoUsd ?? 0);
  const montoBs = Number(m.monto_bs ?? m.montoBs ?? Number((montoUsd * BCV_RATE).toFixed(2)));
  const tasaBcv = Number(m.tasa_bcv ?? m.tasaBcv ?? (montoUsd > 0 && montoBs > 0 ? Number((montoBs / montoUsd).toFixed(2)) : BCV_RATE));
  const concepto = m.concepto || m.descripcion || 'Ingreso Operativo de Caja';
  const categoria = m.categoria || 'VENTAS';
  const metodoPago = m.metodo_pago || m.metodoPago || m.caja_o_banco || m.cajaOBanco || 'Efectivo USD';
  const referencia = m.referencia || m.id;
  const moneda = m.moneda || 'USD';
  const usuarioId = m.usuario_id || m.usuarioId || 'usr-muq3bdll';
  return {
    id: m.id,
    fecha: m.fecha || NOW_ISO,
    tipo: m.tipo || 'INGRESO',
    categoria,
    concepto,
    descripcion: concepto,
    metodo_pago: metodoPago,
    metodoPago,
    caja_o_banco: metodoPago,
    cajaOBanco: metodoPago,
    referencia,
    moneda,
    monto_usd: montoUsd,
    montoUsd,
    monto_bs: montoBs,
    montoBs,
    tasa_bcv: tasaBcv,
    tasaBcv,
    usuario_id: usuarioId,
    usuarioId
  };
});

db.fiscal_closures = (db.fiscal_closures || []).map(c => {
  const numeroZ = c.numero_z || c.numeroZ || String(c.numero_cierre ?? c.numeroCierre ?? 1).padStart(4, '0');
  const numeroCierre = Number(c.numero_cierre ?? c.numeroCierre ?? 1);
  const totalBs = Number(c.total_bs ?? c.total_ventas_bs ?? c.totalVentasBs ?? 41865.79);
  const granTotalBs = Number(c.gran_total_historico_bs ?? c.granTotalHistoricoBs ?? totalBs);
  const totalIvaBs = Number(c.total_iva_bs ?? c.totalIvaBs ?? 0);
  const totalIgtfBs = Number(c.total_igtf_bs ?? c.totalIgtfBs ?? 1219.39);
  const tasaBcv = Number(c.tasa_bcv ?? c.tasaBcv ?? BCV_RATE);
  const totalUsd = Number(c.total_usd ?? c.totalUsd ?? Number((totalBs / tasaBcv).toFixed(2)));
  const igtfUsd = Number(c.igtf_usd ?? c.igtfUsd ?? Number((totalIgtfBs / tasaBcv).toFixed(2)));
  const ivaUsd = Number(c.iva_usd ?? c.ivaUsd ?? Number((totalIvaBs / tasaBcv).toFixed(2)));
  const baseImponibleUsd = Number(c.base_imponible_usd ?? c.baseImponibleUsd ?? Number((totalUsd - ivaUsd - igtfUsd).toFixed(2)));
  const fecha = c.fecha || '2026-08-04T20:00:00.000Z';
  const hora = c.hora || '20:00:00';
  return {
    id: c.id || 'Z-00000001',
    tipo: c.tipo || 'Z',
    numero_z: numeroZ,
    numeroZ,
    numero_cierre: numeroCierre,
    numeroCierre,
    fecha,
    hora,
    facturas_emitidas: Number(c.facturas_emitidas ?? c.facturasEmitidas ?? 1),
    facturasEmitidas: Number(c.facturasEmitidas ?? c.facturas_emitidas ?? 1),
    primera_factura: c.primera_factura || c.primeraFactura || '00002495',
    primeraFactura: c.primeraFactura || c.primera_factura || '00002495',
    ultima_factura: c.ultima_factura || c.ultimaFactura || '00002495',
    ultimaFactura: c.ultimaFactura || c.ultima_factura || '00002495',
    base_imponible_usd: baseImponibleUsd,
    baseImponibleUsd,
    iva_usd: ivaUsd,
    ivaUsd,
    igtf_usd: igtfUsd,
    igtfUsd,
    total_usd: totalUsd,
    totalUsd,
    total_bs: totalBs,
    totalBs,
    total_ventas_bs: totalBs,
    totalVentasBs: totalBs,
    gran_total_historico_bs: granTotalBs,
    granTotalHistoricoBs: granTotalBs,
    total_iva_bs: totalIvaBs,
    totalIvaBs,
    total_igtf_bs: totalIgtfBs,
    totalIgtfBs,
    tasa_bcv: tasaBcv,
    tasaBcv,
    cajero: c.cajero || 'Administrador Master',
    hash_seguridad: c.hash_seguridad || c.hashSeguridad || 'SHA256-OILSTONE-Z0001',
    hashSeguridad: c.hashSeguridad || c.hash_seguridad || 'SHA256-OILSTONE-Z0001'
  };
});

db.notifications = (db.notifications || []).map(n => {
  const leida = Boolean(n.leida ?? n.leido ?? false);
  const fecha = n.fecha || n.created_at || NOW_ISO;
  return {
    id: n.id,
    tipo: n.tipo || 'sistema',
    severidad: n.severidad || 'info',
    modulo: n.modulo || 'dashboard',
    titulo: n.titulo || 'Notificación del Sistema',
    mensaje: n.mensaje || '',
    icono: n.icono || 'Bell',
    leida,
    leido: leida,
    destinatario_rol: n.destinatario_rol || 'ALL',
    destinatario_usuario: n.destinatario_usuario || 'ALL',
    origen: n.origen || 'SUPABASE',
    fecha,
    created_at: fecha,
    metadata: n.metadata || {}
  };
});

// 15. Normalize profit_payment_orders (ensure both snake_case and camelCase)
db.profit_payment_orders = (db.profit_payment_orders || []).map(o => {
  const ordNum = o.ord_num ?? o.ordNum;
  const codBen = String(o.cod_ben || o.codBen || o.beneficiario || '').trim();
  const benDes = String(o.ben_des || o.benDes || o.beneficiario || '').trim();
  const descrip = o.descrip || o.concepto || '';
  const moneda = o.moneda || 'BS';
  const tasa = Number(o.tasa || 1);
  const monto = Number(o.monto ?? o.monto_usd ?? o.montoUsd ?? 0);
  const montoRet = Number(o.monto_ret ?? o.montoRet ?? 0);
  const formaPag = o.forma_pag || o.formaPag || 'TR';
  const codCta = o.cod_cta || o.codCta || '';
  const cheNum = o.che_num || o.cheNum || '';
  const coSucu = o.co_sucu || o.coSucu || '01';
  const createdAt = o.created_at || o.createdAt || o.fecha || NOW_ISO;
  const updatedAt = o.updated_at || o.updatedAt || NOW_ISO;
  return {
    ...o,
    id: o.id,
    ord_num: ordNum,
    ordNum,
    fecha: o.fecha,
    cod_ben: codBen,
    codBen,
    ben_des: benDes,
    benDes,
    beneficiario: benDes,
    descrip,
    concepto: descrip,
    monto,
    monto_usd: Number(o.monto_usd ?? o.montoUsd ?? monto),
    montoUsd: Number(o.montoUsd ?? o.monto_usd ?? monto),
    monto_bs: Number(o.monto_bs ?? o.montoBs ?? 0),
    montoBs: Number(o.montoBs ?? o.monto_bs ?? 0),
    monto_ret: montoRet,
    montoRet,
    forma_pag: formaPag,
    formaPag,
    cod_cta: codCta,
    codCta,
    che_num: cheNum,
    cheNum,
    anulada: Boolean(o.anulada),
    tasa,
    moneda,
    co_sucu: coSucu,
    coSucu,
    created_at: createdAt,
    createdAt,
    updated_at: updatedAt,
    updatedAt
  };
});

// 16. Update SIGNUM_MOTORVEN summary table counts to match exact live database counts
const liveCountByRowId = {
  '01_CORPORATIVO': 1,
  '02_CLIENTES': db.clients.length,
  '03_PRODUCTOS': db.products.length,
  '04_FACTURAS': (db.profit_invoices || []).length,
  '05_COBROS': (db.profit_collections || []).length,
  '06_CXP': db.profit_accounts_payable.length,
  '07_PAGOS_PROV': db.profit_supplier_payments.length,
  '08_COMPRAS': (db.profit_purchases || []).length,
  '09_PROVEEDORES': (db.profit_suppliers || []).length,
  '10_VENDEDORES': db.profit_sellers.length,
  '11_BANCOS': db.profit_bank_accounts.length,
  '12_CAJAS': db.profit_cash_desks.length,
  '13_ZONAS': (db.profit_zones || []).length,
  '14_USUARIOS': db.users.length,
  '15_PEDIDOS': db.orders.length
};

db.SIGNUM_MOTORVEN = (db.SIGNUM_MOTORVEN || []).map(row => ({
  ...row,
  tasa_dolar_bcv: BCV_RATE,
  tasa_keystone: KEYSTONE_RATE,
  registros_sincronizados: liveCountByRowId[row.id] ?? row.registros_sincronizados
}));

// Save cleaned local_database.json
fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
console.log('✅ Cleaned and normalized supabase/local_database.json');

// Sync src/data/temp/users.json and src/data/temp/profit_sellers.json
const tempDir = path.resolve('src/data/temp');
if (fs.existsSync(tempDir)) {
  fs.writeFileSync(path.join(tempDir, 'users.json'), JSON.stringify(db.users, null, 2), 'utf8');
  fs.writeFileSync(path.join(tempDir, 'profit_sellers.json'), JSON.stringify(db.profit_sellers, null, 2), 'utf8');
  console.log('✅ Synchronized src/data/temp/users.json and src/data/temp/profit_sellers.json');
}

// Generate individual JSON dump files and lightweight re-exports in src/data/supabaseRealData.js
const dumpDir = path.resolve('src/data/dump');
fs.mkdirSync(dumpDir, { recursive: true });

const tables = {
  signum_motorven: db.SIGNUM_MOTORVEN,
  config: cleanConfigRow,
  products: db.products,
  clients: db.clients,
  profit_sellers: db.profit_sellers,
  profit_invoices: db.profit_invoices || [],
  profit_collections: db.profit_collections || [],
  profit_accounts_payable: db.profit_accounts_payable,
  profit_supplier_payments: db.profit_supplier_payments,
  profit_purchases: db.profit_purchases || [],
  profit_suppliers: db.profit_suppliers || [],
  profit_bank_accounts: db.profit_bank_accounts,
  profit_cash_desks: db.profit_cash_desks,
  profit_zones: db.profit_zones || [],
  profit_transports: db.profit_transports,
  profit_customer_returns: db.profit_customer_returns || [],
  profit_inventory_adjustments: db.profit_inventory_adjustments || [],
  profit_warehouse_transfers: db.profit_warehouse_transfers || [],
  profit_islr_concepts: db.profit_islr_concepts || [],
  profit_beneficiaries: db.profit_beneficiaries || [],
  profit_payment_orders: db.profit_payment_orders || [],
  profit_warehouses: db.profit_warehouses || [],
  profit_stock_by_warehouse: db.profit_stock_by_warehouse || [],
  profit_product_lines: db.profit_product_lines || [],
  profit_product_sublines: db.profit_product_sublines || [],
  profit_product_categories: db.profit_product_categories || [],
  profit_currencies: db.profit_currencies,
  users: db.users,
  orders: db.orders,
  sales: db.sales || [],
  purchases: db.purchases,
  suppliers: db.suppliers,
  cash_movements: db.cash_movements,
  fiscal_closures: db.fiscal_closures,
  notifications: db.notifications
};

for (const [key, val] of Object.entries(tables)) {
  fs.writeFileSync(path.join(dumpDir, `${key}.json`), JSON.stringify(val ?? null), 'utf8');
}

const outputFilePath = path.resolve('src/data/supabaseRealData.js');
const fileContent = `/**
 * DUMP REAL Y SINCRONIZADO DE LA BASE DE DATOS SUPABASE (PostgreSQL)
 * Generado el: ${NOW_ISO}
 */
import REAL_SIGNUM_MOTORVEN from './dump/signum_motorven.json' with { type: 'json' };
import REAL_CONFIG from './dump/config.json' with { type: 'json' };
import REAL_PRODUCTS from './dump/products.json' with { type: 'json' };
import REAL_CLIENTS from './dump/clients.json' with { type: 'json' };
import REAL_PROFIT_SELLERS from './dump/profit_sellers.json' with { type: 'json' };
import REAL_PROFIT_INVOICES from './dump/profit_invoices.json' with { type: 'json' };
import REAL_PROFIT_COLLECTIONS from './dump/profit_collections.json' with { type: 'json' };
import REAL_PROFIT_ACCOUNTS_PAYABLE from './dump/profit_accounts_payable.json' with { type: 'json' };
import REAL_PROFIT_SUPPLIER_PAYMENTS from './dump/profit_supplier_payments.json' with { type: 'json' };
import REAL_PROFIT_PURCHASES from './dump/profit_purchases.json' with { type: 'json' };
import REAL_PROFIT_SUPPLIERS from './dump/profit_suppliers.json' with { type: 'json' };
import REAL_PROFIT_BANK_ACCOUNTS from './dump/profit_bank_accounts.json' with { type: 'json' };
import REAL_PROFIT_CASH_DESKS from './dump/profit_cash_desks.json' with { type: 'json' };
import REAL_PROFIT_ZONES from './dump/profit_zones.json' with { type: 'json' };
import REAL_PROFIT_TRANSPORTS from './dump/profit_transports.json' with { type: 'json' };
import REAL_PROFIT_CUSTOMER_RETURNS from './dump/profit_customer_returns.json' with { type: 'json' };
import REAL_PROFIT_INVENTORY_ADJUSTMENTS from './dump/profit_inventory_adjustments.json' with { type: 'json' };
import REAL_PROFIT_WAREHOUSE_TRANSFERS from './dump/profit_warehouse_transfers.json' with { type: 'json' };
import REAL_PROFIT_ISLR_CONCEPTS from './dump/profit_islr_concepts.json' with { type: 'json' };
import REAL_PROFIT_BENEFICIARIES from './dump/profit_beneficiaries.json' with { type: 'json' };
import REAL_PROFIT_PAYMENT_ORDERS from './dump/profit_payment_orders.json' with { type: 'json' };
import REAL_PROFIT_WAREHOUSES from './dump/profit_warehouses.json' with { type: 'json' };
import REAL_PROFIT_STOCK_BY_WAREHOUSE from './dump/profit_stock_by_warehouse.json' with { type: 'json' };
import REAL_PROFIT_PRODUCT_LINES from './dump/profit_product_lines.json' with { type: 'json' };
import REAL_PROFIT_PRODUCT_SUBLINES from './dump/profit_product_sublines.json' with { type: 'json' };
import REAL_PROFIT_PRODUCT_CATEGORIES from './dump/profit_product_categories.json' with { type: 'json' };
import REAL_PROFIT_CURRENCIES from './dump/profit_currencies.json' with { type: 'json' };
import REAL_USERS from './dump/users.json' with { type: 'json' };
import REAL_ORDERS from './dump/orders.json' with { type: 'json' };
import REAL_SALES from './dump/sales.json' with { type: 'json' };
import REAL_PURCHASES from './dump/purchases.json' with { type: 'json' };
import REAL_SUPPLIERS from './dump/suppliers.json' with { type: 'json' };
import REAL_CASH_MOVEMENTS from './dump/cash_movements.json' with { type: 'json' };
import REAL_FISCAL_CLOSURES from './dump/fiscal_closures.json' with { type: 'json' };
import REAL_NOTIFICATIONS from './dump/notifications.json' with { type: 'json' };

export const REAL_PRODUCT_SUBLINES = REAL_PROFIT_PRODUCT_SUBLINES;

export {
  REAL_SIGNUM_MOTORVEN,
  REAL_CONFIG,
  REAL_PRODUCTS,
  REAL_CLIENTS,
  REAL_PROFIT_SELLERS,
  REAL_PROFIT_INVOICES,
  REAL_PROFIT_COLLECTIONS,
  REAL_PROFIT_ACCOUNTS_PAYABLE,
  REAL_PROFIT_SUPPLIER_PAYMENTS,
  REAL_PROFIT_PURCHASES,
  REAL_PROFIT_SUPPLIERS,
  REAL_PROFIT_BANK_ACCOUNTS,
  REAL_PROFIT_CASH_DESKS,
  REAL_PROFIT_ZONES,
  REAL_PROFIT_TRANSPORTS,
  REAL_PROFIT_CUSTOMER_RETURNS,
  REAL_PROFIT_INVENTORY_ADJUSTMENTS,
  REAL_PROFIT_WAREHOUSE_TRANSFERS,
  REAL_PROFIT_ISLR_CONCEPTS,
  REAL_PROFIT_BENEFICIARIES,
  REAL_PROFIT_PAYMENT_ORDERS,
  REAL_PROFIT_WAREHOUSES,
  REAL_PROFIT_STOCK_BY_WAREHOUSE,
  REAL_PROFIT_PRODUCT_LINES,
  REAL_PROFIT_PRODUCT_SUBLINES,
  REAL_PROFIT_PRODUCT_CATEGORIES,
  REAL_PROFIT_CURRENCIES,
  REAL_USERS,
  REAL_ORDERS,
  REAL_SALES,
  REAL_PURCHASES,
  REAL_SUPPLIERS,
  REAL_CASH_MOVEMENTS,
  REAL_FISCAL_CLOSURES,
  REAL_NOTIFICATIONS
};
`;

fs.writeFileSync(outputFilePath, fileContent, 'utf8');
console.log('✅ Regenerated src/data/dump and src/data/supabaseRealData.js in 100% parity with supabase/local_database.json');
