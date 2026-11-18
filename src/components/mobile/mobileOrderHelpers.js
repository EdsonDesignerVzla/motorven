import {
  resolveProductUnit,
  resolveProductLitersPerUnit,
  round2
} from '../../services/formatService';
import { canAccessModule, normalizeRole } from '../../services/authService';
import {
  isClientAssignedToSeller,
  isOrderReservationExpired,
  parseInvoiceDateInfo,
  resolveCreditDaysFromTerm
} from '../../services/creditPolicyService';
import { isCreditSaleRecord, isCxcInvoiceSettled } from '../../utils/cxcUtils';
import { resolveExchangeRates } from '../../utils/treasuryAccountUtils';

export const PREVENTA_RESERVATION_HOURS = 72;

/**
 * Obtiene la tasa oficial BCV del día desde la configuración viva del ERP.
 */
export function resolveDailyRate(config) {
  return resolveExchangeRates(config).tasaBcv;
}

const FINAL_ORDER_STATUSES = new Set(['FACTURADO', 'ANULADO', 'CADUCADO', 'RECHAZADO']);

/**
 * Determina si una orden corresponde a un pedido comercial de Preventa/Ventas
 * (excluyendo solicitudes de registro de clientes nuevos SOLICITUD_CLIENTE / SOL-CLI).
 */
export function isCommercialPresaleOrder(order) {
  if (!order || typeof order !== 'object') return false;
  const tipo = String(order.tipoDoc || order.tipo_doc || '').trim().toUpperCase();
  const mod = String(order.modalidadVenta || order.modalidad_venta || '').trim().toUpperCase();
  const num = String(
    order.numeroPedido || order.numeroDoc || order.numeroOrden || order.correlativo || order.id || ''
  )
    .trim()
    .toUpperCase();

  if (tipo === 'SOLICITUD_CLIENTE' || mod === 'SOLICITUD_CLIENTE' || num.startsWith('SOL-CLI')) {
    return false;
  }
  return true;
}

/**
 * Normaliza el estado operativo de un pedido/preventa a etiqueta y tono de badge móvil.
 */
export function normalizeOrderStatus(order) {
  const raw = String(order?.status || order?.estado || 'PENDIENTE')
    .trim()
    .toUpperCase();

  const isBilled = raw === 'FACTURADO' || raw === 'PROCESADO';
  const isCancelled = raw === 'ANULADO' || raw === 'RECHAZADO' || raw === 'CADUCADO';
  const isRetained = raw === 'RETENIDO_CREDITO' || raw === 'RETENIDO';
  const isPendingApproval = raw === 'PENDIENTE_APROBACION';
  const isApproved = raw === 'APROBADO' || raw === 'EN_DESPACHO' || raw === 'DESPACHADO';

  if (isBilled) {
    return {
      code: raw,
      label: 'FACTURADO',
      tone: 'success',
      isPending: false,
      isRetained: false,
      isApproved: false,
      isBilled: true,
      isCancelled: false
    };
  }
  if (isCancelled) {
    return {
      code: raw,
      label: raw === 'RECHAZADO' ? 'RECHAZADO' : raw === 'CADUCADO' ? 'CADUCADO' : 'ANULADO',
      tone: 'danger',
      isPending: false,
      isRetained: false,
      isApproved: false,
      isBilled: false,
      isCancelled: true
    };
  }
  if (isRetained) {
    return {
      code: raw,
      label: 'RETENIDO CRÉD.',
      tone: 'danger',
      isPending: true,
      isRetained: true,
      isApproved: false,
      isBilled: false,
      isCancelled: false
    };
  }
  if (isApproved) {
    return {
      code: raw,
      label: raw === 'EN_DESPACHO' ? 'EN DESPACHO' : 'APROBADO CAJA',
      tone: 'info',
      isPending: true,
      isRetained: false,
      isApproved: true,
      isBilled: false,
      isCancelled: false
    };
  }
  if (isPendingApproval) {
    return {
      code: raw,
      label: 'POR APROBAR',
      tone: 'warning',
      isPending: true,
      isRetained: false,
      isApproved: false,
      isBilled: false,
      isCancelled: false
    };
  }

  return {
    code: raw || 'PENDIENTE',
    label: 'PENDIENTE',
    tone: 'warning',
    isPending: true,
    isRetained: false,
    isApproved: false,
    isBilled: false,
    isCancelled: false
  };
}

/**
 * Determina si un pedido corresponde a Nota de Entrega (Almacén 02, exento).
 */
export function isOrderNotaEntrega(order) {
  if (!order) return false;
  const docNum = String(order.numeroPedido || order.numeroDoc || order.correlativo || order.id || '')
    .trim()
    .toUpperCase();
  const tipo = String(order.tipoDoc || order.tipo_doc || '').trim().toUpperCase();
  const mod = String(order.modalidadVenta || order.modalidad_venta || '').trim().toUpperCase();
  const alm = String(order.almacen || order.almacenId || order.almacen_id || '').trim();

  return (
    tipo === 'NOTA_ENTREGA' ||
    mod === 'OFICINA' ||
    alm === '02' ||
    docNum.startsWith('PED-NE') ||
    docNum.startsWith('NE-')
  );
}

/**
 * Devuelve el correlativo legible de un pedido.
 */
export function getOrderNumber(order) {
  return String(
    order?.numeroPedido ||
    order?.numeroDoc ||
    order?.numeroOrden ||
    order?.correlativo ||
    order?.id ||
    'PED-000'
  ).trim();
}

/**
 * Busca el perfil del cliente asociado al pedido en el maestro sincronizado.
 */
export function findClientForOrder(order, clients = []) {
  if (!order || !Array.isArray(clients) || clients.length === 0) return null;
  const cid = String(order.clienteId || order.cliente_id || '').trim().toUpperCase();
  const crif = String(order.clienteRif || order.cliente_rif || '').trim().toUpperCase();
  const cname = String(order.clienteNombre || order.cliente || '').trim().toUpperCase();

  return (
    clients.find((c) => {
      const idMatch = cid && (String(c.id || '').toUpperCase() === cid || String(c.codigo || c.co_cli || '').toUpperCase() === cid);
      const rifMatch = crif && String(c.rif || '').toUpperCase() === crif;
      const nameMatch = cname && String(c.nombre || c.razonSocial || '').trim().toUpperCase() === cname;
      return idMatch || rifMatch || nameMatch;
    }) || null
  );
}

/**
 * Consolida totales bimonetarios (siempre valorizados a la tasa del día cuando se provee),
 * litraje, bultos y peso estimado de un pedido.
 */
export function computeOrderMetrics(order, dailyRate = null) {
  const dailyNum = Number(dailyRate);
  const orderRateNum = Number(order?.tasaCambio || order?.tasaBcv || order?.tasa_bcv || 0);
  const safeRate = (Number.isFinite(dailyNum) && dailyNum > 1)
    ? dailyNum
    : ((Number.isFinite(orderRateNum) && orderRateNum > 1) ? orderRateNum : resolveExchangeRates().tasaBcv);
  const rawItems = Array.isArray(order?.items)
    ? order.items
    : (Array.isArray(order?.renglones) ? order.renglones : []);

  const isNe = isOrderNotaEntrega(order);
  let calcSub = 0;
  let calcTaxableSub = 0;
  let calcLitros = 0;
  let calcUnits = 0;

  const normalizedItems = rawItems.map((it, idx) => {
    const qty = Number(it.cantidad ?? it.qty ?? 1) || 0;
    const unitPrice = Number(it.precioUnitarioUsd ?? it.precioUsd ?? it.precio_unitario_usd ?? 0) || 0;
    const rowSub = Number(it.totalUsd ?? it.subtotalUsd ?? it.total_usd ?? round2(qty * unitPrice)) || 0;
    const unitLiters = Number(it.litrosUnitarios ?? it.litros_unitarios ?? it.litrosPorUnidad ?? resolveProductLitersPerUnit(it)) || 0;
    const rowLiters = Number(it.litrosTotales ?? it.litros_totales ?? round2(qty * unitLiters)) || 0;
    const alicuota = String(it.tipoAlicuota || it.tipo_alicuota || (it.aplicaIva === false ? 'EXENTO_0' : 'GENERAL_16')).toUpperCase();
    const rowAppliesIva = !isNe && alicuota !== 'EXENTO_0' && it.aplicaIva !== false && it.aplica_iva !== false;

    calcSub += rowSub;
    if (rowAppliesIva) calcTaxableSub += rowSub;
    calcLitros += rowLiters;
    calcUnits += qty;

    return {
      id: it.id || `${idx + 1}`,
      rengNum: it.rengNum || it.reng_num || idx + 1,
      sku: String(it.articuloId || it.articulo_id || it.codigo || it.productoId || '').trim(),
      descripcion: String(it.articuloDescripcion || it.articulo_descripcion || it.descripcion || 'Lubricante OILSTONE').trim(),
      unidad: resolveProductUnit(it, 'Caja'),
      cantidad: qty,
      litrosUnitarios: unitLiters,
      litrosTotales: rowLiters,
      precioUnitarioUsd: unitPrice,
      subtotalUsd: rowSub,
      subtotalBs: round2(rowSub * safeRate),
      aplicaIva: rowAppliesIva
    };
  });

  const subtotalUsd = normalizedItems.length > 0
    ? round2(calcSub)
    : round2(Number(order?.subtotalUsd ?? order?.totalBrutoUsd ?? order?.totalUsd ?? 0));

  let ivaUsd = 0;
  if (!isNe) {
    if (Number(order?.ivaUsd || 0) > 0) {
      ivaUsd = round2(Number(order.ivaUsd));
    } else if (normalizedItems.length > 0 && calcTaxableSub > 0) {
      ivaUsd = round2(calcTaxableSub * 0.16);
    } else if (order?.aplicaIva) {
      ivaUsd = round2(subtotalUsd * 0.16);
    }
  }

  const storedTotal = round2(Number(order?.totalUsd ?? order?.totalNetoUsd ?? 0));
  const totalUsd = storedTotal >= subtotalUsd + ivaUsd - 0.02
    ? storedTotal
    : round2(subtotalUsd + ivaUsd);
  const subtotalBs = round2(subtotalUsd * safeRate);
  const ivaBs = round2(ivaUsd * safeRate);
  const totalBs = round2(totalUsd * safeRate);
  const emissionRate = Number.isFinite(orderRateNum) && orderRateNum > 1 ? orderRateNum : safeRate;
  const totalLitros = normalizedItems.length > 0
    ? round2(calcLitros)
    : round2(Number(order?.totalLitros ?? order?.total_litros ?? 0));
  const totalUnits = normalizedItems.length > 0
    ? calcUnits
    : Number(order?.totalUnidades ?? order?.totalCajas ?? 0);

  const diasCredito = Number(order?.diasCredito ?? order?.dias_credito ?? 0);
  const condicionRaw = String(order?.condicionPago || order?.condicion_pago || (diasCredito > 0 ? `CREDITO_${diasCredito}` : 'CONTADO')).toUpperCase();
  const plazoLabel = condicionRaw === 'CONTADO' || diasCredito === 0
    ? 'Contado'
    : `Crédito ${diasCredito || condicionRaw.replace(/\D+/g, '') || 15}d`;

  // Peso aproximado estándar SAE para lubricantes (~0.88 kg/L)
  const estimatedWeightKg = round2(totalLitros * 0.88);

  return {
    items: normalizedItems,
    subtotalUsd,
    subtotalBs,
    ivaUsd,
    ivaBs,
    totalUsd,
    totalBs,
    totalLitros,
    totalUnits,
    estimatedWeightKg,
    tasa: safeRate,
    emissionRate,
    isNe,
    warehouseCode: isNe ? '02' : '01',
    warehouseLabel: isNe ? 'Alm. 02 (Exento)' : 'Alm. 01 (Fiscal +16% IVA)',
    plazoLabel
  };
}

/**
 * Calcula reservas virtuales comprometidas dentro de la ventana oficial ATP de 72 horas.
 */
export function buildCommittedStockMap(orders = [], excludeOrderId = null) {
  const map = new Map();
  const nowMs = Date.now();
  const maxAgeMs = PREVENTA_RESERVATION_HOURS * 60 * 60 * 1000;

  (Array.isArray(orders) ? orders : []).forEach((ord) => {
    if (!ord || !isCommercialPresaleOrder(ord)) return;
    if (excludeOrderId && (ord.id === excludeOrderId || ord.numeroPedido === excludeOrderId)) return;
    const st = String(ord.status || ord.estado || '').trim().toUpperCase();
    if (FINAL_ORDER_STATUSES.has(st)) return;

    const rawDate = ord.fechaEmision || ord.fecha_emision || ord.fechaCreacion || ord.created_at;
    if (rawDate) {
      const ts = new Date(rawDate).getTime();
      if (!Number.isNaN(ts) && nowMs - ts > maxAgeMs) return;
    }

    const wh = isOrderNotaEntrega(ord) ? '02' : '01';
    const items = Array.isArray(ord.items) ? ord.items : (Array.isArray(ord.renglones) ? ord.renglones : []);
    items.forEach((it) => {
      const artId = String(it.articuloId || it.articulo_id || it.codigo || it.productoId || '').trim().toUpperCase();
      if (!artId) return;
      const qty = Math.max(0, Number(it.cantidad ?? it.qty ?? 0));
      if (qty <= 0) return;
      const prev = map.get(artId) || { wh01: 0, wh02: 0, total: 0 };
      if (wh === '02') prev.wh02 += qty;
      else prev.wh01 += qty;
      prev.total += qty;
      map.set(artId, prev);
    });
  });

  return {
    map,
    getCommitted: (productOrId, warehouseCode = null) => {
      const candidates = typeof productOrId === 'object' && productOrId
        ? [productOrId.id, productOrId.codigo, productOrId.co_art]
        : [productOrId];
      for (const cand of candidates) {
        const key = String(cand || '').trim().toUpperCase();
        if (!key || !map.has(key)) continue;
        const entry = map.get(key);
        if (warehouseCode === '01') return entry.wh01;
        if (warehouseCode === '02') return entry.wh02;
        return entry.total;
      }
      return 0;
    }
  };
}

/**
 * Genera el correlativo secuencial de Preventa Móvil (PED-NE-XXXXXX / PED-FF-XXXXXX).
 */
export function generateMobileOrderNumber(orders = [], isNotaEntrega = false) {
  const prefix = isNotaEntrega ? 'PED-NE' : 'PED-FF';
  let maxSeq = 0;

  (Array.isArray(orders) ? orders : []).forEach((o) => {
    const num = getOrderNumber(o).toUpperCase();
    if (!num.startsWith(prefix)) return;
    const digitsMatch = num.match(/(\d+)$/);
    if (digitsMatch) {
      const parsed = Number(digitsMatch[1]);
      if (Number.isFinite(parsed) && parsed > maxSeq) maxSeq = parsed;
    }
  });

  const nextSeq = String(maxSeq + 1).padStart(6, '0');
  return `${prefix}-${nextSeq}`;
}

/**
 * Extrae el grado de viscosidad SAE o código corto de un lubricante OILSTONE.
 */
export function extractViscosityBadge(product) {
  const text = String(product?.nombre || product?.descripcion || '').toUpperCase();
  const match = text.match(/(\d{1,2}W-?\d{2}|SAE\s*\d{2,3}|ISO\s*\d{2,3}|ATF|DOT-?\d|HD\s*\d{2})/);
  return match ? match[0].replace(/\s+/g, ' ') : 'OILSTONE';
}

/**
 * Indica si un usuario corresponde a perfil operativo de Vendedor / Fuerza de Ventas.
 */
export function isSellerProfile(currentUser) {
  const norm = normalizeRole(currentUser?.rol || '');
  return norm === 'VENDEDOR';
}

/**
 * Filtra la cartera de clientes para mostrar primero / exclusivamente los de la ruta del vendedor si aplica.
 */
export function resolveVisibleClients(clients = [], currentUser = null, profitSellers = []) {
  const approved = (Array.isArray(clients) ? clients : []).filter((c) => c && !c.inactivo);
  if (!isSellerProfile(currentUser)) return approved;

  const assigned = approved.filter((c) => isClientAssignedToSeller(c, currentUser, profitSellers));
  return assigned.length > 0 ? assigned : approved;
}

/**
 * Busca la factura/venta asociada a un pedido para verificar si su saldo ya fue cobrado o sigue pendiente.
 */
function findLinkedInvoiceForOrder(order, profitInvoices = [], sales = []) {
  if (!order) return null;
  const ordId = String(order.id || '').trim().toUpperCase();
  const ordNum = getOrderNumber(order).toUpperCase();
  const facId = String(order.facturaId || order.factura_id || '').trim().toUpperCase();

  const matchesDoc = (doc) => {
    if (!doc) return false;
    const dId = String(doc.id || doc.factNum || doc.numeroDoc || '').trim().toUpperCase();
    const dOrigId = String(doc.pedidoOrigenId || doc.pedido_origen_id || '').trim().toUpperCase();
    const dOrigDoc = String(doc.pedidoOrigenDoc || doc.pedido_origen_doc || '').trim().toUpperCase();
    if (facId && dId === facId) return true;
    if (ordId && (dOrigId === ordId || dOrigDoc === ordId)) return true;
    if (ordNum && (dOrigDoc === ordNum || dOrigId === ordNum)) return true;
    return false;
  };

  return (
    (Array.isArray(profitInvoices) ? profitInvoices.find(matchesDoc) : null) ||
    (Array.isArray(sales) ? sales.find(matchesDoc) : null) ||
    null
  );
}

/**
 * Evalúa el estado de vencimiento de un pedido/preventa tanto por vigencia de reserva ATP (72h)
 * como por fecha de vencimiento crediticia cuando se trata de crédito o documento abierto.
 * Retorna: { state: 'VENCIDO' | 'POR_VENCER' | 'VIGENTE' | 'PAGADO' | 'ANULADO', label, tone, daysLeft, overdueDays }
 */
export function resolveOrderExpirationStatus(order, { profitInvoices = [], sales = [], nowMs = Date.now() } = {}) {
  if (!order) {
    return { state: 'VIGENTE', label: 'Vigente', tone: 'info', daysLeft: null, overdueDays: 0 };
  }

  const st = normalizeOrderStatus(order);
  const DAY_MS = 24 * 60 * 60 * 1000;
  const HOURS_72_MS = PREVENTA_RESERVATION_HOURS * 60 * 60 * 1000;

  if (st.code === 'CADUCADO') {
    return { state: 'VENCIDO', label: 'Caducado', tone: 'danger', daysLeft: -1, overdueDays: 1 };
  }
  if (st.isCancelled) {
    return { state: 'ANULADO', label: st.label, tone: 'danger', daysLeft: null, overdueDays: 0 };
  }

  const nowDate = new Date(nowMs);
  const todayStart = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate()).getTime();
  const rawEmis = order.fechaEmision || order.fecha || order.created_at;
  const emisDate = rawEmis ? parseInvoiceDateInfo(rawEmis)?.date : null;

  // 1. Pedidos en cola previa a facturación (ATP 72h)
  if (!st.isBilled) {
    if (isOrderReservationExpired(order, nowMs)) {
      const emisMs = emisDate ? emisDate.getTime() : todayStart - HOURS_72_MS - DAY_MS;
      const overdueDays = Math.max(1, Math.ceil((nowMs - (emisMs + HOURS_72_MS)) / DAY_MS));
      return { state: 'VENCIDO', label: `Reserva >72h`, tone: 'danger', daysLeft: -overdueDays, overdueDays };
    }

    if (emisDate && !Number.isNaN(emisDate.getTime())) {
      const remainingMs = (emisDate.getTime() + HOURS_72_MS) - nowMs;
      if (remainingMs > 0 && remainingMs <= DAY_MS) {
        const hoursLeft = Math.max(1, Math.ceil(remainingMs / (60 * 60 * 1000)));
        return { state: 'POR_VENCER', label: `Vence en ${hoursLeft}h`, tone: 'warning', daysLeft: 1, overdueDays: 0 };
      }
    }

    const rawDue = order.fechaVencimiento || order.fechaEntrega;
    const dueDate = rawDue ? parseInvoiceDateInfo(rawDue)?.date : null;
    if (dueDate && !Number.isNaN(dueDate.getTime())) {
      const dueStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate()).getTime();
      const daysLeft = Math.round((dueStart - todayStart) / DAY_MS);
      if (daysLeft < 0) {
        const overdue = Math.abs(daysLeft);
        return { state: 'VENCIDO', label: `Vencido ${overdue}d`, tone: 'danger', daysLeft, overdueDays: overdue };
      }
      if (daysLeft <= 3) {
        return {
          state: 'POR_VENCER',
          label: daysLeft === 0 ? 'Vence HOY' : `Vence ${daysLeft}d`,
          tone: 'warning',
          daysLeft,
          overdueDays: 0
        };
      }
      return { state: 'VIGENTE', label: `Vigente (${daysLeft}d)`, tone: 'info', daysLeft, overdueDays: 0 };
    }

    return { state: 'VIGENTE', label: 'En plazo 72h', tone: 'info', daysLeft: 3, overdueDays: 0 };
  }

  // 2. Pedidos ya facturados: validar factura/venta vinculada y plazo de crédito
  const linkedDoc = findLinkedInvoiceForOrder(order, profitInvoices, sales);
  if (linkedDoc) {
    const hasExplicitBalance = linkedDoc.saldoUsd !== undefined || linkedDoc.saldo_usd !== undefined || linkedDoc.saldo !== undefined;
    const explicitBal = Number(linkedDoc.saldoUsd ?? linkedDoc.saldo_usd ?? linkedDoc.saldo ?? 0);
    const settled = isCxcInvoiceSettled(linkedDoc) || (hasExplicitBalance ? explicitBal <= 0.01 : !isCreditSaleRecord(linkedDoc));
    if (settled) {
      return { state: 'PAGADO', label: 'Cobrado', tone: 'success', daysLeft: null, overdueDays: 0 };
    }
  }

  const termStr = String(order.condicionPago || order.condicion_pago || 'CONTADO').toUpperCase();
  const diasCredito = resolveCreditDaysFromTerm(termStr, Number(order.diasCredito || 0), order.diasCredito);
  if (termStr === 'CONTADO' && diasCredito <= 0 && !linkedDoc) {
    return { state: 'PAGADO', label: 'Contado', tone: 'success', daysLeft: null, overdueDays: 0 };
  }

  let dueDate = null;
  const rawLinkedDue = linkedDoc?.fechaVencimiento || linkedDoc?.fecVenc || linkedDoc?.fec_venc;
  const rawOrderDue = order.fechaVencimiento || order.fechaEntrega;
  if (rawLinkedDue) dueDate = parseInvoiceDateInfo(rawLinkedDue)?.date || null;
  if (!dueDate && rawOrderDue) dueDate = parseInvoiceDateInfo(rawOrderDue)?.date || null;
  if (!dueDate && emisDate && !Number.isNaN(emisDate.getTime()) && diasCredito > 0) {
    dueDate = new Date(emisDate.getTime() + diasCredito * DAY_MS);
  }

  if (dueDate && !Number.isNaN(dueDate.getTime())) {
    const dueStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate()).getTime();
    const daysLeft = Math.round((dueStart - todayStart) / DAY_MS);
    if (daysLeft < 0) {
      const overdue = Math.abs(daysLeft);
      return { state: 'VENCIDO', label: `Vencido ${overdue}d`, tone: 'danger', daysLeft, overdueDays: overdue };
    }
    if (daysLeft <= 3) {
      return {
        state: 'POR_VENCER',
        label: daysLeft === 0 ? 'Vence HOY' : `Vence ${daysLeft}d`,
        tone: 'warning',
        daysLeft,
        overdueDays: 0
      };
    }
    return { state: 'VIGENTE', label: `Vigente (${daysLeft}d)`, tone: 'info', daysLeft, overdueDays: 0 };
  }

  return { state: 'VIGENTE', label: 'Vigente', tone: 'info', daysLeft: null, overdueDays: 0 };
}

/**
 * Habilita la consulta de Almacén e Inventario (Solo Lectura, Alm 01 + Alm 02)
 * tanto para roles con módulo 'inventario' como para fuerza de ventas / preventa.
 */
export function canAccessMobileInventory(currentUser) {
  if (!currentUser) return false;
  if (canAccessModule(currentUser?.rol, 'inventario', currentUser)) return true;
  return (
    canAccessModule(currentUser?.rol, 'preventa', currentUser) ||
    canAccessModule(currentUser?.rol, 'pedidos', currentUser) ||
    canAccessModule(currentUser?.rol, 'inventario')
  );
}

/**
 * Habilita la consulta de Cuentas por Cobrar (CxC / Cartera de Clientes)
 * tanto para roles con módulo 'cxc' como para vendedores / preventa / cobranza.
 */
export function canAccessMobileCxC(currentUser) {
  if (!currentUser) return false;
  if (canAccessModule(currentUser?.rol, 'cxc', currentUser)) return true;
  return (
    canAccessModule(currentUser?.rol, 'preventa', currentUser) ||
    canAccessModule(currentUser?.rol, 'pedidos', currentUser) ||
    canAccessModule(currentUser?.rol, 'ventas', currentUser) ||
    canAccessModule(currentUser?.rol, 'cxc')
  );
}
