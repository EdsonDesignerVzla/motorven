import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
    X, Search, FileSpreadsheet, AlertTriangle, CheckCircle, Clock,
    DollarSign, Users, Calendar, Filter, ArrowUpDown, ChevronDown,
    ChevronUp, Printer, ShieldAlert, TrendingDown, Eye, Trash2, Edit2,
    Plus, Landmark, Wallet, Receipt, FileText, Check, RefreshCw, MessageSquare,
    ExternalLink, Database
} from 'lucide-react';
import {
    REAL_PROFIT_CASH_DESKS,
    REAL_PROFIT_BANK_ACCOUNTS,
    REAL_PROFIT_SELLERS
} from '../data/supabaseRealData';
import { formatUsd, formatBs } from '../services/formatService';
import {
    CXC_DELETED_DOCS_KEY,
    getScopedCxcDeleteKeys,
    isCxcEntryDeleted,
    sanitizeCxcDeletedDocsStorage
} from '../services/supabaseService';
import { generateAccountsReceivablePDF } from '../services/pdfReportService';
import { useNotification } from '../context/NotificationContext';

const round2 = (num) => Math.round((Number(num || 0) + Number.EPSILON) * 100) / 100;

// Mapeo de condición de pago de Profit Plus a días de crédito
const FORMA_PAGO_DIAS = {
    '01': 0,   // CONTADO
    '02': 7,   // CREDITO 7 DIAS
    '03': 15,  // CREDITO 15 DIAS
    '04': 21,  // CREDITO 21 DIAS
    '05': 30,  // CREDITO 30 DIAS
    '06': 45,
    '07': 60
};

const SPANISH_MONTHS = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

const getTodayIso = () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

const parseDateSafe = (dateStr) => {
    if (!dateStr) return new Date();
    if (dateStr instanceof Date) {
        return isNaN(dateStr.getTime()) ? new Date() : dateStr;
    }
    const s = String(dateStr).trim();
    // Capturar YYYY-MM-DD al inicio (incluyendo timestamps ISO como 2026-10-23T00:00:00.000Z)
    const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
        const y = Number(isoMatch[1]);
        const m = Number(isoMatch[2]);
        const d = Number(isoMatch[3]);
        return new Date(y, m - 1, d, 12, 0, 0);
    }
    // Capturar DD/MM/YYYY o DD-MM-YYYY
    const dmyMatch = s.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/);
    if (dmyMatch) {
        const d = Number(dmyMatch[1]);
        const m = Number(dmyMatch[2]);
        const y = Number(dmyMatch[3]);
        return new Date(y, m - 1, d, 12, 0, 0);
    }
    const parsed = new Date(s);
    return isNaN(parsed.getTime()) ? new Date() : parsed;
};

const formatDateShort = (dateInput) => {
    if (!dateInput) return '—';
    const d = dateInput instanceof Date ? dateInput : parseDateSafe(dateInput);
    if (isNaN(d.getTime())) return '—';
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
};

const toIsoDateInput = (dateInput) => {
    if (!dateInput) return getTodayIso();
    if (typeof dateInput === 'string') {
        const s = dateInput.trim();
        const isoMatch = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
        const dmyMatch = s.match(/^(\d{2})[/-](\d{2})[/-](\d{4})/);
        if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
    }
    const d = dateInput instanceof Date ? dateInput : parseDateSafe(dateInput);
    if (isNaN(d.getTime())) return getTodayIso();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
};

const normalizeTextSimple = (str) =>
    String(str ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

const canonicalDocLookupKey = (rawKey, tipoDoc = 'FACTURA') => {
    const clean = String(rawKey || '').trim().toUpperCase();
    if (!clean) return '';
    if (tipoDoc === 'NOTA_ENTREGA' || clean.startsWith('NE')) {
        const numPart = clean.replace(/^NE-?/i, '').replace(/^0+(?=\d)/, '');
        return `NE:${numPart}`;
    }
    const numPart = clean.replace(/^(FAC-|FACT-)/i, '').replace(/^0+(?=\d)/, '');
    return `FAC:${numPart}`;
};

const resolveSellerFromCatalog = (rawId, rawName, sellerCatalog) => {
    const idTrim = String(rawId || '').trim().toUpperCase();
    const nameTrim = String(rawName || '').trim();

    // 1. Si el código existe directamente en el catálogo y no es genérico 'OF' cuando hay nombre de otro vendedor
    if (idTrim && idTrim !== 'OF' && sellerCatalog.has(idTrim)) {
        return {
            sellerId: idTrim,
            sellerName: sellerCatalog.get(idTrim) || nameTrim || idTrim
        };
    }

    // 2. Buscar coincidencia por nombre en el catálogo (ej. "Katherine Becerra" -> "KB")
    const candidates = [nameTrim, idTrim].filter(Boolean);
    for (const candidate of candidates) {
        const normCandidate = normalizeTextSimple(candidate);
        if (!normCandidate || normCandidate === 'of' || normCandidate === 'oficina') continue;
        for (const [catId, catName] of sellerCatalog.entries()) {
            const normCatName = normalizeTextSimple(catName);
            if (
                normCatName === normCandidate ||
                (normCandidate.length >= 4 && normCatName.includes(normCandidate)) ||
                (normCatName.length >= 4 && normCandidate.includes(normCatName))
            ) {
                return {
                    sellerId: catId,
                    sellerName: catName
                };
            }
        }
    }

    // 3. Si el ID es un código corto válido (ej. KB, CM, OF)
    if (idTrim && idTrim.length <= 5 && !idTrim.includes(' ')) {
        return {
            sellerId: idTrim,
            sellerName: sellerCatalog.get(idTrim) || nameTrim || (idTrim === 'OF' ? 'Oficina' : idTrim)
        };
    }

    return {
        sellerId: 'OF',
        sellerName: nameTrim || sellerCatalog.get('OF') || 'Oficina'
    };
};

const inferDocType = (raw) => {
    const explicit = String(raw?.tipoDoc || raw?.tipo_doc || raw?.docType || '').toUpperCase().trim();
    if (explicit === 'NOTA_ENTREGA' || explicit === 'N/E' || explicit === 'NE') {
        return 'NOTA_ENTREGA';
    }
    const idStr = String(raw?.id || '').toUpperCase().trim();
    const factStr = String(raw?.factNum || raw?.factura || raw?.numeroDoc || '').toUpperCase().trim();
    const origStr = String(raw?.pedidoOrigenDoc || raw?.pedido_origen_doc || '').toUpperCase().trim();
    if (
        idStr.startsWith('NE-') ||
        idStr.startsWith('NDE-') ||
        factStr.startsWith('NE-') ||
        factStr.startsWith('NDE-') ||
        factStr.startsWith('NE') ||
        origStr.startsWith('PED-NE')
    ) {
        return 'NOTA_ENTREGA';
    }
    if (explicit === 'FACTURA' || explicit === 'FACT') {
        return 'FACTURA';
    }
    return 'FACTURA';
};

export function AccountsReceivableModal({
    isOpen = true,
    onClose,
    invoices = [],
    sales = [],
    clients = [],
    sellers = [],
    profitSellers = [],
    config = {},
    currentUser = null,
    profitInvoices = [],
    bankAccounts = [],
    cashDesks = [],
    collections = [],
    onDeleteSale,
    onSaveDocument,
    onRegisterCollection,
    onOpenCollectionIntelligence
}) {
    // Notificaciones corporativas del sistema
    let notify = { success: () => {}, error: () => {}, warning: () => {}, info: () => {} };
    try {
        const notifHook = useNotification();
        if (notifHook) notify = notifHook;
    } catch (e) {
        // Fallback silencioso
    }

    // Selector superior entre Facturas Fiscales y Notas de Entrega
    const [activeDocType, setActiveDocType] = useState('FACTURA'); // 'FACTURA' | 'NOTA_ENTREGA'

    // Filtros del Reporte (Parte B)
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedClient, setSelectedClient] = useState('ALL');
    const [selectedSeller, setSelectedSeller] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'VENCIDA' | 'POR_VENCER' | 'PAGADA'
    const [sortField, setSortField] = useState('fechaEmision');
    const [sortDirection, setSortDirection] = useState('desc');
    const [selectedInvoiceDetail, setSelectedInvoiceDetail] = useState(null);
    const [deletingKey, setDeletingKey] = useState(null);

    // Mantener visibles en la sesión los documentos que recibieron cobro (incluso si Restante llega a $0.00)
    const [recentlyPaidKeys, setRecentlyPaidKeys] = useState(() => new Set());

    // Overrides locales reactivos para respuesta instantánea al registrar cobro o editar documento
    const [localDocOverrides, setLocalDocOverrides] = useState({});

    // ========================================================================
    // PARTE A: Estado del Formulario "Para Registrar Cobros"
    // ========================================================================
    const tasaBcv = Number(config?.tasaDolar) > 0 ? Number(config.tasaDolar) : 451.51;
    const [cobroDocKey, setCobroDocKey] = useState('');
    const [cobroDocSearch, setCobroDocSearch] = useState('');
    const [cobroTasa, setCobroTasa] = useState(String(tasaBcv));
    const [cobroFecha, setCobroFecha] = useState(getTodayIso());
    const [cobroCuentaKey, setCobroCuentaKey] = useState('');
    const [cobroMontoUsd, setCobroMontoUsd] = useState('');
    const [cobroMontoBs, setCobroMontoBs] = useState('');
    const [cobroReferencia, setCobroReferencia] = useState('');
    const [cobroFeedback, setCobroFeedback] = useState(null);
    const [isSavingCobro, setIsSavingCobro] = useState(false);

    // ========================================================================
    // Estado del Modal de Edición / Creación de Documento (Factura o Nota de Entrega)
    // ========================================================================
    const [editingDoc, setEditingDoc] = useState(null);
    const [isCreatingDoc, setIsCreatingDoc] = useState(false);
    const [isSavingDoc, setIsSavingDoc] = useState(false);

    // Sincronizar tasa por defecto cuando abre o cambia la configuración
    useEffect(() => {
        if (tasaBcv > 0) {
            setCobroTasa(String(tasaBcv));
        }
    }, [tasaBcv]);

    // Catálogo unificado de Caja y Bancos para la Parte A
    const catalogCuentas = useMemo(() => {
        const desksSource = Array.isArray(cashDesks) && cashDesks.length > 0 ? cashDesks : REAL_PROFIT_CASH_DESKS;
        const banksSource = Array.isArray(bankAccounts) && bankAccounts.length > 0 ? bankAccounts : REAL_PROFIT_BANK_ACCOUNTS;

        const list = [];
        desksSource.forEach((c, idx) => {
            const id = c.id || c.co_caja || c.coCaja || `caja-${idx}`;
            const code = c.coCaja || c.co_caja || id;
            const desc = c.descripcion || c.desCaja || c.des_caja || c.nombre || c.descrip || `Caja ${code}`;
            list.push({
                key: `CAJA:${id}`,
                accountType: 'CAJA',
                id,
                nombre: desc,
                moneda: c.moneda || 'USD',
                saldoUsd: Number(c.saldoUsd || c.saldo_usd || 0),
                saldoBs: Number(c.saldoBs || c.saldo_bs || 0),
                label: `[${code} • ${c.moneda || 'USD'}] ${desc}`
            });
        });

        banksSource.forEach((b, idx) => {
            const code = b.cod_cta || b.codCta || b.code || b.id || `cta-${idx}`;
            const num = b.numCta || b.num_cta || b.nroCta || b.nro_cta || code;
            const bancoName = b.bancoNombre || b.banco_nombre || b.banco || b.des_ban || b.desBan || 'Banco';
            list.push({
                key: `BANCO:${code}`,
                accountType: 'BANCO',
                id: code,
                nombre: `${bancoName} (${num})`,
                moneda: b.moneda || 'BS',
                saldoUsd: Number(b.saldoUsd || b.saldo_usd || 0),
                saldoBs: Number(b.saldoBs || b.saldo_bs || 0),
                label: `[BANCO ${b.moneda || 'BS'}] ${code} — ${bancoName} (${num})`
            });
        });

        return list;
    }, [cashDesks, bankAccounts]);

    // Seleccionar primera cuenta por defecto si no hay ninguna seleccionada
    useEffect(() => {
        if (!cobroCuentaKey && catalogCuentas.length > 0) {
            setCobroCuentaKey(catalogCuentas[0].key);
        }
    }, [catalogCuentas, cobroCuentaKey]);

    // Catálogo de Vendedores (incluyendo siempre la base completa de vendedores Profit)
    const sellerCatalog = useMemo(() => {
        const map = new Map();
        (REAL_PROFIT_SELLERS || []).forEach(s => {
            const id = String(s.id || s.co_ven || '').trim().toUpperCase();
            if (id) map.set(id, s.name || s.ven_des || id);
        });
        (profitSellers || []).forEach(s => {
            const id = String(s.id || s.co_ven || '').trim().toUpperCase();
            if (id) map.set(id, s.name || s.ven_des || id);
        });
        (sellers || []).forEach(s => {
            const id = String(s.id || s.co_ven || '').trim().toUpperCase();
            if (id) map.set(id, s.name || s.ven_des || id);
        });
        return map;
    }, [sellers, profitSellers]);

    // Procesar todas las facturas y notas de entrega (Profit Plus + Ventas POS + Documentos creados/editados)
    const allDocuments = useMemo(() => {
        if (isOpen === false) return [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const rawMap = new Map();
        const canonicalKeyToRawKey = new Map();
        const effectiveSales = Array.isArray(invoices) && invoices.length > 0 ? invoices : (Array.isArray(sales) ? sales : []);

        // Leer documentos eliminados de forma persistente desde localStorage (con limpieza única de colisiones previas)
        const delSet = new Set(sanitizeCxcDeletedDocsStorage().map(k => String(k).trim()).filter(Boolean));
        const isDocDeleted = (docOrObj) => isCxcEntryDeleted(docOrObj, delSet);

        // 1. Cargar documentos desde profitInvoices (omitiendo eliminados y unificando duplicados 000583 / 583)
        (profitInvoices || []).forEach(inv => {
            const key = String(inv.factNum || inv.id || '').trim();
            if (!key || isDocDeleted(inv)) return;
            const docType = inferDocType(inv);
            const cKey = canonicalDocLookupKey(key, docType);
            const isPosFormat = /^0+\d+$/.test(key) || /^NE-0+\d+$/i.test(key);
            const resolvedInvSeller = resolveSellerFromCatalog(
                inv.vendedorId || inv.co_ven,
                inv.vendedorNombre || inv.vendedor,
                sellerCatalog
            );
            const normalizedInv = {
                ...inv,
                vendedorId: resolvedInvSeller.sellerId,
                vendedorNombre: resolvedInvSeller.sellerName,
                _source: isPosFormat ? 'POS' : 'PROFIT',
                _isPosSale: isPosFormat
            };

            const existingRawKey = cKey ? canonicalKeyToRawKey.get(cKey) : null;
            if (existingRawKey && rawMap.has(existingRawKey)) {
                const existing = rawMap.get(existingRawKey);
                const existingRif = String(existing.clienteRif || existing.rif || '').replace(/[-.\s]/g, '').toUpperCase();
                const incomingRif = String(inv.clienteRif || inv.rif || '').replace(/[-.\s]/g, '').toUpperCase();
                const sameClient =
                    (existingRif && incomingRif && existingRif === incomingRif) ||
                    normalizeTextSimple(existing.clienteNombre) === normalizeTextSimple(inv.clienteNombre);

                if (sameClient) {
                    const preferredKey = /^0+\d+$/.test(existingRawKey) && !/^0+\d+$/.test(key) ? key : existingRawKey;
                    const mergedSeller = resolveSellerFromCatalog(
                        existing.vendedorId && existing.vendedorId !== 'OF' ? existing.vendedorId : normalizedInv.vendedorId,
                        existing.vendedorNombre || normalizedInv.vendedorNombre,
                        sellerCatalog
                    );
                    if (preferredKey !== existingRawKey) {
                        rawMap.delete(existingRawKey);
                    }
                    rawMap.set(preferredKey, {
                        ...existing,
                        ...normalizedInv,
                        factNum: preferredKey,
                        vendedorId: mergedSeller.sellerId,
                        vendedorNombre: mergedSeller.sellerName
                    });
                    if (cKey) canonicalKeyToRawKey.set(cKey, preferredKey);
                    return;
                }
            }

            rawMap.set(key, normalizedInv);
            if (cKey) canonicalKeyToRawKey.set(cKey, key);
        });

        // 2. Cargar todas las Facturas Fiscales y Notas de Entrega emitidas en POS (sales/invoices)
        effectiveSales.forEach(sale => {
            const rawTipo = String(sale.tipoDoc || sale.tipo_doc || '').toUpperCase().trim();
            if (rawTipo === 'NOTA_CREDITO' || rawTipo === 'COTIZACION') return;
            const saleDocType = inferDocType(sale);
            const isNotaEntregaSale = saleDocType === 'NOTA_ENTREGA';
            const key = String(sale.factura || sale.factNum || sale.numeroDoc || sale.id || '').trim();
            if (!key || isDocDeleted({ ...sale, tipoDoc: saleDocType })) return;

            const cKey = canonicalDocLookupKey(key, saleDocType);
            const existingRawKey = rawMap.has(key) ? key : (cKey ? canonicalKeyToRawKey.get(cKey) : null);

            const rawSaleTotal = Number(sale.totalUsd ?? sale.totNetoUsd ?? 0);
            const rawSaleIva = Number(sale.impuestoUsd ?? sale.ivaUsd ?? 0);
            const rawSaleSub = Number(
                sale.subtotalUsd ??
                sale.totBrutoUsd ??
                (rawSaleIva > 0 && rawSaleTotal > rawSaleIva ? rawSaleTotal - rawSaleIva : rawSaleTotal)
            );
            const neNetoSinIva = round2(
                rawSaleSub > 0 && rawSaleSub < rawSaleTotal
                    ? rawSaleSub
                    : (rawSaleIva > 0 && rawSaleTotal > rawSaleIva ? rawSaleTotal - rawSaleIva : rawSaleSub)
            );
            const effectiveTotBruto = isNotaEntregaSale ? neNetoSinIva : round2(rawSaleSub);
            const effectiveIva = isNotaEntregaSale ? 0 : round2(rawSaleIva);
            const effectiveTotNeto = isNotaEntregaSale ? neNetoSinIva : round2(rawSaleTotal || (effectiveTotBruto + effectiveIva));

            const hasExplicitCobros = Array.isArray(sale.historialCobros) && sale.historialCobros.length > 0;
            const effectiveAbonos = hasExplicitCobros
                ? Number(sale.abonosUsd ?? sale.montoPagadoUsd ?? 0)
                : 0;
            const effectiveSaldo = Math.max(0, round2(effectiveTotNeto - effectiveAbonos));

            const resolvedSaleSeller = resolveSellerFromCatalog(
                sale.vendedorId,
                sale.vendedor || sale.vendedorNombre,
                sellerCatalog
            );

            if (!existingRawKey) {
                rawMap.set(key, {
                    id: sale.id || `DOC-${key}`,
                    factNum: key,
                    tipoDoc: saleDocType,
                    fechaEmision: sale.fechaEmision || sale.fecha || getTodayIso(),
                    fechaVencimiento: sale.fechaVencimiento || sale.fechaEmision || sale.fecha || getTodayIso(),
                    clienteId: sale.clienteId || '',
                    clienteNombre: sale.cliente || sale.clienteNombre || 'Cliente General',
                    clienteRif: sale.rif || sale.clienteRif || 'N/A',
                    vendedorId: resolvedSaleSeller.sellerId,
                    vendedorNombre: resolvedSaleSeller.sellerName,
                    formaPago: Number(sale.diasCredito || 0) > 0 ? '03' : '01',
                    diasCredito: sale.diasCredito !== undefined ? Number(sale.diasCredito) : 0,
                    diasVencidoCustom: sale.diasVencidoCustom !== undefined ? sale.diasVencidoCustom : null,
                    totBrutoUsd: effectiveTotBruto,
                    ivaUsd: effectiveIva,
                    totNetoUsd: effectiveTotNeto,
                    abonosUsd: effectiveAbonos,
                    saldoUsd: effectiveSaldo,
                    moneda: sale.moneda || 'USD',
                    tasa: Number(sale.tasa || sale.tasaDolar || tasaBcv),
                    anulada: Boolean(sale.anulada),
                    items: sale.items || [],
                    observaciones: sale.observaciones || '',
                    historialCobros: sale.historialCobros || [],
                    _source: 'POS',
                    _isPosSale: true
                });
                if (cKey) canonicalKeyToRawKey.set(cKey, key);
            } else {
                const existing = rawMap.get(existingRawKey);
                const resolvedMergedSeller = resolveSellerFromCatalog(
                    existing.vendedorId && existing.vendedorId !== 'OF' ? existing.vendedorId : resolvedSaleSeller.sellerId,
                    existing.vendedorNombre || resolvedSaleSeller.sellerName,
                    sellerCatalog
                );
                const existingIsProfit = existing._source === 'PROFIT' || existing._isPosSale === false;
                rawMap.set(existingRawKey, {
                    ...existing,
                    fechaEmision: existing.fechaEmision || sale.fechaEmision || sale.fecha,
                    vendedorId: resolvedMergedSeller.sellerId,
                    vendedorNombre: resolvedMergedSeller.sellerName,
                    _source: existing._source || (existingIsProfit ? 'PROFIT' : 'POS'),
                    _isPosSale: Boolean(existing._isPosSale)
                });
            }
        });

        // 3. Aplicar overrides locales de esta sesión (respetando cambios remotos más recientes vía SSE)
        Object.entries(localDocOverrides).forEach(([key, override]) => {
            if (override?._deleted) {
                rawMap.delete(key);
                const cleanKey = String(key).replace(/^(FAC-|FACT-|NE-|fac-|doc-|inv-)/i, '').trim();
                for (const mapK of Array.from(rawMap.keys())) {
                    const cleanMapK = String(mapK).replace(/^(FAC-|FACT-|NE-|fac-|doc-|inv-)/i, '').trim();
                    if (cleanMapK === cleanKey || mapK === key) {
                        rawMap.delete(mapK);
                    }
                }
                return;
            }
            const existing = rawMap.get(key) || {};
            const existingTs = Date.parse(existing.updated_at || existing.fechaSincronizacion || existing.fecha_sincronizacion || '') || 0;
            const localTs = Date.parse(override?._localSavedAt || override?.updated_at || override?.fechaSincronizacion || '') || 0;
            if (existingTs > 0 && localTs > 0 && existingTs > localTs) {
                return;
            }
            rawMap.set(key, { ...existing, ...override });
        });

        const processed = [];

        rawMap.forEach((inv, mapKey) => {
            if (inv.anulada) return;

            const factNum = String(inv.factNum || inv.factura || mapKey).trim();
            const tipoDoc = inferDocType(inv);
            const isNotaEntrega = tipoDoc === 'NOTA_ENTREGA';
            const isPosDoc = Boolean(inv._isPosSale) || inv._source === 'POS' || /^0+\d+$/.test(factNum) || /^NE-0+\d+$/i.test(factNum);

            // En Notas de Entrega NO se calcula IVA ni ningún impuesto (100% Sin IVA)
            const rawNetoVal = inv.totNetoUsd ?? inv.tot_neto_usd ?? inv.totalUsd ?? inv.total_usd ?? inv.totBrutoUsd ?? inv.tot_bruto_usd ?? 0;
            const rawNeto = Number(rawNetoVal);
            const rawIvaVal = inv.ivaUsd ?? inv.iva_usd ?? inv.impuestoUsd ?? inv.impuesto_usd ?? 0;
            const rawIva = Number(rawIvaVal);
            const rawBrutoCandidate = Number(
                inv.totBrutoUsd ??
                inv.tot_bruto_usd ??
                inv.subtotalUsd ??
                inv.subtotal_usd ??
                (isNotaEntrega
                    ? (rawIva > 0 && rawNeto > rawIva ? rawNeto - rawIva : rawNeto)
                    : round2(rawNeto / 1.16))
            );
            const totBrutoUsd = isNotaEntrega
                ? round2(
                    rawBrutoCandidate > 0 && rawBrutoCandidate < rawNeto
                        ? rawBrutoCandidate
                        : (rawIva > 0 && rawNeto > rawIva ? rawNeto - rawIva : rawBrutoCandidate)
                )
                : round2(rawBrutoCandidate);
            const hasExplicitIva = inv.ivaUsd !== undefined || inv.iva_usd !== undefined;
            const ivaUsd = isNotaEntrega ? 0 : round2(hasExplicitIva ? Number(inv.ivaUsd ?? inv.iva_usd ?? 0) : Math.max(0, rawNeto - totBrutoUsd));
            const montoFacturaUsd = isNotaEntrega
                ? totBrutoUsd
                : round2(Number(inv.totNetoUsd ?? inv.tot_neto_usd ?? (totBrutoUsd + ivaUsd)));

            // Cálculo de Abonos y Restante
            const rawSaldoField = inv.saldoUsd ?? inv.saldo_usd;
            const rawAbonosField = inv.abonosUsd ?? inv.abonos_usd;
            const statusUpper = String(inv.status || inv.estado || '').toUpperCase().trim();
            const isExplicitlySettled =
                statusUpper === 'COBRADA' ||
                statusUpper === 'PAGADO' ||
                statusUpper === 'PAGADA' ||
                Boolean(inv._customCreated) ||
                (rawAbonosField !== undefined && rawAbonosField !== null && !isNaN(Number(rawAbonosField)) && Number(rawAbonosField) > 0.01);
            const hasCobroHistory = Array.isArray(inv.historialCobros) && inv.historialCobros.length > 0;
            const hasManualOverride = Boolean(localDocOverrides[factNum]) || recentlyPaidKeys.has(factNum);
            let abonosUsd = 0;
            if (isPosDoc && !isExplicitlySettled && !hasCobroHistory && !hasManualOverride && Number(rawSaldoField ?? 0) <= 0.01) {
                // Facturas emitidas desde el POS sin cobros ni edición registrados en CxC inician pendientes por cobrar en CxC
                abonosUsd = 0;
            } else if (rawAbonosField !== undefined && rawAbonosField !== null && !isNaN(Number(rawAbonosField))) {
                abonosUsd = round2(Math.max(0, Number(rawAbonosField)));
            } else if (rawSaldoField !== undefined && rawSaldoField !== null && !isNaN(Number(rawSaldoField))) {
                const numericSaldo = Number(rawSaldoField);
                const baseForAbonos = (!isNotaEntrega || numericSaldo <= montoFacturaUsd) ? montoFacturaUsd : rawNeto;
                abonosUsd = round2(Math.max(0, baseForAbonos - numericSaldo));
            }
            if (abonosUsd > montoFacturaUsd) {
                abonosUsd = montoFacturaUsd;
            }
            const restanteUsd = round2(Math.max(0, montoFacturaUsd - abonosUsd));

            // Solo las facturas/NE con saldo pendiente pertenecen a la cartera activa del listview principal.
            // Al llegar a PAGADA (restante <= $0.01) desaparecen en tiempo real del listview y pasan a "Solventes".
            const isCarteraActiva = restanteUsd > 0.01;

            // Fechas de Emisión, Vencimiento, Días de Crédito y Días de Vencido
            const fechaEmisionDate = parseDateSafe(inv.fechaEmision || inv.fecha);
            const fechaEmisionIso = toIsoDateInput(inv.fechaEmision || inv.fecha);

            let diasCredito = inv.diasCredito !== undefined && inv.diasCredito !== null && inv.diasCredito !== ''
                ? Number(inv.diasCredito)
                : (FORMA_PAGO_DIAS[String(inv.formaPago || '').trim()] ?? null);

            let fechaVencDate;
            let fechaVencIso;
            if (inv.fechaVencimiento) {
                fechaVencDate = parseDateSafe(inv.fechaVencimiento);
                fechaVencIso = toIsoDateInput(inv.fechaVencimiento);
            } else {
                const dc = diasCredito !== null && !isNaN(diasCredito) && diasCredito > 0 ? diasCredito : 15;
                fechaVencDate = new Date(fechaEmisionDate);
                fechaVencDate.setDate(fechaVencDate.getDate() + dc);
                fechaVencIso = toIsoDateInput(fechaVencDate);
            }

            // Si fechaVencimiento coincide con fechaEmisión y diasCredito es 0 en un documento por cobrar (CxC),
            // asignar 15 días de crédito estándar para evitar que se marque erróneamente como vencido
            const diffEmisVenc = Math.round((fechaVencDate.getTime() - fechaEmisionDate.getTime()) / (1000 * 60 * 60 * 24));
            if (diffEmisVenc > 0) {
                diasCredito = diffEmisVenc;
            } else if (diasCredito === null || isNaN(diasCredito) || diasCredito <= 0) {
                diasCredito = 15;
                fechaVencDate = new Date(fechaEmisionDate);
                fechaVencDate.setDate(fechaVencDate.getDate() + 15);
                fechaVencIso = toIsoDateInput(fechaVencDate);
            }

            const vencMidnight = new Date(fechaVencDate);
            vencMidnight.setHours(0, 0, 0, 0);
            const diffVencDays = Math.floor((today.getTime() - vencMidnight.getTime()) / (1000 * 60 * 60 * 24));

            const hasExplicitSessionCustomDays = localDocOverrides[factNum]?.diasVencidoCustom !== undefined &&
                localDocOverrides[factNum]?.diasVencidoCustom !== null &&
                localDocOverrides[factNum]?.diasVencidoCustom !== '';

            const diasVencidos = hasExplicitSessionCustomDays
                ? Number(localDocOverrides[factNum].diasVencidoCustom)
                : (inv.diasVencidoCustom !== undefined && inv.diasVencidoCustom !== null && inv.diasVencidoCustom !== '' && Number(inv.diasVencidoCustom) > 0)
                    ? Math.max(Number(inv.diasVencidoCustom), Math.max(0, diffVencDays))
                    : Math.max(0, diffVencDays);

            // Datos de Cliente y Vendedor (resolviendo código y nombre contra catálogo)
            const clientObj = clients.find(c =>
                (inv.clienteId && c.id === inv.clienteId) ||
                (inv.clienteRif && c.rif === inv.clienteRif) ||
                (inv.clienteNombre && c.name?.toLowerCase() === inv.clienteNombre?.toLowerCase())
            );
            const { sellerId, sellerName } = resolveSellerFromCatalog(
                inv.vendedorId,
                inv.vendedorNombre || inv.vendedor,
                sellerCatalog
            );
            const tasaDoc = Number(inv.tasa || tasaBcv) || tasaBcv;

            processed.push({
                id: inv.id || `INV-${factNum}`,
                factura: factNum,
                factNum,
                tipoDoc,
                vendedorId: sellerId,
                vendedor: sellerId,
                vendedorNombre: sellerName,
                vendedorDisplay: sellerName && sellerName !== sellerId ? `${sellerId} - ${sellerName}` : sellerId,
                clienteId: inv.clienteId || clientObj?.id || 'CLI-GEN',
                cliente: inv.clienteNombre || clientObj?.name || 'Cliente General',
                rif: inv.clienteRif || clientObj?.rif || 'J-00000000-0',
                telefono: clientObj?.phone || 'N/A',
                direccion: clientObj?.address || 'N/A',
                fechaEmision: fechaEmisionDate,
                fechaEmisionIso,
                fechaVencimiento: fechaVencDate,
                fechaVencimientoIso: fechaVencIso,
                diasCredito: Number(diasCredito || 0),
                diasVencidos: restanteUsd <= 0.01 ? 0 : Number(diasVencidos || 0),
                diasVencidoCustom: inv.diasVencidoCustom ?? null,
                subtotalUsd: totBrutoUsd,
                ivaUsd,
                montoFacturaUsd,
                abonosUsd,
                restanteUsd,
                totalFacturaUsd: montoFacturaUsd,
                montoPagadoUsd: abonosUsd,
                saldoPendienteUsd: restanteUsd,
                totalFacturaBs: round2(montoFacturaUsd * tasaDoc),
                abonosBs: round2(abonosUsd * tasaDoc),
                saldoPendienteBs: round2(restanteUsd * tasaDoc),
                tasa: tasaDoc,
                formaPago: inv.formaPago || (diasCredito === 0 ? '01' : '03'),
                estado: restanteUsd <= 0.01 ? 'PAGADA' : (diasVencidos > 0 ? 'VENCIDA' : 'POR_VENCER'),
                isCarteraActiva,
                items: inv.items || [],
                observaciones: inv.observaciones || '',
                historialCobros: Array.isArray(inv.historialCobros) ? inv.historialCobros : []
            });
        });

        return processed;
    }, [isOpen, profitInvoices, invoices, sales, clients, sellerCatalog, tasaBcv, localDocOverrides, recentlyPaidKeys]);

    // Contadores para el selector superior (cartera activa por cobrar)
    const docTypeCounts = useMemo(() => {
        let facturas = 0;
        let notasEntrega = 0;
        allDocuments.forEach(d => {
            if (!d.isCarteraActiva) return;
            if (d.tipoDoc === 'NOTA_ENTREGA') notasEntrega++;
            else facturas++;
        });
        return { facturas, notasEntrega };
    }, [allDocuments]);

    // Todos los documentos del tipo activo (incluyendo solventes históricos para la pestaña Solventes)
    const allDocsForActiveType = useMemo(() => {
        return allDocuments.filter(doc => doc.tipoDoc === activeDocType);
    }, [allDocuments, activeDocType]);

    // Documentos de cartera activa del tipo seleccionado (para Parte A y vista por defecto)
    const docsForActiveType = useMemo(() => {
        return allDocsForActiveType.filter(doc => doc.isCarteraActiva);
    }, [allDocsForActiveType]);

    // Documentos pendientes seleccionables en Parte A
    const payableDocsForActiveType = useMemo(() => {
        return docsForActiveType
            .filter(doc => doc.restanteUsd > 0.009)
            .sort((a, b) => b.diasVencidos - a.diasVencidos);
    }, [docsForActiveType]);

    const normalizeKeyword = (str) =>
        String(str ?? '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();

    const buildDocSearchBlob = (doc) => {
        const emisDate = doc.fechaEmision instanceof Date ? doc.fechaEmision : parseDateSafe(doc.fechaEmisionIso);
        const vencDate = doc.fechaVencimiento instanceof Date ? doc.fechaVencimiento : parseDateSafe(doc.fechaVencimientoIso);
        const emisMonth = !isNaN(emisDate.getTime()) ? SPANISH_MONTHS[emisDate.getMonth()] || '' : '';
        const vencMonth = !isNaN(vencDate.getTime()) ? SPANISH_MONTHS[vencDate.getMonth()] || '' : '';

        return normalizeKeyword([
            doc.factura,
            `#${doc.factura}`,
            String(doc.factura || '').replace(/^0+/, ''),
            doc.factNum,
            doc.cliente,
            doc.rif,
            String(doc.rif || '').replace(/[-.\s]/g, ''),
            doc.vendedorId,
            doc.vendedorNombre,
            doc.vendedorDisplay,
            doc.fechaEmisionIso,
            formatDateShort(doc.fechaEmision),
            emisMonth,
            doc.fechaVencimientoIso,
            formatDateShort(doc.fechaVencimiento),
            vencMonth,
            `${doc.diasVencidos} dias`,
            `${doc.diasCredito} dias`,
            Number(doc.montoFacturaUsd || 0).toFixed(2),
            Number(doc.montoFacturaUsd || 0).toFixed(2).replace('.', ','),
            Number(doc.abonosUsd || 0).toFixed(2),
            Number(doc.abonosUsd || 0).toFixed(2).replace('.', ','),
            Number(doc.restanteUsd || 0).toFixed(2),
            Number(doc.restanteUsd || 0).toFixed(2).replace('.', ','),
            Number(doc.totalFacturaBs || 0).toFixed(2),
            Number(doc.saldoPendienteBs || 0).toFixed(2),
            doc.estado === 'VENCIDA'
                ? 'vencida vencido vencidos mora atrasado'
                : doc.estado === 'POR_VENCER'
                    ? 'al dia por vencer vigente corriente'
                    : 'pagada pagado solvente solventes cancelada',
            doc.observaciones || ''
        ].join(' '));
    };

    // Documentos filtrados por el buscador de la Parte A (Multi-palabra clave)
    const searchedPayableDocs = useMemo(() => {
        const tokens = normalizeKeyword(cobroDocSearch).split(/\s+/).filter(Boolean);
        if (tokens.length === 0) return payableDocsForActiveType;
        return payableDocsForActiveType.filter(doc => {
            const blob = buildDocSearchBlob(doc);
            return tokens.every(t => blob.includes(t));
        });
    }, [payableDocsForActiveType, cobroDocSearch]);

    // Documento actualmente seleccionado en la Parte A
    const selectedCobroDoc = useMemo(() => {
        if (!cobroDocKey) return null;
        return docsForActiveType.find(d => String(d.factNum) === String(cobroDocKey)) || null;
    }, [docsForActiveType, cobroDocKey]);

    // Sincronizar selección si la búsqueda deja por fuera el documento actual
    useEffect(() => {
        if (cobroDocSearch.trim() && searchedPayableDocs.length > 0) {
            const exists = searchedPayableDocs.some(d => String(d.factNum) === String(cobroDocKey));
            if (!exists) {
                const first = searchedPayableDocs[0];
                setCobroDocKey(first.factNum);
                const rate = Number(cobroTasa) > 0 ? Number(cobroTasa) : tasaBcv;
                setCobroMontoUsd(String(first.restanteUsd.toFixed(2)));
                setCobroMontoBs(String(round2(first.restanteUsd * rate).toFixed(2)));
            }
        }
    }, [searchedPayableDocs, cobroDocSearch]);

    // Al alternar pestaña, sincronizar el selector de Parte A
    useEffect(() => {
        if (selectedCobroDoc && selectedCobroDoc.tipoDoc === activeDocType) return;
        if (payableDocsForActiveType.length > 0) {
            const firstDoc = payableDocsForActiveType[0];
            setCobroDocKey(firstDoc.factNum);
            const rate = Number(cobroTasa) > 0 ? Number(cobroTasa) : tasaBcv;
            setCobroMontoUsd(String(firstDoc.restanteUsd.toFixed(2)));
            setCobroMontoBs(String(round2(firstDoc.restanteUsd * rate).toFixed(2)));
        } else {
            setCobroDocKey('');
            setCobroMontoUsd('');
            setCobroMontoBs('');
        }
    }, [activeDocType, payableDocsForActiveType.length]);

    // Lista de vendedores disponibles con conteo de documentos para el filtro de Parte B
    const sellerFilterOptions = useMemo(() => {
        const sourcePool = statusFilter === 'PAGADA' ? allDocsForActiveType : docsForActiveType;
        const counts = new Map();
        sourcePool.forEach(d => {
            const vId = d.vendedorId || 'OF';
            counts.set(vId, (counts.get(vId) || 0) + 1);
        });
        const allIds = new Set([...counts.keys(), ...sellerCatalog.keys()]);
        return Array.from(allIds)
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b, 'es'))
            .map(vId => ({
                id: vId,
                name: sellerCatalog.get(vId) || vId,
                count: counts.get(vId) || 0
            }))
            .filter(item => item.count > 0 || sellerCatalog.has(item.id));
    }, [docsForActiveType, allDocsForActiveType, statusFilter, sellerCatalog]);

    // Contadores en vivo para los botones de estado (Todos | Vencidos | Al Día | Solventes) respetando búsqueda y vendedor
    const statusButtonCounts = useMemo(() => {
        const tokens = normalizeKeyword(searchTerm).split(/\s+/).filter(Boolean);
        const matchesBaseFilters = (inv) => {
            const matchesSearch = tokens.length === 0 || (() => {
                const blob = buildDocSearchBlob(inv);
                return tokens.every(t => blob.includes(t));
            })();
            const matchesClient = selectedClient === 'ALL' || inv.clienteId === selectedClient || inv.rif === selectedClient;
            const matchesSeller = selectedSeller === 'ALL' || inv.vendedorId === selectedSeller;
            return matchesSearch && matchesClient && matchesSeller;
        };

        let allCount = 0;
        let vencidaCount = 0;
        let porVencerCount = 0;
        let pagadaCount = 0;

        allDocsForActiveType.forEach(inv => {
            if (!matchesBaseFilters(inv)) return;
            if (inv.estado === 'PAGADA') {
                pagadaCount++;
                if (inv.isCarteraActiva) allCount++;
            } else if (inv.isCarteraActiva) {
                allCount++;
                if (inv.estado === 'VENCIDA') vencidaCount++;
                else if (inv.estado === 'POR_VENCER') porVencerCount++;
            }
        });

        return {
            ALL: allCount,
            VENCIDA: vencidaCount,
            POR_VENCER: porVencerCount,
            PAGADA: pagadaCount
        };
    }, [allDocsForActiveType, searchTerm, selectedClient, selectedSeller]);

    // Filtrado y Ordenamiento para la Parte B
    const filteredInvoices = useMemo(() => {
        const tokens = normalizeKeyword(searchTerm).split(/\s+/).filter(Boolean);
        const sourceDocs = statusFilter === 'PAGADA' ? allDocsForActiveType : docsForActiveType;

        return sourceDocs.filter(inv => {
            const matchesSearch = tokens.length === 0 || (() => {
                const blob = buildDocSearchBlob(inv);
                return tokens.every(t => blob.includes(t));
            })();

            const matchesClient = selectedClient === 'ALL' || inv.clienteId === selectedClient || inv.rif === selectedClient;
            const matchesSeller = selectedSeller === 'ALL' || inv.vendedorId === selectedSeller;
            const matchesStatus = statusFilter === 'ALL'
                ? inv.isCarteraActiva
                : inv.estado === statusFilter;

            return matchesSearch && matchesClient && matchesSeller && matchesStatus;
        }).sort((a, b) => {
            // Ordenamiento cronológico exacto por Fecha de Emisión o Fecha de Vencimiento
            if (sortField === 'fechaEmision' || sortField === 'fechaVencimiento') {
                const isoKey = sortField === 'fechaEmision' ? 'fechaEmisionIso' : 'fechaVencimientoIso';
                const isoA = String(a[isoKey] || '');
                const isoB = String(b[isoKey] || '');
                if (isoA !== isoB) {
                    return sortDirection === 'asc'
                        ? isoA.localeCompare(isoB)
                        : isoB.localeCompare(isoA);
                }
                return sortDirection === 'asc'
                    ? String(a.factura).localeCompare(String(b.factura), 'es', { numeric: true })
                    : String(b.factura).localeCompare(String(a.factura), 'es', { numeric: true });
            }

            let valA = a[sortField];
            let valB = b[sortField];

            if (valA instanceof Date) valA = valA.getTime();
            if (valB instanceof Date) valB = valB.getTime();

            if (typeof valA === 'string' && typeof valB === 'string') {
                const cmp = valA.localeCompare(valB, 'es', { numeric: true });
                if (cmp !== 0) return sortDirection === 'asc' ? cmp : -cmp;
            } else {
                const numA = Number(valA ?? 0);
                const numB = Number(valB ?? 0);
                if (numA < numB) return sortDirection === 'asc' ? -1 : 1;
                if (numA > numB) return sortDirection === 'asc' ? 1 : -1;
            }

            return sortDirection === 'asc'
                ? String(a.factura).localeCompare(String(b.factura), 'es', { numeric: true })
                : String(b.factura).localeCompare(String(a.factura), 'es', { numeric: true });
        });
    }, [docsForActiveType, allDocsForActiveType, searchTerm, selectedClient, selectedSeller, statusFilter, sortField, sortDirection]);

    // Resumen de métricas
    const summaryMetrics = useMemo(() => {
        const totalMontoFacturaUsd = round2(filteredInvoices.reduce((acc, inv) => acc + inv.montoFacturaUsd, 0));
        const totalAbonosUsd = round2(filteredInvoices.reduce((acc, inv) => acc + inv.abonosUsd, 0));
        const totalRestanteUsd = round2(filteredInvoices.reduce((acc, inv) => acc + inv.restanteUsd, 0));
        const totalVencidoUsd = round2(filteredInvoices.filter(inv => inv.estado === 'VENCIDA').reduce((acc, inv) => acc + inv.restanteUsd, 0));
        const totalPorVencerUsd = round2(filteredInvoices.filter(inv => inv.estado === 'POR_VENCER').reduce((acc, inv) => acc + inv.restanteUsd, 0));

        return {
            totalMontoFacturaUsd,
            totalAbonosUsd,
            totalRestanteUsd,
            totalVencidoUsd,
            totalPorVencerUsd,
            countTotal: filteredInvoices.length,
            countVencidas: filteredInvoices.filter(inv => inv.estado === 'VENCIDA').length,
            countPorVencer: filteredInvoices.filter(inv => inv.estado === 'POR_VENCER').length
        };
    }, [filteredInvoices]);

    const handleSort = (field) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    // Scroll horizontal superior sincronizado y vertical derecho para Parte B
    const topScrollRef = useRef(null);
    const tableScrollRef = useRef(null);
    const tableElRef = useRef(null);
    const [tableWidth, setTableWidth] = useState(1400);

    const isSyncingTop = useRef(false);
    const isSyncingTable = useRef(false);

    const handleTopScroll = () => {
        if (isSyncingTop.current) return;
        isSyncingTable.current = true;
        if (tableScrollRef.current && topScrollRef.current) {
            tableScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
        }
        setTimeout(() => { isSyncingTable.current = false; }, 30);
    };

    const handleTableScroll = () => {
        if (isSyncingTable.current) return;
        isSyncingTop.current = true;
        if (topScrollRef.current && tableScrollRef.current) {
            topScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
        }
        setTimeout(() => { isSyncingTop.current = false; }, 30);
    };

    useEffect(() => {
        const updateWidth = () => {
            if (tableElRef.current) {
                setTableWidth(Math.max(1400, tableElRef.current.scrollWidth));
            }
        };
        updateWidth();
        const timer = setTimeout(updateWidth, 120);
        window.addEventListener('resize', updateWidth);
        return () => {
            clearTimeout(timer);
            window.removeEventListener('resize', updateWidth);
        };
    }, [filteredInvoices, activeDocType]);

    // ========================================================================
    // Handlers de Parte A: Formulario "Para Registrar Cobros"
    // ========================================================================
    const handleSelectDocForCobro = (factNum) => {
        setCobroDocKey(factNum);
        const doc = docsForActiveType.find(d => String(d.factNum) === String(factNum));
        if (doc) {
            const rate = Number(cobroTasa) > 0 ? Number(cobroTasa) : tasaBcv;
            const rest = round2(doc.restanteUsd);
            setCobroMontoUsd(String(rest.toFixed(2)));
            setCobroMontoBs(String(round2(rest * rate).toFixed(2)));
        }
    };

    const handleTasaChange = (val) => {
        setCobroTasa(val);
        const rate = Number(val);
        const usd = Number(cobroMontoUsd);
        if (rate > 0 && !isNaN(usd) && cobroMontoUsd !== '') {
            setCobroMontoBs(String(round2(usd * rate).toFixed(2)));
        }
    };

    const handleMontoUsdChange = (val) => {
        setCobroMontoUsd(val);
        const usd = Number(val);
        const rate = Number(cobroTasa);
        if (!isNaN(usd) && val !== '' && rate > 0) {
            setCobroMontoBs(String(round2(usd * rate).toFixed(2)));
        } else if (val === '') {
            setCobroMontoBs('');
        }
    };

    const handleMontoBsChange = (val) => {
        setCobroMontoBs(val);
        const bs = Number(val);
        const rate = Number(cobroTasa);
        if (!isNaN(bs) && val !== '' && rate > 0) {
            setCobroMontoUsd(String(round2(bs / rate).toFixed(2)));
        } else if (val === '') {
            setCobroMontoUsd('');
        }
    };

    const handleSubmitCobro = async (e) => {
        e.preventDefault();
        setCobroFeedback(null);

        if (!selectedCobroDoc) {
            const msg = 'Seleccione un documento válido para registrar el cobro.';
            setCobroFeedback({ type: 'error', message: msg });
            notify.warning(msg);
            return;
        }

        const tasaNum = Number(cobroTasa);
        if (!tasaNum || isNaN(tasaNum) || tasaNum <= 0) {
            const msg = 'Ingrese una Tasa válida (mayor a 0) para el cálculo multimoneda.';
            setCobroFeedback({ type: 'error', message: msg });
            notify.warning(msg);
            return;
        }

        if (!cobroFecha) {
            const msg = 'La Fecha del cobro es obligatoria.';
            setCobroFeedback({ type: 'error', message: msg });
            notify.warning(msg);
            return;
        }

        const cuentaObj = catalogCuentas.find(c => c.key === cobroCuentaKey);
        if (!cuentaObj) {
            const msg = 'Seleccione una cuenta de Caja o Banco válida.';
            setCobroFeedback({ type: 'error', message: msg });
            notify.warning(msg);
            return;
        }

        const abonoUsd = round2(Number(cobroMontoUsd));
        if (!abonoUsd || isNaN(abonoUsd) || abonoUsd <= 0) {
            const msg = 'Ingrese un monto de cobro válido mayor a $0.00.';
            setCobroFeedback({ type: 'error', message: msg });
            notify.warning(msg);
            return;
        }

        if (abonoUsd > round2(selectedCobroDoc.restanteUsd + 0.01)) {
            const msg = `El monto a cobrar ($${abonoUsd.toFixed(2)}) no puede superar el Restante del documento ($${selectedCobroDoc.restanteUsd.toFixed(2)}).`;
            setCobroFeedback({ type: 'error', message: msg });
            notify.warning(msg);
            return;
        }

        const effectiveAbonoUsd = Math.min(abonoUsd, selectedCobroDoc.restanteUsd);
        const effectiveAbonoBs = round2(effectiveAbonoUsd * tasaNum);
        const nuevoAbonosUsd = round2(selectedCobroDoc.abonosUsd + effectiveAbonoUsd);
        const nuevoRestanteUsd = round2(Math.max(0, selectedCobroDoc.montoFacturaUsd - nuevoAbonosUsd));

        setIsSavingCobro(true);
        try {
            const factKey = String(selectedCobroDoc.factNum);
            const cobroRecord = {
                cobroNum: `COB-${Date.now().toString().slice(-6)}`,
                factNum: factKey,
                tipoDoc: selectedCobroDoc.tipoDoc,
                fecha: cobroFecha,
                tasa: tasaNum,
                montoUsd: effectiveAbonoUsd,
                montoBs: effectiveAbonoBs,
                cuentaKey: cuentaObj.key,
                cuentaId: cuentaObj.id,
                cuentaNombre: cuentaObj.nombre,
                accountType: cuentaObj.accountType,
                moneda: cuentaObj.moneda,
                referencia: cobroReferencia.trim()
            };

            const updatedInvoicePayload = {
                ...selectedCobroDoc,
                factNum: factKey,
                tipoDoc: selectedCobroDoc.tipoDoc,
                fechaEmision: selectedCobroDoc.fechaEmisionIso,
                fechaVencimiento: selectedCobroDoc.fechaVencimientoIso,
                clienteId: selectedCobroDoc.clienteId,
                clienteNombre: selectedCobroDoc.cliente,
                clienteRif: selectedCobroDoc.rif,
                vendedorId: selectedCobroDoc.vendedorId,
                vendedorNombre: selectedCobroDoc.vendedorNombre,
                diasCredito: selectedCobroDoc.diasCredito,
                diasVencidoCustom: selectedCobroDoc.diasVencidoCustom,
                totBrutoUsd: selectedCobroDoc.subtotalUsd,
                ivaUsd: selectedCobroDoc.tipoDoc === 'NOTA_ENTREGA' ? 0 : selectedCobroDoc.ivaUsd,
                totNetoUsd: selectedCobroDoc.montoFacturaUsd,
                abonosUsd: nuevoAbonosUsd,
                saldoUsd: nuevoRestanteUsd,
                tasa: tasaNum,
                historialCobros: [cobroRecord, ...(selectedCobroDoc.historialCobros || [])]
            };

            const savedAtIso = new Date().toISOString();
            const overridePayload = {
                ...updatedInvoicePayload,
                fechaSincronizacion: savedAtIso,
                updated_at: savedAtIso,
                _localSavedAt: savedAtIso
            };

            // 1. Actualizar inmediatamente la vista local (si queda en PAGADA, desaparecerá al instante del listview activo)
            if (nuevoRestanteUsd > 0.01) {
                setRecentlyPaidKeys(prev => {
                    const next = new Set(prev);
                    next.add(factKey);
                    return next;
                });
            }
            setLocalDocOverrides(prev => ({
                ...prev,
                [factKey]: overridePayload
            }));

            // 2. Persistir en App / Supabase / Cajas y Bancos
            if (onRegisterCollection) {
                await onRegisterCollection({
                    factNum: factKey,
                    tipoDoc: selectedCobroDoc.tipoDoc,
                    clienteId: selectedCobroDoc.clienteId,
                    clienteNombre: selectedCobroDoc.cliente,
                    vendedorId: selectedCobroDoc.vendedorId,
                    fecha: cobroFecha,
                    tasa: tasaNum,
                    montoUsd: effectiveAbonoUsd,
                    montoBs: effectiveAbonoBs,
                    moneda: cuentaObj.moneda,
                    accountType: cuentaObj.accountType,
                    accountId: cuentaObj.id,
                    cuentaDestino: cuentaObj.nombre,
                    formaPago: cuentaObj.accountType === 'CAJA' ? 'EFECTIVO' : 'TRANSFERENCIA',
                    referencia: cobroReferencia.trim(),
                    observaciones: `Cobro ${selectedCobroDoc.tipoDoc === 'NOTA_ENTREGA' ? 'Nota de Entrega' : 'Factura Fiscal'} #${factKey} @ Tasa ${tasaNum}`,
                    updatedInvoice: updatedInvoicePayload
                });
            }

            const successMsg = nuevoRestanteUsd <= 0.01
                ? `Cobro total registrado en #${factKey} (${formatUsd(effectiveAbonoUsd)}). Estatus PAGADA — movido a Solventes.`
                : `Cobro registrado en #${factKey}: Abono ${formatUsd(effectiveAbonoUsd)} (${formatBs(effectiveAbonoBs)}) → Nuevo Total Abonos: ${formatUsd(nuevoAbonosUsd)} | Restante: ${formatUsd(nuevoRestanteUsd)}`;
            setCobroFeedback({
                type: 'success',
                message: successMsg
            });
            notify.success(successMsg);

            setCobroReferencia('');
            if (nuevoRestanteUsd > 0.01) {
                setCobroMontoUsd(String(nuevoRestanteUsd.toFixed(2)));
                setCobroMontoBs(String(round2(nuevoRestanteUsd * tasaNum).toFixed(2)));
            } else {
                setCobroDocKey('');
                setCobroMontoUsd('');
                setCobroMontoBs('');
            }
        } catch (err) {
            console.error('Error registrando cobro CxC:', err);
            const errMsg = 'Ocurrió un error al registrar el cobro en el servidor.';
            setCobroFeedback({ type: 'error', message: errMsg });
            notify.error(errMsg);
        } finally {
            setIsSavingCobro(false);
        }
    };

    // ========================================================================
    // Handlers de Creación / Edición de Documentos
    // ========================================================================
    const handleOpenNewDocModal = () => {
        const isNE = activeDocType === 'NOTA_ENTREGA';
        const randomDigits = Math.floor(1000 + Math.random() * 9000);
        const suggestedNum = isNE ? `NE-${randomDigits}` : `${randomDigits}`;
        const todayIso = getTodayIso();
        const vencDate = new Date();
        vencDate.setDate(vencDate.getDate() + 15);
        const vencIso = toIsoDateInput(vencDate);

        setIsCreatingDoc(true);
        setEditingDoc({
            originalFactNum: null,
            tipoDoc: activeDocType,
            vendedorId: 'VV',
            vendedorNombre: sellerCatalog.get('VV') || 'VICTOR VARGAS',
            factNum: suggestedNum,
            rif: '',
            cliente: '',
            clienteId: '',
            fechaEmisionIso: todayIso,
            fechaVencimientoIso: vencIso,
            diasCredito: 15,
            diasVencidos: 0,
            subtotalUsd: 100,
            aplicaIva: !isNE,
            ivaUsd: isNE ? 0 : 16,
            montoFacturaUsd: isNE ? 100 : 116,
            abonosUsd: 0,
            restanteUsd: isNE ? 100 : 116,
            tasa: Number(cobroTasa) > 0 ? Number(cobroTasa) : tasaBcv,
            observaciones: ''
        });
    };

    const handleOpenEditDocModal = (inv) => {
        const isNE = inv.tipoDoc === 'NOTA_ENTREGA';
        setIsCreatingDoc(false);
        setEditingDoc({
            originalFactNum: inv.factNum,
            id: inv.id,
            tipoDoc: inv.tipoDoc,
            vendedorId: inv.vendedorId || 'OF',
            vendedorNombre: inv.vendedorNombre || sellerCatalog.get(inv.vendedorId) || '',
            factNum: inv.factNum,
            rif: inv.rif || '',
            cliente: inv.cliente || '',
            clienteId: inv.clienteId || '',
            fechaEmisionIso: inv.fechaEmisionIso || getTodayIso(),
            fechaVencimientoIso: inv.fechaVencimientoIso || getTodayIso(),
            diasCredito: Number(inv.diasCredito || 0),
            diasVencidos: Number(inv.diasVencidos || 0),
            subtotalUsd: round2(inv.subtotalUsd),
            aplicaIva: !isNE && inv.ivaUsd > 0,
            ivaUsd: isNE ? 0 : round2(inv.ivaUsd),
            montoFacturaUsd: round2(inv.montoFacturaUsd),
            abonosUsd: round2(inv.abonosUsd),
            restanteUsd: round2(inv.restanteUsd),
            tasa: Number(inv.tasa || tasaBcv),
            observaciones: inv.observaciones || '',
            historialCobros: inv.historialCobros || []
        });
    };

    const handleEditFieldChange = (field, value) => {
        setEditingDoc(prev => {
            if (!prev) return prev;
            const next = { ...prev, [field]: value };

            if (field === 'tipoDoc') {
                if (value === 'NOTA_ENTREGA') {
                    next.aplicaIva = false;
                    next.ivaUsd = 0;
                    next.montoFacturaUsd = round2(Number(next.subtotalUsd || 0));
                } else {
                    next.aplicaIva = true;
                    next.ivaUsd = round2(Number(next.subtotalUsd || 0) * 0.16);
                    next.montoFacturaUsd = round2(Number(next.subtotalUsd || 0) + next.ivaUsd);
                }
            }

            if (field === 'vendedorId') {
                const code = String(value || '').toUpperCase().trim();
                next.vendedorId = code;
                if (sellerCatalog.has(code)) {
                    next.vendedorNombre = sellerCatalog.get(code);
                }
            }

            if (field === 'fechaEmisionIso' || field === 'diasCredito') {
                const emisionDate = parseDateSafe(next.fechaEmisionIso);
                const dc = Math.max(0, Number(next.diasCredito || 0));
                const venc = new Date(emisionDate);
                venc.setDate(venc.getDate() + dc);
                next.fechaVencimientoIso = toIsoDateInput(venc);

                const today = new Date();
                today.setHours(0, 0, 0, 0);
                venc.setHours(0, 0, 0, 0);
                const diffVenc = Math.floor((today.getTime() - venc.getTime()) / (1000 * 60 * 60 * 24));
                next.diasVencidos = Math.max(0, diffVenc);
            }

            if (field === 'fechaVencimientoIso') {
                const emisionDate = parseDateSafe(next.fechaEmisionIso);
                const vencDate = parseDateSafe(next.fechaVencimientoIso);
                const diffCredit = Math.round((vencDate.getTime() - emisionDate.getTime()) / (1000 * 60 * 60 * 24));
                next.diasCredito = Math.max(0, diffCredit);

                const today = new Date();
                today.setHours(0, 0, 0, 0);
                vencDate.setHours(0, 0, 0, 0);
                const diffVenc = Math.floor((today.getTime() - vencDate.getTime()) / (1000 * 60 * 60 * 24));
                next.diasVencidos = Math.max(0, diffVenc);
            }

            if (field === 'subtotalUsd' || field === 'aplicaIva') {
                const sub = Math.max(0, Number(next.subtotalUsd || 0));
                if (next.tipoDoc === 'NOTA_ENTREGA') {
                    next.aplicaIva = false;
                    next.ivaUsd = 0;
                    next.montoFacturaUsd = round2(sub);
                } else {
                    const iva = next.aplicaIva ? round2(sub * 0.16) : 0;
                    next.ivaUsd = iva;
                    next.montoFacturaUsd = round2(sub + iva);
                }
            }

            if (field === 'montoFacturaUsd') {
                const total = Math.max(0, Number(value || 0));
                if (next.tipoDoc === 'NOTA_ENTREGA' || !next.aplicaIva) {
                    next.ivaUsd = 0;
                    next.subtotalUsd = round2(total);
                } else {
                    const base = round2(total / 1.16);
                    next.subtotalUsd = base;
                    next.ivaUsd = round2(total - base);
                }
            }

            const montoTotal = Math.max(0, Number(next.montoFacturaUsd || 0));
            const abonos = Math.max(0, Number(next.abonosUsd || 0));
            next.restanteUsd = round2(Math.max(0, montoTotal - abonos));

            return next;
        });
    };

    const handleSaveEditedDoc = async (e) => {
        e.preventDefault();
        if (!editingDoc) return;

        const factKey = String(editingDoc.factNum || '').trim();
        if (!factKey) {
            notify.warning('El número de documento (Factura o Nota de Entrega) es obligatorio.');
            return;
        }
        if (!String(editingDoc.cliente || '').trim()) {
            notify.warning('El Nombre del Cliente es obligatorio.');
            return;
        }

        const isNotaEntrega = editingDoc.tipoDoc === 'NOTA_ENTREGA';
        const montoFacturaUsd = round2(Number(editingDoc.montoFacturaUsd || 0));
        const subtotalUsd = isNotaEntrega ? montoFacturaUsd : round2(Number(editingDoc.subtotalUsd || montoFacturaUsd));
        const ivaUsd = isNotaEntrega ? 0 : round2(Number(editingDoc.ivaUsd || 0));
        const abonosUsd = round2(Math.min(montoFacturaUsd, Math.max(0, Number(editingDoc.abonosUsd || 0))));
        const restanteUsd = round2(Math.max(0, montoFacturaUsd - abonosUsd));

        const payload = {
            id: editingDoc.id || `INV-${factKey}`,
            factNum: factKey,
            originalFactNum: editingDoc.originalFactNum || factKey,
            tipoDoc: editingDoc.tipoDoc,
            vendedorId: String(editingDoc.vendedorId || 'OF').trim().toUpperCase(),
            vendedorNombre: String(editingDoc.vendedorNombre || '').trim(),
            clienteId: editingDoc.clienteId || `CLI-${factKey}`,
            clienteNombre: String(editingDoc.cliente || '').trim(),
            clienteRif: String(editingDoc.rif || 'J-00000000-0').trim().toUpperCase(),
            fechaEmision: editingDoc.fechaEmisionIso,
            fechaVencimiento: editingDoc.fechaVencimientoIso,
            diasCredito: Number(editingDoc.diasCredito || 0),
            diasVencidoCustom: Number(editingDoc.diasVencidos || 0),
            totBrutoUsd: subtotalUsd,
            ivaUsd,
            totNetoUsd: montoFacturaUsd,
            abonosUsd,
            saldoUsd: restanteUsd,
            tasa: Number(editingDoc.tasa || tasaBcv),
            observaciones: editingDoc.observaciones || '',
            historialCobros: editingDoc.historialCobros || [],
            _customCreated: true
        };

        const savedAtIso = new Date().toISOString();
        const overridePayload = {
            ...payload,
            fechaSincronizacion: savedAtIso,
            updated_at: savedAtIso,
            _localSavedAt: savedAtIso
        };

        setIsSavingDoc(true);
        try {
            setLocalDocOverrides(prev => {
                const next = { ...prev };
                if (editingDoc.originalFactNum && editingDoc.originalFactNum !== factKey) {
                    next[editingDoc.originalFactNum] = { _deleted: true };
                }
                next[factKey] = overridePayload;
                return next;
            });

            setRecentlyPaidKeys(prev => {
                const next = new Set(prev);
                if (restanteUsd <= 0.01) {
                    next.delete(factKey);
                } else {
                    next.add(factKey);
                }
                return next;
            });

            if (onSaveDocument) {
                await onSaveDocument(payload);
            }

            if (editingDoc.tipoDoc !== activeDocType) {
                setActiveDocType(editingDoc.tipoDoc);
            }
            if (restanteUsd <= 0.01) {
                if (cobroDocKey === factKey) {
                    setCobroDocKey('');
                    setCobroMontoUsd('');
                    setCobroMontoBs('');
                }
                notify.success(`Documento #${factKey} marcado como PAGADA y movido a Solventes.`);
            } else {
                notify.success(`Documento #${factKey} guardado exitosamente.`);
            }
            setEditingDoc(null);
        } catch (err) {
            console.error('Error guardando documento CxC:', err);
            notify.error('No se pudo guardar el documento: ' + (err.message || 'Error del servidor'));
        } finally {
            setIsSavingDoc(false);
        }
    };

    const handleDeleteDocumentRow = async (inv) => {
        const docLabel = inv.tipoDoc === 'NOTA_ENTREGA' ? 'Nota de Entrega' : 'Factura Fiscal';
        if (!window.confirm(`¿Eliminar ${docLabel} #${inv.factura} de ${inv.cliente} por ${formatUsd(inv.restanteUsd)}? Esta acción no se puede deshacer.`)) {
            return;
        }
        const rawNum = String(inv.factNum || inv.factura || inv.numeroDoc || '').trim();
        const rawId = String(inv.id || '').trim();
        const keysToDelete = getScopedCxcDeleteKeys(inv);

        setDeletingKey(rawId || rawNum);
        try {
            // 1. Marcar como eliminado en overrides de la sesión
            setLocalDocOverrides(prev => {
                const next = { ...prev };
                keysToDelete.forEach(k => {
                    next[k] = { _deleted: true };
                });
                return next;
            });

            // 2. Persistir inmediatamente en localStorage sin colisionar entre Factura y Nota de Entrega
            try {
                if (typeof localStorage !== 'undefined') {
                    const delList = sanitizeCxcDeletedDocsStorage();
                    keysToDelete.forEach(k => {
                        if (!delList.includes(k)) delList.push(k);
                    });
                    localStorage.setItem(CXC_DELETED_DOCS_KEY, JSON.stringify(delList));

                    const rawCustom = localStorage.getItem('signum_cxc_custom_docs_v1');
                    if (rawCustom) {
                        const customMap = JSON.parse(rawCustom);
                        if (customMap && typeof customMap === 'object') {
                            keysToDelete.forEach(k => delete customMap[k]);
                            localStorage.setItem('signum_cxc_custom_docs_v1', JSON.stringify(customMap));
                        }
                    }
                }
            } catch (_) {}

            // 3. Si estaba seleccionado en Parte A para registrar cobro, deseleccionar
            if (cobroDocKey && keysToDelete.includes(cobroDocKey)) {
                setCobroDocKey('');
            }

            // 4. Ejecutar borrado en Supabase central y emitir broadcast multi-dispositivo en tiempo real
            if (onDeleteSale) {
                await onDeleteSale(inv);
            }
            notify.success(`${docLabel} #${inv.factura} eliminada de Cuentas por Cobrar.`);
        } catch (err) {
            console.error('Error al eliminar documento:', err);
            notify.error('Error al eliminar: ' + (err.message || 'Error desconocido'));
        } finally {
            setDeletingKey(null);
        }
    };

    const handleExportCSV = () => {
        const docLabel = activeDocType === 'NOTA_ENTREGA' ? 'Nota de Entrega' : 'Factura';
        const headers = [
            'Vendedor',
            docLabel,
            'RIF',
            'Nombre Cliente',
            'Fecha Emision',
            'Fecha Venc.',
            'Dias de Vencido',
            'Dias de Credito',
            'Monto Factura (USD)',
            'Abonos (USD)',
            'Restante (USD)'
        ];

        const rows = filteredInvoices.map(inv => [
            `"${inv.vendedorDisplay}"`,
            `"${inv.factura}"`,
            `"${inv.rif}"`,
            `"${inv.cliente}"`,
            formatDateShort(inv.fechaEmision),
            formatDateShort(inv.fechaVencimiento),
            inv.diasVencidos,
            inv.diasCredito,
            inv.montoFacturaUsd.toFixed(2),
            inv.abonosUsd.toFixed(2),
            inv.restanteUsd.toFixed(2)
        ]);

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `Reporte_CxC_${activeDocType}_${getTodayIso()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (isOpen === false) return null;

    const isNotaEntregaTab = activeDocType === 'NOTA_ENTREGA';

    // CONTENEDOR PRINCIPAL CON EL ESTILO OFICIAL DE SIGNUM MOTORVEN
    const cardContent = (
        <section 
            className="accounts-receivable-view card printable-document"
            style={{
                width: '100%',
                minWidth: 0,
                position: 'relative',
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-main, #0f172a)',
                padding: 0,
                overflow: 'visible',
                borderRadius: '16px',
                border: '1px solid var(--border-glass)',
                boxShadow: 'var(--shadow-card, none)'
            }}
        >
            {/* ============================================================
                ENCABEZADO CORPORATIVO GRUPO MOTORVEN
            ============================================================ */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1.25rem 1.75rem',
                borderBottom: '1px solid var(--border-glass)',
                background: 'var(--bg-card-header)',
                flexWrap: 'wrap',
                gap: '1rem'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    <div style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '12px',
                        background: isNotaEntregaTab
                            ? 'linear-gradient(135deg, rgba(217, 119, 6, 0.22), rgba(245, 158, 11, 0.12))'
                            : 'linear-gradient(135deg, rgba(0, 43, 122, 0.35), rgba(0, 242, 254, 0.18))',
                        border: isNotaEntregaTab
                            ? '1px solid rgba(217, 119, 6, 0.35)'
                            : '1px solid rgba(0, 242, 254, 0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: isNotaEntregaTab ? '#f59e0b' : 'var(--brand-blue, #38bdf8)'
                    }}>
                        {isNotaEntregaTab ? <FileText size={24} /> : <Receipt size={24} />}
                    </div>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                            <h2 style={{
                                margin: 0,
                                fontSize: '1.25rem',
                                fontWeight: 800,
                                color: 'var(--text-heading, #ffffff)',
                                letterSpacing: '-0.01em',
                                fontFamily: 'var(--font-heading, "Orbitron", sans-serif)'
                            }}>
                                Cuentas por Cobrar (CxC) & Registro de Cobros
                            </h2>
                            <span style={{
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                padding: '0.2rem 0.65rem',
                                borderRadius: '20px',
                                background: isNotaEntregaTab ? 'rgba(217, 119, 6, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                                color: isNotaEntregaTab ? '#fbbf24' : '#34d399',
                                border: isNotaEntregaTab ? '1px solid rgba(217, 119, 6, 0.3)' : '1px solid rgba(16, 185, 129, 0.3)',
                                letterSpacing: '0.04em'
                            }}>
                                {isNotaEntregaTab ? 'Notas de Entrega (Sin IVA / 0%)' : 'Facturas Fiscales (SENIAT / IVA)'}
                            </span>
                        </div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            Gestión Integral de Cartera • Tasa Oficial BCV: <strong style={{ color: '#10b981', fontFamily: 'var(--font-code)' }}>{formatBs(tasaBcv)}</strong>
                            {isNotaEntregaTab && (
                                <span style={{ marginLeft: '0.5rem', color: '#fbbf24' }}>
                                    • En Notas de Entrega no se aplica IVA ni ningún otro impuesto.
                                </span>
                            )}
                        </span>
                    </div>
                </div>

                {/* SELECTOR ENTRE FACTURAS FISCALES Y NOTAS DE ENTREGA + BOTONES DE ACCIÓN */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                    {/* Selector tipo pastilla (Pill) */}
                    <div style={{
                        display: 'inline-flex',
                        background: 'var(--bg-pill, rgba(255, 255, 255, 0.06))',
                        padding: '4px',
                        borderRadius: '12px',
                        border: '1px solid var(--border-glass)',
                        gap: '4px'
                    }}>
                        <button
                            type="button"
                            onClick={() => setActiveDocType('FACTURA')}
                            style={{
                                padding: '0.5rem 1rem',
                                borderRadius: '9px',
                                fontSize: '0.82rem',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                border: 'none',
                                background: activeDocType === 'FACTURA'
                                    ? 'linear-gradient(135deg, var(--motorven-navy, #002b7a) 0%, #0284c7 100%)'
                                    : 'transparent',
                                color: activeDocType === 'FACTURA' ? '#ffffff' : 'var(--text-muted)',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                boxShadow: activeDocType === 'FACTURA' ? '0 3px 12px rgba(0, 43, 122, 0.45)' : 'none'
                            }}
                        >
                            <Receipt size={15} />
                            <span>Facturas Fiscales</span>
                            <span style={{
                                padding: '1px 7px',
                                borderRadius: '10px',
                                fontSize: '0.72rem',
                                background: activeDocType === 'FACTURA' ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.08)',
                                color: activeDocType === 'FACTURA' ? '#ffffff' : 'var(--text-muted)'
                            }}>
                                {docTypeCounts.facturas}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveDocType('NOTA_ENTREGA')}
                            style={{
                                padding: '0.5rem 1rem',
                                borderRadius: '9px',
                                fontSize: '0.82rem',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                border: 'none',
                                background: activeDocType === 'NOTA_ENTREGA'
                                    ? 'linear-gradient(135deg, #d97706 0%, #b45309 100%)'
                                    : 'transparent',
                                color: activeDocType === 'NOTA_ENTREGA' ? '#ffffff' : 'var(--text-muted)',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                boxShadow: activeDocType === 'NOTA_ENTREGA' ? '0 3px 12px rgba(217, 119, 6, 0.45)' : 'none'
                            }}
                        >
                            <FileText size={15} />
                            <span>Notas de Entrega (Sin IVA)</span>
                            <span style={{
                                padding: '1px 7px',
                                borderRadius: '10px',
                                fontSize: '0.72rem',
                                background: activeDocType === 'NOTA_ENTREGA' ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.08)',
                                color: activeDocType === 'NOTA_ENTREGA' ? '#ffffff' : 'var(--text-muted)'
                            }}>
                                {docTypeCounts.notasEntrega}
                            </span>
                        </button>
                    </div>

                    {/* Botón Nuevo Documento */}
                    <button
                        type="button"
                        onClick={handleOpenNewDocModal}
                        className="btn btn-primary"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.45rem',
                            padding: '0.55rem 0.95rem',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            background: isNotaEntregaTab
                                ? 'linear-gradient(135deg, #d97706 0%, #b45309 100%)'
                                : undefined
                        }}
                    >
                        <Plus size={16} />
                        <span>{isNotaEntregaTab ? '+ Nueva Nota de Entrega' : '+ Nueva Factura Fiscal'}</span>
                    </button>

                    {/* Botón WhatsApp Intelligence si existe */}
                    {onOpenCollectionIntelligence && (
                        <button
                            type="button"
                            onClick={onOpenCollectionIntelligence}
                            className="btn btn-secondary"
                            style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.55rem 0.95rem', fontSize: '0.82rem' }}
                            title="Centro Inteligente de Cobranzas WhatsApp"
                        >
                            <MessageSquare size={16} color="#10b981" />
                            <span className="hide-on-mobile">Inteligencia WhatsApp</span>
                        </button>
                    )}

                    {/* Exportar PDF */}
                    <button
                        type="button"
                        onClick={() => generateAccountsReceivablePDF(filteredInvoices, summaryMetrics, config, activeDocType)}
                        className="btn btn-print-report"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.55rem 0.95rem', fontSize: '0.82rem' }}
                        title="Exportar Reporte Oficial PDF"
                    >
                        <Printer size={16} color="#ffffff" />
                        <span>Imprimir PDF</span>
                    </button>

                    {/* Exportar Excel / CSV */}
                    <button
                        type="button"
                        onClick={handleExportCSV}
                        className="btn btn-secondary"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.55rem 0.95rem', fontSize: '0.82rem' }}
                        title="Exportar datos a Excel / CSV"
                    >
                        <FileSpreadsheet size={16} color="#10b981" />
                        <span>Excel / CSV</span>
                    </button>

                    {/* Abrir Página en Blanco Externa (Tabla CxC Profit) */}
                    <button
                        type="button"
                        onClick={() => window.open(`?view=profit-cxc&docType=${activeDocType}`, '_blank', 'noopener,noreferrer')}
                        className="btn btn-secondary"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.45rem',
                            padding: '0.55rem 1rem',
                            fontSize: '0.82rem',
                            fontWeight: 700,
                            background: 'linear-gradient(135deg, rgba(2, 132, 199, 0.22), rgba(0, 43, 122, 0.38))',
                            border: '1px solid rgba(56, 189, 248, 0.45)',
                            color: '#ffffff',
                            boxShadow: '0 2px 10px rgba(2, 132, 199, 0.25)'
                        }}
                        title="Abrir Tabla de Cuentas por Cobrar de Profit en una página en blanco independiente para leer, editar, guardar e imprimir"
                    >
                        <Database size={15} color="#38bdf8" />
                        <span>Tabla CxC Profit</span>
                        <ExternalLink size={14} color="#38bdf8" />
                    </button>

                    {onClose && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="btn btn-secondary"
                            style={{ padding: '0.55rem', border: '1px solid var(--border-glass)' }}
                            title="Cerrar"
                        >
                            <X size={18} />
                        </button>
                    )}
                </div>
            </div>

            {/* ============================================================
                RESUMEN DE KPIS CORPORATIVOS (TARJETAS MOTORVEN)
            ============================================================ */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: '1rem',
                padding: '1.25rem 1.75rem',
                background: 'var(--bg-surface)',
                borderBottom: '1px solid var(--border-glass)'
            }}>
                {/* KPI 1: Total Facturado / Emitido */}
                <div style={{
                    background: 'var(--bg-card-glass)',
                    padding: '1rem',
                    borderRadius: '12px',
                    border: '1px solid var(--border-glass)',
                    borderLeft: '4px solid var(--brand-blue, #0284c7)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                            {isNotaEntregaTab ? 'Monto Total Notas' : 'Monto Total Facturas'}
                        </span>
                        <DollarSign size={16} style={{ color: 'var(--brand-blue, #0284c7)' }} />
                    </div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-code)' }}>
                        {formatUsd(summaryMetrics.totalMontoFacturaUsd)}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem', fontFamily: 'var(--font-code)' }}>
                        {formatBs(summaryMetrics.totalMontoFacturaUsd * tasaBcv)}
                    </div>
                </div>

                {/* KPI 2: Total Abonos Registrados */}
                <div style={{
                    background: 'var(--bg-card-glass)',
                    padding: '1rem',
                    borderRadius: '12px',
                    border: '1px solid var(--border-glass)',
                    borderLeft: '4px solid #10b981'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                            Total Abonos Cobrados
                        </span>
                        <CheckCircle size={16} style={{ color: '#10b981' }} />
                    </div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#10b981', fontFamily: 'var(--font-code)' }}>
                        {formatUsd(summaryMetrics.totalAbonosUsd)}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem', fontFamily: 'var(--font-code)' }}>
                        {formatBs(summaryMetrics.totalAbonosUsd * tasaBcv)}
                    </div>
                </div>

                {/* KPI 3: Total Restante por Cobrar */}
                <div style={{
                    background: 'var(--bg-card-glass)',
                    padding: '1rem',
                    borderRadius: '12px',
                    border: '1px solid var(--border-glass)',
                    borderLeft: '4px solid #ef4444'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                            Total Saldo Restante
                        </span>
                        <AlertTriangle size={16} style={{ color: '#ef4444' }} />
                    </div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#ef4444', fontFamily: 'var(--font-code)' }}>
                        {formatUsd(summaryMetrics.totalRestanteUsd)}
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem', fontFamily: 'var(--font-code)' }}>
                        {formatBs(summaryMetrics.totalRestanteUsd * tasaBcv)}
                    </div>
                </div>

                {/* KPI 4: Documentos Vencidos vs Vigentes */}
                <div style={{
                    background: 'var(--bg-card-glass)',
                    padding: '1rem',
                    borderRadius: '12px',
                    border: '1px solid var(--border-glass)',
                    borderLeft: '4px solid #8b5cf6'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                            Estado de Mora
                        </span>
                        <Clock size={16} style={{ color: '#8b5cf6' }} />
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        <span style={{ color: '#ef4444' }}>{summaryMetrics.countVencidas} Vencidas</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0 4px' }}>/</span>
                        <span style={{ color: '#10b981', fontSize: '1.05rem' }}>{summaryMetrics.countPorVencer} Al Día</span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        Total en cartera: {summaryMetrics.countTotal} documentos
                    </div>
                </div>
            </div>

            {/* ============================================================
                CUERPO PRINCIPAL (PARTE A + PARTE B)
            ============================================================ */}
            <div style={{ padding: '1.5rem 1.75rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                {/* ========================================================
                    PARTE A: FORMULARIO "PARA REGISTRAR COBROS"
                ======================================================== */}
                <div style={{
                    background: 'var(--bg-card-glass)',
                    border: isNotaEntregaTab ? '1px solid rgba(217, 119, 6, 0.35)' : '1px solid var(--border-glass)',
                    borderRadius: '14px',
                    padding: '1.35rem 1.6rem',
                    boxShadow: 'var(--shadow-card, 0 8px 24px rgba(0,0,0,0.3))'
                }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '0.75rem',
                        marginBottom: '1.25rem',
                        paddingBottom: '0.85rem',
                        borderBottom: '1px solid var(--border-glass)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <span style={{
                                padding: '0.25rem 0.75rem',
                                borderRadius: '8px',
                                fontSize: '0.74rem',
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                background: isNotaEntregaTab ? 'rgba(217, 119, 6, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                                color: isNotaEntregaTab ? '#fbbf24' : '#34d399',
                                border: isNotaEntregaTab ? '1px solid rgba(217, 119, 6, 0.4)' : '1px solid rgba(16, 185, 129, 0.4)'
                            }}>
                                Parte A
                            </span>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-heading)' }}>
                                Para Registrar Cobros ({isNotaEntregaTab ? 'Notas de Entrega — Sin Impuestos' : 'Facturas Fiscales'})
                            </h3>
                        </div>

                        {selectedCobroDoc && (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.85rem',
                                padding: '0.4rem 0.9rem',
                                borderRadius: '10px',
                                background: 'var(--bg-surface)',
                                border: '1px solid var(--border-glass)',
                                fontSize: '0.8rem',
                                flexWrap: 'wrap'
                            }}>
                                <span style={{ color: 'var(--text-muted)' }}>
                                    {isNotaEntregaTab ? 'Nota:' : 'Factura:'}{' '}
                                    <strong style={{ color: 'var(--brand-blue)', fontFamily: 'var(--font-code)' }}>#{selectedCobroDoc.factura}</strong>
                                </span>
                                <span style={{ color: 'var(--border-glass)' }}>|</span>
                                <span style={{ color: 'var(--text-muted)' }}>
                                    Total:{' '}
                                    <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-code)' }}>{formatUsd(selectedCobroDoc.montoFacturaUsd)}</strong>
                                </span>
                                <span style={{ color: 'var(--border-glass)' }}>|</span>
                                <span style={{ color: 'var(--text-muted)' }}>
                                    Abonos:{' '}
                                    <strong style={{ color: '#10b981', fontFamily: 'var(--font-code)' }}>{formatUsd(selectedCobroDoc.abonosUsd)}</strong>
                                </span>
                                <span style={{ color: 'var(--border-glass)' }}>|</span>
                                <span style={{ color: 'var(--text-muted)' }}>
                                    Restante:{' '}
                                    <strong style={{ color: '#ef4444', fontFamily: 'var(--font-code)' }}>{formatUsd(selectedCobroDoc.restanteUsd)}</strong>
                                </span>
                            </div>
                        )}
                    </div>

                    <form onSubmit={handleSubmitCobro} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'flex-end' }}>
                        {/* Selector de Documento Asociado con Buscador Integrado */}
                        <div style={{ minWidth: '220px', gridColumn: 'span 2' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem', flexWrap: 'wrap', gap: '4px' }}>
                                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                                    {isNotaEntregaTab ? 'Nota de Entrega Asociada *' : 'Factura Fiscal Asociada *'}
                                </label>
                                {cobroDocSearch.trim() && (
                                    <span style={{ fontSize: '0.72rem', color: 'var(--brand-blue, #0284c7)', fontFamily: 'var(--font-code)' }}>
                                        {searchedPayableDocs.length} de {payableDocsForActiveType.length} encontradas
                                    </span>
                                )}
                            </div>

                            {/* Buscador interactivo por Nro Factura/Nota, Cliente, Vendedor y RIF */}
                            <div style={{ position: 'relative', marginBottom: '6px' }}>
                                <input
                                    type="text"
                                    value={cobroDocSearch}
                                    onChange={(e) => setCobroDocSearch(e.target.value)}
                                    placeholder={`Buscar por N° ${isNotaEntregaTab ? 'nota' : 'factura'}, cliente, vendedor o RIF...`}
                                    className="input-modern"
                                    style={{
                                        width: '100%',
                                        padding: '0.45rem 1.8rem 0.45rem 2.1rem',
                                        fontSize: '0.8rem',
                                        borderRadius: '8px'
                                    }}
                                />
                                <Search size={14} style={{ position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                {cobroDocSearch && (
                                    <button
                                        type="button"
                                        onClick={() => setCobroDocSearch('')}
                                        style={{
                                            position: 'absolute',
                                            right: '8px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'transparent',
                                            border: 'none',
                                            color: 'var(--text-muted)',
                                            cursor: 'pointer',
                                            padding: 0
                                        }}
                                        title="Limpiar búsqueda"
                                    >
                                        <X size={14} />
                                    </button>
                                )}
                            </div>

                            <select
                                value={cobroDocKey}
                                onChange={(e) => handleSelectDocForCobro(e.target.value)}
                                required
                                className="select-modern"
                                style={{ width: '100%', padding: '0.65rem 0.85rem', fontSize: '0.85rem' }}
                            >
                                {searchedPayableDocs.length === 0 ? (
                                    <option value="">
                                        {payableDocsForActiveType.length === 0
                                            ? '— Sin documentos pendientes con saldo —'
                                            : `— Sin coincidencias para "${cobroDocSearch}" —`}
                                    </option>
                                ) : (
                                    searchedPayableDocs.map(doc => (
                                        <option key={doc.factNum} value={doc.factNum}>
                                            #{doc.factura} • {doc.cliente.slice(0, 22)} • RIF: {doc.rif} • Vend: {doc.vendedorId} • Restante: ${doc.restanteUsd.toFixed(2)}
                                        </option>
                                    ))
                                )}
                            </select>
                        </div>

                        {/* Campo 1 Requerido: TASA (Decimal, multimoneda) */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#10b981', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                                Tasa (Bs/USD) *
                            </label>
                            <input
                                type="number"
                                step="0.0001"
                                min="0.0001"
                                required
                                value={cobroTasa}
                                onChange={(e) => handleTasaChange(e.target.value)}
                                placeholder="Ej. 451.51"
                                className="input-modern"
                                style={{ width: '100%', padding: '0.65rem 0.85rem', fontSize: '0.85rem', fontWeight: 700, fontFamily: 'var(--font-code)', color: '#10b981' }}
                            />
                        </div>

                        {/* Campo 2 Requerido: FECHA (Date, default hoy) */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                                Fecha *
                            </label>
                            <input
                                type="date"
                                required
                                value={cobroFecha}
                                onChange={(e) => setCobroFecha(e.target.value)}
                                className="input-modern"
                                style={{ width: '100%', padding: '0.65rem 0.85rem', fontSize: '0.85rem', color: 'var(--text-primary)' }}
                            />
                        </div>

                        {/* Campo 3 Requerido: CAJA Y BANCOS (Select dropdown de cuentas disponibles) */}
                        <div style={{ minWidth: '220px', gridColumn: 'span 2' }}>
                            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--brand-blue)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                                Caja y Bancos (Catálogo de Cuentas) *
                            </label>
                            <select
                                required
                                value={cobroCuentaKey}
                                onChange={(e) => setCobroCuentaKey(e.target.value)}
                                className="select-modern"
                                style={{ width: '100%', padding: '0.65rem 0.85rem', fontSize: '0.85rem' }}
                            >
                                <optgroup label="Cajas Operativas (Efectivo / Custodia)">
                                    {catalogCuentas.filter(c => c.accountType === 'CAJA').map(c => (
                                        <option key={c.key} value={c.key}>{c.label}</option>
                                    ))}
                                </optgroup>
                                <optgroup label="Cuentas Bancarias (Nacionales / Transferencias)">
                                    {catalogCuentas.filter(c => c.accountType === 'BANCO').map(b => (
                                        <option key={b.key} value={b.key}>{b.label}</option>
                                    ))}
                                </optgroup>
                            </select>
                        </div>

                        {/* Monto Abono en USD */}
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                                    Monto Abono (USD) *
                                </label>
                                {selectedCobroDoc && selectedCobroDoc.restanteUsd > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => handleMontoUsdChange(String(selectedCobroDoc.restanteUsd.toFixed(2)))}
                                        style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                                        title="Cargar saldo total restante"
                                    >
                                        Restante ({formatUsd(selectedCobroDoc.restanteUsd)})
                                    </button>
                                )}
                            </div>
                            <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                required
                                value={cobroMontoUsd}
                                onChange={(e) => handleMontoUsdChange(e.target.value)}
                                placeholder="0.00"
                                className="input-modern"
                                style={{ width: '100%', padding: '0.65rem 0.85rem', fontSize: '0.85rem', fontWeight: 700, fontFamily: 'var(--font-code)', color: 'var(--text-primary)' }}
                            />
                        </div>

                        {/* Equivalente en Bolívares (Bs.) */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                                Equivalente en Bs.
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={cobroMontoBs}
                                onChange={(e) => handleMontoBsChange(e.target.value)}
                                placeholder="0.00"
                                className="input-modern"
                                style={{ width: '100%', padding: '0.65rem 0.85rem', fontSize: '0.85rem', fontFamily: 'var(--font-code)', color: 'var(--text-muted)' }}
                            />
                        </div>

                        {/* N° Referencia / Comprobante */}
                        <div style={{ gridColumn: 'span 2' }}>
                            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                                N° Referencia / Comprobante (Opcional)
                            </label>
                            <input
                                type="text"
                                value={cobroReferencia}
                                onChange={(e) => setCobroReferencia(e.target.value)}
                                placeholder="Ej. Ref. Transferencia / Pago Móvil / Recibo #1234"
                                className="input-modern"
                                style={{ width: '100%', padding: '0.65rem 0.85rem', fontSize: '0.85rem' }}
                            />
                        </div>

                        {/* Botón Guardar Cobro */}
                        <div>
                            <button
                                type="submit"
                                disabled={isSavingCobro || !selectedCobroDoc || selectedCobroDoc.restanteUsd <= 0}
                                className="btn btn-primary"
                                style={{
                                    width: '100%',
                                    padding: '0.68rem 1.1rem',
                                    fontSize: '0.85rem',
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    background: isNotaEntregaTab ? 'linear-gradient(135deg, #d97706 0%, #b45309 100%)' : undefined
                                }}
                            >
                                <Check size={16} />
                                <span>{isSavingCobro ? 'Registrando...' : 'Registrar Cobro'}</span>
                            </button>
                        </div>
                    </form>

                    {cobroFeedback && (
                        <div style={{
                            marginTop: '1rem',
                            padding: '0.75rem 1rem',
                            borderRadius: '10px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '0.75rem',
                            fontSize: '0.82rem',
                            background: cobroFeedback.type === 'success' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                            border: cobroFeedback.type === 'success' ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(239, 68, 68, 0.35)',
                            color: cobroFeedback.type === 'success' ? '#34d399' : '#f87171'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {cobroFeedback.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                                <span>{cobroFeedback.message}</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setCobroFeedback(null)}
                                style={{ background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer' }}
                            >
                                <X size={14} />
                            </button>
                        </div>
                    )}
                </div>

                {/* ========================================================
                    PARTE B: "REPORTE DOCUMENTOS CXC"
                ======================================================== */}
                <div style={{
                    background: 'var(--bg-card-glass)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: '14px',
                    padding: '1.35rem 1.6rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem'
                }}>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '0.75rem',
                        paddingBottom: '0.85rem',
                        borderBottom: '1px solid var(--border-glass)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <span style={{
                                padding: '0.25rem 0.75rem',
                                borderRadius: '8px',
                                fontSize: '0.74rem',
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                letterSpacing: '0.05em',
                                background: 'rgba(2, 132, 199, 0.2)',
                                color: 'var(--brand-blue)',
                                border: '1px solid rgba(2, 132, 199, 0.4)'
                            }}>
                                Parte B
                            </span>
                            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--text-heading)' }}>
                                Reporte Documentos CxC — {isNotaEntregaTab ? 'Notas de Entrega (Sin IVA)' : 'Facturas Fiscales'}
                            </h3>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                ({filteredInvoices.length} documentos listados)
                            </span>
                        </div>
                    </div>

                    {/* BARRA DE FILTROS Y BÚSQUEDA */}
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div className="search-wrapper" style={{ flex: '1 1 280px', position: 'relative' }}>
                            <Search size={16} className="search-icon" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="input-modern"
                                placeholder={`Buscar por cualquier palabra clave (vendedor, ${isNotaEntregaTab ? 'nota' : 'factura'}, RIF, cliente, fecha, monto)...`}
                                style={{ width: '100%', paddingLeft: '2.4rem', paddingRight: searchTerm ? '2.2rem' : '0.85rem', fontSize: '0.85rem' }}
                            />
                            {searchTerm && (
                                <button
                                    type="button"
                                    onClick={() => setSearchTerm('')}
                                    title="Limpiar búsqueda"
                                    style={{
                                        position: 'absolute',
                                        right: '0.6rem',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'rgba(255,255,255,0.08)',
                                        border: 'none',
                                        borderRadius: '50%',
                                        width: '20px',
                                        height: '20px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: 'var(--text-muted)',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                            {/* Selector de Orden por Fecha / Campo */}
                            <select
                                value={`${sortField}:${sortDirection}`}
                                onChange={(e) => {
                                    const [f, d] = String(e.target.value).split(':');
                                    if (f && d) {
                                        setSortField(f);
                                        setSortDirection(d);
                                    }
                                }}
                                className="select-modern"
                                style={{ padding: '0.55rem 0.85rem', fontSize: '0.82rem' }}
                                title="Ordenar documentos por fecha de mayor a menor o menor a mayor"
                            >
                                <option value="fechaEmision:desc">Fecha Emisión: Mayor a Menor (Más Recientes)</option>
                                <option value="fechaEmision:asc">Fecha Emisión: Menor a Mayor (Más Antiguas)</option>
                                <option value="fechaVencimiento:desc">Fecha Venc.: Mayor a Menor (Más Recientes)</option>
                                <option value="fechaVencimiento:asc">Fecha Venc.: Menor a Mayor (Más Antiguas)</option>
                                <option value="diasVencidos:desc">Días de Vencido: Mayor a Menor</option>
                                <option value="diasVencidos:asc">Días de Vencido: Menor a Mayor</option>
                                <option value="diasCredito:desc">Días de Crédito: Mayor a Menor</option>
                                <option value="diasCredito:asc">Días de Crédito: Menor a Mayor</option>
                                <option value="montoFacturaUsd:desc">Monto Factura: Mayor a Menor</option>
                                <option value="montoFacturaUsd:asc">Monto Factura: Menor a Mayor</option>
                                <option value="abonosUsd:desc">Abonos: Mayor a Menor</option>
                                <option value="abonosUsd:asc">Abonos: Menor a Mayor</option>
                                <option value="restanteUsd:desc">Saldo Restante: Mayor a Menor</option>
                                <option value="restanteUsd:asc">Saldo Restante: Menor a Mayor</option>
                                <option value="factura:desc">N° Documento: Mayor a Menor</option>
                                <option value="factura:asc">N° Documento: Menor a Mayor</option>
                                <option value="cliente:asc">Cliente: A → Z</option>
                                <option value="cliente:desc">Cliente: Z → A</option>
                                <option value="rif:asc">RIF: A → Z</option>
                                <option value="rif:desc">RIF: Z → A</option>
                                <option value="vendedorId:asc">Vendedor: A → Z</option>
                                <option value="vendedorId:desc">Vendedor: Z → A</option>
                            </select>

                            {/* Filtro Vendedor */}
                            <select
                                value={selectedSeller}
                                onChange={(e) => setSelectedSeller(e.target.value)}
                                className="select-modern"
                                style={{ padding: '0.55rem 0.85rem', fontSize: '0.82rem' }}
                            >
                                <option value="ALL">Todos los Vendedores</option>
                                {sellerFilterOptions.map(v => (
                                    <option key={v.id} value={v.id}>
                                        {v.id} — {v.name} ({v.count})
                                    </option>
                                ))}
                            </select>

                            {/* Selector Estado Pastilla */}
                            <div style={{
                                display: 'inline-flex',
                                background: 'var(--bg-pill, rgba(255, 255, 255, 0.06))',
                                padding: '3px',
                                borderRadius: '10px',
                                border: '1px solid var(--border-glass)',
                                gap: '3px'
                            }}>
                                <button
                                    type="button"
                                    onClick={() => setStatusFilter('ALL')}
                                    style={{
                                        padding: '0.35rem 0.75rem',
                                        borderRadius: '7px',
                                        fontSize: '0.76rem',
                                        fontWeight: 600,
                                        border: 'none',
                                        background: statusFilter === 'ALL' ? 'var(--bg-card-hover, rgba(255,255,255,0.15))' : 'transparent',
                                        color: statusFilter === 'ALL' ? '#ffffff' : 'var(--text-muted)',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px'
                                    }}
                                >
                                    <span>Todos</span>
                                    <span style={{ opacity: 0.8, fontSize: '0.7rem' }}>({statusButtonCounts.ALL})</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setStatusFilter('VENCIDA')}
                                    style={{
                                        padding: '0.35rem 0.75rem',
                                        borderRadius: '7px',
                                        fontSize: '0.76rem',
                                        fontWeight: 600,
                                        border: 'none',
                                        background: statusFilter === 'VENCIDA' ? 'rgba(239, 68, 68, 0.22)' : 'transparent',
                                        color: statusFilter === 'VENCIDA' ? '#ef4444' : 'var(--text-muted)',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px'
                                    }}
                                >
                                    <span>Vencidos</span>
                                    <span style={{ opacity: 0.85, fontSize: '0.7rem' }}>({statusButtonCounts.VENCIDA})</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setStatusFilter('POR_VENCER')}
                                    style={{
                                        padding: '0.35rem 0.75rem',
                                        borderRadius: '7px',
                                        fontSize: '0.76rem',
                                        fontWeight: 600,
                                        border: 'none',
                                        background: statusFilter === 'POR_VENCER' ? 'rgba(16, 185, 129, 0.22)' : 'transparent',
                                        color: statusFilter === 'POR_VENCER' ? '#10b981' : 'var(--text-muted)',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px'
                                    }}
                                >
                                    <span>Al Día</span>
                                    <span style={{ opacity: 0.85, fontSize: '0.7rem' }}>({statusButtonCounts.POR_VENCER})</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setStatusFilter('PAGADA')}
                                    style={{
                                        padding: '0.35rem 0.75rem',
                                        borderRadius: '7px',
                                        fontSize: '0.76rem',
                                        fontWeight: 600,
                                        border: 'none',
                                        background: statusFilter === 'PAGADA' ? 'rgba(2, 132, 199, 0.22)' : 'transparent',
                                        color: statusFilter === 'PAGADA' ? 'var(--brand-blue)' : 'var(--text-muted)',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px'
                                    }}
                                >
                                    <span>Solventes</span>
                                    <span style={{ opacity: 0.85, fontSize: '0.7rem' }}>({statusButtonCounts.PAGADA})</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Estilos dedicados para scroll superior y vertical derecho */}
                    <style>{`
                        .cxc-top-scrollbar::-webkit-scrollbar {
                            height: 8px;
                        }
                        .cxc-top-scrollbar::-webkit-scrollbar-track {
                            background: rgba(15, 23, 42, 0.6);
                            border-radius: 6px;
                        }
                        .cxc-top-scrollbar::-webkit-scrollbar-thumb {
                            background: var(--brand-blue, #0284c7);
                            border-radius: 6px;
                        }
                        .cxc-top-scrollbar::-webkit-scrollbar-thumb:hover {
                            background: #38bdf8;
                        }
                        .hide-bottom-scrollbar::-webkit-scrollbar:horizontal {
                            display: none !important;
                            height: 0 !important;
                        }
                        .cxc-table-scroll-container::-webkit-scrollbar:vertical {
                            width: 8px;
                        }
                        .cxc-table-scroll-container::-webkit-scrollbar-track {
                            background: rgba(15, 23, 42, 0.6);
                            border-radius: 6px;
                        }
                        .cxc-table-scroll-container::-webkit-scrollbar-thumb {
                            background: var(--brand-blue, #0284c7);
                            border-radius: 6px;
                        }
                        .cxc-table-scroll-container::-webkit-scrollbar-thumb:hover {
                            background: #38bdf8;
                        }
                        .cxc-report-table {
                            border-collapse: separate;
                            border-spacing: 0;
                        }
                        .cxc-report-table thead th {
                            position: sticky;
                            top: 0;
                            z-index: 20;
                            background-color: var(--bg-header, #070c18);
                            border-bottom: 1px solid var(--border-glass);
                            white-space: nowrap;
                        }
                        .cxc-report-table tbody td {
                            border-bottom: 1px solid var(--border-glass);
                        }
                        .cxc-report-table tfoot td {
                            position: sticky;
                            bottom: 0;
                            z-index: 20;
                            background-color: var(--bg-header, #070c18);
                            border-top: 2px solid var(--border-glass);
                            white-space: nowrap;
                        }
                    `}</style>

                    {/* Barra de desplazamiento horizontal superior sincronizada con la tabla */}
                    <div
                        ref={topScrollRef}
                        onScroll={handleTopScroll}
                        className="cxc-top-scrollbar"
                        style={{
                            width: '100%',
                            overflowX: 'auto',
                            overflowY: 'hidden',
                            height: '11px',
                            marginBottom: '4px',
                            background: 'rgba(255, 255, 255, 0.04)',
                            borderRadius: '6px'
                        }}
                    >
                        <div style={{ width: `${tableWidth}px`, height: '1px' }} />
                    </div>

                    {/* TABLA CON LAS 11 COLUMNAS EN EL ORDEN EXACTO (Scroll vertical derecho y sin barra horizontal inferior) */}
                    <div
                        ref={tableScrollRef}
                        onScroll={handleTableScroll}
                        className="cxc-table-scroll-container hide-bottom-scrollbar"
                        style={{
                            overflowX: 'auto',
                            overflowY: 'auto',
                            maxHeight: '620px',
                            borderRadius: '12px',
                            border: '1px solid var(--border-glass)',
                            background: 'var(--bg-card)'
                        }}
                    >
                        <table ref={tableElRef} className="cxc-report-table" style={{ width: '100%', minWidth: '1380px', textAlign: 'left', fontSize: '0.85rem' }}>
                            <thead>
                                <tr>
                                    {/* 1. Vendedor */}
                                    <th style={{ padding: '0.85rem 0.9rem', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => handleSort('vendedorId')}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <span>Vendedor</span>
                                            <ArrowUpDown size={12} />
                                        </div>
                                    </th>
                                    {/* 2. Factura */}
                                    <th style={{ padding: '0.85rem 0.9rem', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => handleSort('factura')}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <span>{isNotaEntregaTab ? 'Factura / Nota' : 'Factura'}</span>
                                            <ArrowUpDown size={12} />
                                        </div>
                                    </th>
                                    {/* 3. RIF */}
                                    <th style={{ padding: '0.85rem 0.9rem', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => handleSort('rif')}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <span>RIF</span>
                                            <ArrowUpDown size={12} />
                                        </div>
                                    </th>
                                    {/* 4. Nombre Cliente */}
                                    <th style={{ padding: '0.85rem 0.9rem', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => handleSort('cliente')}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <span>Nombre Cliente</span>
                                            <ArrowUpDown size={12} />
                                        </div>
                                    </th>
                                    {/* 5. Fecha Emisión */}
                                    <th style={{ padding: '0.85rem 0.9rem', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => handleSort('fechaEmision')}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <span>Fecha Emisión</span>
                                            <ArrowUpDown size={12} />
                                        </div>
                                    </th>
                                    {/* 6. Fecha Venc. */}
                                    <th style={{ padding: '0.85rem 0.9rem', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => handleSort('fechaVencimiento')}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <span>Fecha Venc.</span>
                                            <ArrowUpDown size={12} />
                                        </div>
                                    </th>
                                    {/* 7. Días de Vencido */}
                                    <th style={{ padding: '0.85rem 0.9rem', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'center', cursor: 'pointer' }} onClick={() => handleSort('diasVencidos')}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                            <span>Días de Vencido</span>
                                            <ArrowUpDown size={12} />
                                        </div>
                                    </th>
                                    {/* 8. Días de Crédito */}
                                    <th style={{ padding: '0.85rem 0.9rem', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'center', cursor: 'pointer' }} onClick={() => handleSort('diasCredito')}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                            <span>Días de Crédito</span>
                                            <ArrowUpDown size={12} />
                                        </div>
                                    </th>
                                    {/* 9. Monto Factura */}
                                    <th style={{ padding: '0.85rem 0.9rem', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('montoFacturaUsd')}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                                            <span>Monto Factura</span>
                                            <ArrowUpDown size={12} />
                                        </div>
                                    </th>
                                    {/* 10. Abonos */}
                                    <th style={{ padding: '0.85rem 0.9rem', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('abonosUsd')}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                                            <span>Abonos</span>
                                            <ArrowUpDown size={12} />
                                        </div>
                                    </th>
                                    {/* 11. Restante */}
                                    <th style={{ padding: '0.85rem 0.9rem', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('restanteUsd')}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                                            <span>Restante</span>
                                            <ArrowUpDown size={12} />
                                        </div>
                                    </th>
                                    {/* Columna Acciones */}
                                    <th style={{ padding: '0.85rem 0.9rem', fontWeight: 600, color: 'var(--text-secondary)', textAlign: 'center', width: '130px' }}>
                                        Acciones
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredInvoices.length === 0 ? (
                                    <tr>
                                        <td colSpan="12" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                                                <CheckCircle size={36} color="#10b981" />
                                                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                                                    No hay {isNotaEntregaTab ? 'Notas de Entrega' : 'Facturas Fiscales'} que coincidan con el filtro
                                                </div>
                                                <div style={{ fontSize: '0.8rem' }}>
                                                    Puede agregar un nuevo documento con el botón "+ {isNotaEntregaTab ? 'Nueva Nota de Entrega' : 'Nueva Factura Fiscal'}".
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    filteredInvoices.map((inv) => {
                                        const isSelectedForCobro = String(cobroDocKey) === String(inv.factNum);
                                        return (
                                            <tr
                                                key={inv.id || inv.factura}
                                                style={{
                                                    borderBottom: '1px solid var(--border-glass)',
                                                    background: isSelectedForCobro ? 'rgba(16, 185, 129, 0.08)' : 'transparent',
                                                    transition: 'background 0.15s ease'
                                                }}
                                            >
                                                {/* 1. Vendedor */}
                                                <td style={{ padding: '0.85rem 0.9rem', whiteSpace: 'nowrap' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <span style={{
                                                            padding: '2px 6px',
                                                            borderRadius: '6px',
                                                            background: 'rgba(255,255,255,0.06)',
                                                            border: '1px solid var(--border-glass)',
                                                            fontFamily: 'var(--font-code)',
                                                            fontWeight: 700,
                                                            color: 'var(--brand-blue)',
                                                            fontSize: '0.78rem'
                                                        }}>
                                                            {inv.vendedorId}
                                                        </span>
                                                        {inv.vendedorNombre && inv.vendedorNombre !== inv.vendedorId && (
                                                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }} title={inv.vendedorNombre}>
                                                                {inv.vendedorNombre.slice(0, 16)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* 2. Factura */}
                                                <td style={{ padding: '0.85rem 0.9rem', fontWeight: 700, color: 'var(--brand-blue)', fontFamily: 'var(--font-code)', whiteSpace: 'nowrap' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <span>#{inv.factura}</span>
                                                        {inv.tipoDoc === 'NOTA_ENTREGA' && (
                                                            <span style={{
                                                                fontSize: '0.68rem',
                                                                padding: '1px 5px',
                                                                borderRadius: '4px',
                                                                background: 'rgba(217, 119, 6, 0.15)',
                                                                color: '#fbbf24',
                                                                border: '1px solid rgba(217, 119, 6, 0.3)',
                                                                fontFamily: 'var(--font-main)'
                                                            }}>
                                                                N/E
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* 3. RIF */}
                                                <td style={{ padding: '0.85rem 0.9rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                                                    {inv.rif}
                                                </td>

                                                {/* 4. Nombre Cliente */}
                                                <td style={{ padding: '0.85rem 0.9rem', fontWeight: 600, color: 'var(--text-primary)', maxWidth: '240px' }}>
                                                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={inv.cliente}>
                                                        {inv.cliente}
                                                    </div>
                                                </td>

                                                {/* 5. Fecha Emisión */}
                                                <td style={{ padding: '0.85rem 0.9rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-code)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                                                    {formatDateShort(inv.fechaEmision)}
                                                </td>

                                                {/* 6. Fecha Venc. */}
                                                <td style={{ padding: '0.85rem 0.9rem', color: 'var(--text-secondary)', fontFamily: 'var(--font-code)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                                                    {formatDateShort(inv.fechaVencimiento)}
                                                </td>

                                                {/* 7. Días de Vencido */}
                                                <td style={{ padding: '0.85rem 0.9rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                    {inv.restanteUsd <= 0.01 ? (
                                                        <span style={{
                                                            padding: '0.2rem 0.55rem',
                                                            borderRadius: '12px',
                                                            fontSize: '0.72rem',
                                                            fontWeight: 700,
                                                            background: 'rgba(2, 132, 199, 0.15)',
                                                            color: 'var(--brand-blue)',
                                                            border: '1px solid rgba(2, 132, 199, 0.3)',
                                                            fontFamily: 'var(--font-code)'
                                                        }}>
                                                            0 (Pagada)
                                                        </span>
                                                    ) : inv.diasVencidos > 0 ? (
                                                        <span style={{
                                                            padding: '0.2rem 0.65rem',
                                                            borderRadius: '12px',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 700,
                                                            background: 'rgba(239, 68, 68, 0.15)',
                                                            color: '#ef4444',
                                                            border: '1px solid rgba(239, 68, 68, 0.3)',
                                                            fontFamily: 'var(--font-code)'
                                                        }}>
                                                            {inv.diasVencidos} días
                                                        </span>
                                                    ) : (
                                                        <span style={{
                                                            padding: '0.2rem 0.65rem',
                                                            borderRadius: '12px',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 700,
                                                            background: 'rgba(16, 185, 129, 0.15)',
                                                            color: '#10b981',
                                                            border: '1px solid rgba(16, 185, 129, 0.3)',
                                                            fontFamily: 'var(--font-code)'
                                                        }}>
                                                            0 días
                                                        </span>
                                                    )}
                                                </td>

                                                {/* 8. Días de Crédito */}
                                                <td style={{ padding: '0.85rem 0.9rem', textAlign: 'center', color: 'var(--text-secondary)', fontFamily: 'var(--font-code)', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                                                    {inv.diasCredito} días
                                                </td>

                                                {/* 9. Monto Factura */}
                                                <td style={{ padding: '0.85rem 0.9rem', textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-code)', whiteSpace: 'nowrap' }}>
                                                    {formatUsd(inv.montoFacturaUsd)}
                                                    {inv.tipoDoc === 'NOTA_ENTREGA' && (
                                                        <div style={{ fontSize: '0.68rem', color: '#fbbf24', fontFamily: 'var(--font-main)' }}>
                                                            Sin IVA (0%)
                                                        </div>
                                                    )}
                                                </td>

                                                {/* 10. Abonos */}
                                                <td style={{ padding: '0.85rem 0.9rem', textAlign: 'right', fontWeight: 700, color: '#10b981', fontFamily: 'var(--font-code)', whiteSpace: 'nowrap' }}>
                                                    {formatUsd(inv.abonosUsd)}
                                                </td>

                                                {/* 11. Restante */}
                                                <td style={{ padding: '0.85rem 0.9rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                                                    <div style={{
                                                        fontWeight: 800,
                                                        color: inv.restanteUsd <= 0.01 ? 'var(--brand-blue)' : '#ef4444',
                                                        fontFamily: 'var(--font-code)',
                                                        fontSize: '0.9rem'
                                                    }}>
                                                        {formatUsd(inv.restanteUsd)}
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)' }}>
                                                        {formatBs(inv.restanteUsd * tasaBcv)}
                                                    </div>
                                                </td>

                                                {/* Acciones: Cobrar + Ver + EDITAR al lado de ELIMINAR */}
                                                <td style={{ padding: '0.85rem 0.9rem', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
                                                        {inv.restanteUsd > 0.01 && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleSelectDocForCobro(inv.factNum)}
                                                                className="btn"
                                                                style={{
                                                                    padding: '0.35rem 0.65rem',
                                                                    fontSize: '0.75rem',
                                                                    fontWeight: 700,
                                                                    borderRadius: '7px',
                                                                    background: isSelectedForCobro ? '#10b981' : 'rgba(16, 185, 129, 0.15)',
                                                                    color: isSelectedForCobro ? '#ffffff' : '#10b981',
                                                                    border: '1px solid rgba(16, 185, 129, 0.35)',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '3px',
                                                                    cursor: 'pointer'
                                                                }}
                                                                title="Cargar en Parte A para registrar cobro"
                                                            >
                                                                <DollarSign size={13} />
                                                                <span>Cobrar</span>
                                                            </button>
                                                        )}

                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedInvoiceDetail(inv)}
                                                            className="btn btn-secondary"
                                                            style={{ padding: '0.35rem 0.55rem', borderRadius: '7px' }}
                                                            title="Ver Detalle"
                                                        >
                                                            <Eye size={14} />
                                                        </button>

                                                        {/* Botón de EDITAR al lado de ELIMINAR */}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenEditDocModal(inv)}
                                                            className="btn"
                                                            style={{
                                                                padding: '0.35rem 0.55rem',
                                                                borderRadius: '7px',
                                                                background: 'rgba(217, 119, 6, 0.15)',
                                                                color: '#fbbf24',
                                                                border: '1px solid rgba(217, 119, 6, 0.35)',
                                                                cursor: 'pointer'
                                                            }}
                                                            title="Editar todos los datos del documento"
                                                        >
                                                            <Edit2 size={14} />
                                                        </button>

                                                        {onDeleteSale && (
                                                            <button
                                                                type="button"
                                                                disabled={deletingKey === (inv.id || inv.factura)}
                                                                onClick={() => handleDeleteDocumentRow(inv)}
                                                                className="btn"
                                                                style={{
                                                                    padding: '0.35rem 0.55rem',
                                                                    borderRadius: '7px',
                                                                    background: 'rgba(239, 68, 68, 0.15)',
                                                                    color: '#ef4444',
                                                                    border: '1px solid rgba(239, 68, 68, 0.35)',
                                                                    cursor: 'pointer'
                                                                }}
                                                                title="Eliminar documento de la base de datos"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                            {filteredInvoices.length > 0 && (
                                <tfoot>
                                    <tr style={{ fontWeight: 700 }}>
                                        <td colSpan="8" style={{ padding: '0.9rem', textAlign: 'right', textTransform: 'uppercase', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                            Totales del Reporte ({filteredInvoices.length} documentos):
                                        </td>
                                        <td style={{ padding: '0.9rem', textAlign: 'right', color: 'var(--text-primary)', fontFamily: 'var(--font-code)', fontSize: '0.9rem' }}>
                                            {formatUsd(summaryMetrics.totalMontoFacturaUsd)}
                                        </td>
                                        <td style={{ padding: '0.9rem', textAlign: 'right', color: '#10b981', fontFamily: 'var(--font-code)', fontSize: '0.9rem' }}>
                                            {formatUsd(summaryMetrics.totalAbonosUsd)}
                                        </td>
                                        <td style={{ padding: '0.9rem', textAlign: 'right', color: '#ef4444', fontFamily: 'var(--font-code)', fontSize: '0.9rem' }}>
                                            {formatUsd(summaryMetrics.totalRestanteUsd)}
                                        </td>
                                        <td></td>
                                    </tr>
                                </tfoot>
                            )}
                        </table>
                    </div>
                </div>

            </div>
        </section>
    );

    return (
        <>
            {onClose ? (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'var(--bg-modal-overlay, rgba(3, 7, 18, 0.85))',
                    backdropFilter: 'blur(8px)',
                    zIndex: 9999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1rem',
                    overflowY: 'auto'
                }}>
                    <div style={{ width: '100%', maxWidth: '1650px', maxHeight: '94vh', overflowY: 'auto', borderRadius: '16px' }}>
                        {cardContent}
                    </div>
                </div>
            ) : (
                <div style={{ width: '100%', maxWidth: '1750px', margin: '0 auto', paddingBottom: '5rem' }}>
                    {cardContent}
                </div>
            )}

            {/* ============================================================
                MODAL DE EDICIÓN / CREACIÓN COMPLETA DE DOCUMENTO CXC
            ============================================================ */}
            {editingDoc && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'var(--bg-modal-overlay, rgba(3, 7, 18, 0.85))',
                    backdropFilter: 'blur(8px)',
                    zIndex: 10000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1rem'
                }}>
                    <div style={{
                        background: 'var(--bg-modal, #0c1427)',
                        border: '1px solid var(--border-glass)',
                        borderRadius: '16px',
                        width: '100%',
                        maxWidth: '820px',
                        boxShadow: 'var(--shadow-industrial, 0 20px 50px rgba(0,0,0,0.8))',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            padding: '1.25rem 1.5rem',
                            borderBottom: '1px solid var(--border-glass)',
                            background: 'var(--bg-card-header)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                <div style={{
                                    width: '38px',
                                    height: '38px',
                                    borderRadius: '10px',
                                    background: 'rgba(217, 119, 6, 0.2)',
                                    color: '#fbbf24',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}>
                                    <Edit2 size={20} />
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-heading)' }}>
                                        {isCreatingDoc
                                            ? (editingDoc.tipoDoc === 'NOTA_ENTREGA' ? 'Nueva Nota de Entrega CxC' : 'Nueva Factura Fiscal CxC')
                                            : `Editar Documento #${editingDoc.originalFactNum || editingDoc.factNum}`}
                                    </h3>
                                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                        {editingDoc.tipoDoc === 'NOTA_ENTREGA'
                                            ? 'Nota de Entrega: No se calcula IVA (0%) ni ningún impuesto.'
                                            : 'Factura Fiscal: Permite editar todos los datos fiscales, vendedor y saldos.'}
                                    </span>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setEditingDoc(null)}
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveEditedDoc} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem', maxHeight: '78vh', overflowY: 'auto' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                                {/* Tipo de Documento */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                                        Tipo de Documento *
                                    </label>
                                    <select
                                        value={editingDoc.tipoDoc}
                                        onChange={(e) => handleEditFieldChange('tipoDoc', e.target.value)}
                                        className="select-modern"
                                        style={{ width: '100%', padding: '0.65rem 0.85rem' }}
                                    >
                                        <option value="FACTURA">Factura Fiscal (Con IVA)</option>
                                        <option value="NOTA_ENTREGA">Nota de Entrega (Sin IVA / 0%)</option>
                                    </select>
                                </div>

                                {/* N° Documento */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                                        {editingDoc.tipoDoc === 'NOTA_ENTREGA' ? 'N° Nota de Entrega *' : 'N° Factura *'}
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={editingDoc.factNum}
                                        onChange={(e) => handleEditFieldChange('factNum', e.target.value)}
                                        className="input-modern"
                                        style={{ width: '100%', padding: '0.65rem 0.85rem', fontWeight: 700, fontFamily: 'var(--font-code)', color: 'var(--brand-blue)' }}
                                    />
                                </div>

                                {/* Código Vendedor */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                                        Código Vendedor *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={editingDoc.vendedorId}
                                        onChange={(e) => handleEditFieldChange('vendedorId', e.target.value)}
                                        placeholder="Ej. VV, YC, CB..."
                                        className="input-modern"
                                        style={{ width: '100%', padding: '0.65rem 0.85rem', fontWeight: 700, fontFamily: 'var(--font-code)', color: 'var(--brand-blue)' }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                                        Nombre Vendedor
                                    </label>
                                    <input
                                        type="text"
                                        value={editingDoc.vendedorNombre}
                                        onChange={(e) => handleEditFieldChange('vendedorNombre', e.target.value)}
                                        placeholder="Nombre del vendedor"
                                        className="input-modern"
                                        style={{ width: '100%', padding: '0.65rem 0.85rem' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                                        RIF *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={editingDoc.rif}
                                        onChange={(e) => handleEditFieldChange('rif', e.target.value)}
                                        placeholder="J-12345678-9"
                                        className="input-modern"
                                        style={{ width: '100%', padding: '0.65rem 0.85rem', fontFamily: 'var(--font-code)' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                                        Nombre Cliente *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={editingDoc.cliente}
                                        onChange={(e) => handleEditFieldChange('cliente', e.target.value)}
                                        placeholder="Razón social del cliente"
                                        className="input-modern"
                                        style={{ width: '100%', padding: '0.65rem 0.85rem' }}
                                    />
                                </div>
                            </div>

                            {/* Fechas, Tasa del día de facturación (Editable) y Días */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                                gap: '1rem',
                                background: 'var(--bg-surface)',
                                padding: '1rem',
                                borderRadius: '12px',
                                border: '1px solid var(--border-glass)'
                            }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                                        Fecha Emisión *
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={editingDoc.fechaEmisionIso}
                                        onChange={(e) => handleEditFieldChange('fechaEmisionIso', e.target.value)}
                                        className="input-modern"
                                        style={{ width: '100%', padding: '0.65rem 0.85rem' }}
                                    />
                                </div>

                                {/* Tasa del día de facturación (Editable) */}
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#10b981', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                                        Tasa Facturación (Bs/USD) *
                                    </label>
                                    <input
                                        type="number"
                                        step="0.0001"
                                        min="0.0001"
                                        required
                                        value={editingDoc.tasa || tasaBcv}
                                        onChange={(e) => handleEditFieldChange('tasa', e.target.value)}
                                        placeholder="Ej. 451.51"
                                        className="input-modern"
                                        style={{ width: '100%', padding: '0.65rem 0.85rem', fontFamily: 'var(--font-code)', color: '#10b981', fontWeight: 700 }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                                        Fecha Venc. *
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={editingDoc.fechaVencimientoIso}
                                        onChange={(e) => handleEditFieldChange('fechaVencimientoIso', e.target.value)}
                                        className="input-modern"
                                        style={{ width: '100%', padding: '0.65rem 0.85rem' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                                        Días de Crédito
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={editingDoc.diasCredito}
                                        onChange={(e) => handleEditFieldChange('diasCredito', e.target.value)}
                                        className="input-modern"
                                        style={{ width: '100%', padding: '0.65rem 0.85rem', fontFamily: 'var(--font-code)' }}
                                    />
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#ef4444', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                                        Días de Vencido
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={editingDoc.diasVencidos}
                                        onChange={(e) => handleEditFieldChange('diasVencidos', e.target.value)}
                                        className="input-modern"
                                        style={{ width: '100%', padding: '0.65rem 0.85rem', fontFamily: 'var(--font-code)', color: '#ef4444', fontWeight: 700 }}
                                    />
                                </div>
                            </div>

                            {/* Montos y Saldos con equivalentes en Bolívares */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                                gap: '0.85rem',
                                background: 'var(--bg-surface)',
                                padding: '1rem',
                                borderRadius: '12px',
                                border: '1px solid var(--border-glass)'
                            }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                                        Base ($)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={editingDoc.subtotalUsd}
                                        onChange={(e) => handleEditFieldChange('subtotalUsd', e.target.value)}
                                        className="input-modern"
                                        style={{ width: '100%', padding: '0.6rem 0.75rem', fontFamily: 'var(--font-code)' }}
                                    />
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)', marginTop: '4px' }}>
                                        Bs. {formatBs(round2(Number(editingDoc.subtotalUsd || 0) * (Number(editingDoc.tasa) || tasaBcv)))}
                                    </div>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                                        IVA (16%)
                                    </label>
                                    {editingDoc.tipoDoc === 'NOTA_ENTREGA' ? (
                                        <div>
                                            <div style={{ padding: '0.6rem 0.75rem', borderRadius: '8px', background: 'rgba(217,119,6,0.1)', color: '#fbbf24', fontSize: '0.8rem', fontFamily: 'var(--font-code)' }}>
                                                $ 0.00 (Exento)
                                            </div>
                                            <div style={{ fontSize: '0.72rem', color: '#fbbf24', fontFamily: 'var(--font-code)', marginTop: '4px' }}>
                                                Bs. 0,00
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '0.5rem 0' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={Boolean(editingDoc.aplicaIva)}
                                                    onChange={(e) => handleEditFieldChange('aplicaIva', e.target.checked)}
                                                />
                                                <span style={{ fontSize: '0.85rem', fontFamily: 'var(--font-code)', color: 'var(--text-primary)' }}>
                                                    ${Number(editingDoc.ivaUsd || 0).toFixed(2)}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'var(--font-code)', marginTop: '2px' }}>
                                                Bs. {formatBs(round2(Number(editingDoc.ivaUsd || 0) * (Number(editingDoc.tasa) || tasaBcv)))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                                        Monto Total ($) *
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        required
                                        value={editingDoc.montoFacturaUsd}
                                        onChange={(e) => handleEditFieldChange('montoFacturaUsd', e.target.value)}
                                        className="input-modern"
                                        style={{ width: '100%', padding: '0.6rem 0.75rem', fontWeight: 700, fontFamily: 'var(--font-code)', color: 'var(--text-primary)' }}
                                    />
                                    <div style={{ fontSize: '0.74rem', color: 'var(--text-primary)', fontWeight: 700, fontFamily: 'var(--font-code)', marginTop: '4px' }}>
                                        Bs. {formatBs(round2(Number(editingDoc.montoFacturaUsd || 0) * (Number(editingDoc.tasa) || tasaBcv)))}
                                    </div>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#10b981', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                                        Abonos ($)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={editingDoc.abonosUsd}
                                        onChange={(e) => handleEditFieldChange('abonosUsd', e.target.value)}
                                        className="input-modern"
                                        style={{ width: '100%', padding: '0.6rem 0.75rem', fontWeight: 700, fontFamily: 'var(--font-code)', color: '#10b981' }}
                                    />
                                    <div style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700, fontFamily: 'var(--font-code)', marginTop: '4px' }}>
                                        Bs. {formatBs(round2(Number(editingDoc.abonosUsd || 0) * (Number(editingDoc.tasa) || tasaBcv)))}
                                    </div>
                                </div>

                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#ef4444', textTransform: 'uppercase', marginBottom: '0.35rem' }}>
                                        Restante ($)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        readOnly
                                        value={editingDoc.restanteUsd}
                                        className="input-modern"
                                        style={{ width: '100%', padding: '0.6rem 0.75rem', fontWeight: 800, fontFamily: 'var(--font-code)', color: '#ef4444', cursor: 'not-allowed', background: 'rgba(239, 68, 68, 0.08)' }}
                                    />
                                    <div style={{ fontSize: '0.72rem', color: '#ef4444', fontWeight: 800, fontFamily: 'var(--font-code)', marginTop: '4px' }}>
                                        Bs. {formatBs(round2(Number(editingDoc.restanteUsd || 0) * (Number(editingDoc.tasa) || tasaBcv)))}
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-glass)' }}>
                                <button
                                    type="button"
                                    onClick={() => setEditingDoc(null)}
                                    className="btn btn-secondary"
                                    style={{ padding: '0.6rem 1.25rem' }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingDoc}
                                    className="btn btn-primary"
                                    style={{
                                        padding: '0.6rem 1.4rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        background: editingDoc.tipoDoc === 'NOTA_ENTREGA' ? 'linear-gradient(135deg, #d97706 0%, #b45309 100%)' : undefined
                                    }}
                                >
                                    <Check size={16} />
                                    <span>{isSavingDoc ? 'Guardando...' : 'Guardar Cambios'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ============================================================
                MODAL DE DETALLE DE DOCUMENTO
            ============================================================ */}
            {selectedInvoiceDetail && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'var(--bg-modal-overlay, rgba(3, 7, 18, 0.85))',
                    backdropFilter: 'blur(8px)',
                    zIndex: 10000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '1rem'
                }}>
                    <div style={{
                        background: 'var(--bg-modal, #0c1427)',
                        border: '1px solid var(--border-glass)',
                        borderRadius: '16px',
                        width: '100%',
                        maxWidth: '540px',
                        boxShadow: 'var(--shadow-industrial)',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            padding: '1.25rem 1.5rem',
                            borderBottom: '1px solid var(--border-glass)',
                            background: 'var(--bg-card-header)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontWeight: 800, color: 'var(--brand-blue)', fontFamily: 'var(--font-code)' }}>
                                    {selectedInvoiceDetail.tipoDoc === 'NOTA_ENTREGA' ? 'Nota de Entrega' : 'Factura Fiscal'} #{selectedInvoiceDetail.factura}
                                </span>
                                {selectedInvoiceDetail.diasVencidos > 0 ? (
                                    <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                                        VENCIDA ({selectedInvoiceDetail.diasVencidos} días)
                                    </span>
                                ) : (
                                    <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                                        AL DÍA
                                    </span>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedInvoiceDetail(null)}
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 1fr',
                                gap: '0.85rem',
                                background: 'var(--bg-surface)',
                                padding: '1rem',
                                borderRadius: '12px',
                                border: '1px solid var(--border-glass)',
                                fontSize: '0.82rem'
                            }}>
                                <div>
                                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Cliente:</span>
                                    <strong style={{ color: 'var(--text-primary)' }}>{selectedInvoiceDetail.cliente}</strong>
                                    <span style={{ display: 'block', color: 'var(--text-muted)', fontFamily: 'var(--font-code)', fontSize: '0.75rem' }}>{selectedInvoiceDetail.rif}</span>
                                </div>
                                <div>
                                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Vendedor:</span>
                                    <strong style={{ color: 'var(--brand-blue)' }}>{selectedInvoiceDetail.vendedorDisplay}</strong>
                                </div>
                                <div>
                                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Fecha Emisión:</span>
                                    <span style={{ fontFamily: 'var(--font-code)', color: 'var(--text-secondary)' }}>{formatDateShort(selectedInvoiceDetail.fechaEmision)}</span>
                                </div>
                                <div>
                                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Fecha Vencimiento:</span>
                                    <span style={{ fontFamily: 'var(--font-code)', color: 'var(--text-secondary)' }}>{formatDateShort(selectedInvoiceDetail.fechaVencimiento)}</span>
                                </div>
                                <div>
                                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Días de Crédito:</span>
                                    <span style={{ fontFamily: 'var(--font-code)', color: 'var(--text-secondary)' }}>{selectedInvoiceDetail.diasCredito} días</span>
                                </div>
                                <div>
                                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.75rem' }}>Días de Vencido:</span>
                                    <span style={{ fontFamily: 'var(--font-code)', color: '#ef4444', fontWeight: 700 }}>{selectedInvoiceDetail.diasVencidos} días</span>
                                </div>
                            </div>

                            <div style={{
                                background: 'var(--bg-surface)',
                                padding: '1rem',
                                borderRadius: '12px',
                                border: '1px solid var(--border-glass)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.5rem',
                                fontSize: '0.85rem'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                                    <span>Monto Base:</span>
                                    <span style={{ fontFamily: 'var(--font-code)' }}>{formatUsd(selectedInvoiceDetail.subtotalUsd)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                                    <span>IVA:</span>
                                    <span style={{ fontFamily: 'var(--font-code)' }}>
                                        {selectedInvoiceDetail.tipoDoc === 'NOTA_ENTREGA'
                                            ? '$ 0.00 (Exento)'
                                            : formatUsd(selectedInvoiceDetail.ivaUsd)}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-primary)', fontWeight: 700, paddingTop: '0.4rem', borderTop: '1px solid var(--border-glass)' }}>
                                    <span>Monto Factura:</span>
                                    <span style={{ fontFamily: 'var(--font-code)' }}>{formatUsd(selectedInvoiceDetail.montoFacturaUsd)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#10b981', fontWeight: 700 }}>
                                    <span>Abonos Registrados:</span>
                                    <span style={{ fontFamily: 'var(--font-code)' }}>- {formatUsd(selectedInvoiceDetail.abonosUsd)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444', fontWeight: 800, fontSize: '0.98rem', paddingTop: '0.4rem', borderTop: '1px solid var(--border-glass)' }}>
                                    <span>Restante por Cobrar:</span>
                                    <span style={{ fontFamily: 'var(--font-code)' }}>{formatUsd(selectedInvoiceDetail.restanteUsd)}</span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.5rem' }}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const doc = selectedInvoiceDetail;
                                        setSelectedInvoiceDetail(null);
                                        handleOpenEditDocModal(doc);
                                    }}
                                    className="btn btn-secondary"
                                    style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#fbbf24', borderColor: 'rgba(217, 119, 6, 0.4)' }}
                                >
                                    <Edit2 size={14} />
                                    <span>Editar Documento</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedInvoiceDetail(null)}
                                    className="btn btn-secondary"
                                >
                                    Cerrar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

export default AccountsReceivableModal;
