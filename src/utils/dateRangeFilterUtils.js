/**
 * Utilidades puras para filtrado uniforme por Fecha Exacta o Período (Desde - Hasta)
 * y fecha de corte global del sistema en SIGNUM MOTORVEN.
 */

export const SYSTEM_START_DATE = '2026-11-01';
export const SYSTEM_START_MONTH = '2026-11';

export const createDefaultDatePeriodFilter = (initialMode = 'EXACT') => ({
  mode: initialMode === 'RANGE' ? 'RANGE' : 'EXACT',
  exactDate: '',
  fromDate: '',
  toDate: ''
});

/**
 * Extrae una clave local YYYY-MM-DD sin desplazar fechas medianoche UTC al día anterior.
 */
export const extractLocalYmd = (dateInput) => {
  if (!dateInput) return '';
  if (dateInput instanceof Date) {
    if (Number.isNaN(dateInput.getTime())) return '';
    const y = dateInput.getFullYear();
    const m = String(dateInput.getMonth() + 1).padStart(2, '0');
    const d = String(dateInput.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const s = String(dateInput).trim();
  if (!s) return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return s;
  }

  const utcMidnightMatch = s.match(/^(\d{4}-\d{2}-\d{2})T00:00:00(?:\.\d+)?(?:Z|[+-]00:00)?$/i);
  if (utcMidnightMatch) {
    return utcMidnightMatch[1];
  }

  const dmyMatch = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmyMatch) {
    const [, dd, mm, yyyy] = dmyMatch;
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }

  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const isoPrefix = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return isoPrefix ? isoPrefix[1] : '';
};

/**
 * Extrae el valor de fecha principal de cualquier registro transaccional (camelCase o snake_case).
 */
export const resolveRecordDateValue = (rec) => {
  if (!rec || typeof rec !== 'object') return '';
  const direct = (
    rec.fechaEmision ??
    rec.fecha_emision ??
    rec.fecEmis ??
    rec.fec_emis ??
    rec.fechaEmisionIso ??
    rec.fechaCobro ??
    rec.fecha_cobro ??
    rec.fecCob ??
    rec.fec_cob ??
    rec.fechaPago ??
    rec.fecha_pago ??
    rec.fecPag ??
    rec.fec_pag ??
    rec.fec_pago ??
    rec.fechaCompra ??
    rec.fecha_compra ??
    rec.fechaRecepcion ??
    rec.fecha_recepcion ??
    rec.fechaCierre ??
    rec.fecha_cierre ??
    rec.fechaCreacion ??
    rec.fecha_creacion ??
    rec.fecha ??
    rec.createdAt ??
    rec.created_at ??
    rec.updatedAt ??
    rec.updated_at ??
    ''
  );
  if (direct) return direct;
  const pf = String(rec.periodoFiscal ?? rec.periodo_fiscal ?? '').trim();
  const ymDash = pf.match(/^(\d{4})-(\d{2})$/);
  if (ymDash) return `${ymDash[1]}-${ymDash[2]}-01`;
  const ymCompact = pf.match(/^(\d{4})(\d{2})$/);
  if (ymCompact) return `${ymCompact[1]}-${ymCompact[2]}-01`;
  return '';
};

/**
 * Verifica si una fecha es igual o posterior al inicio operativo oficial (01/11/2026).
 */
export const isOnOrAfterSystemStart = (dateInput, startYmd = SYSTEM_START_DATE) =>
  isOnOrAfterDate(dateInput, startYmd);

/**
 * Filtra una lista de registros manteniendo únicamente los emitidos desde `startYmd` (default 2026-11-01).
 */
export const filterRecordsFromSystemStart = (records = [], dateExtractor = null, startYmd = SYSTEM_START_DATE) => {
  if (!Array.isArray(records) || records.length === 0) return [];
  return records.filter((rec) => {
    if (!rec) return false;
    const rawDate = typeof dateExtractor === 'function' ? dateExtractor(rec) : resolveRecordDateValue(rec);
    return isOnOrAfterDate(rawDate, startYmd);
  });
};

/**
 * Limita una fecha YYYY-MM-DD al mínimo `startYmd` si es anterior.
 */
export const clampDateToSystemStart = (ymd, startYmd = SYSTEM_START_DATE) => {
  const clean = extractLocalYmd(ymd);
  if (!clean) return startYmd;
  return clean < startYmd ? startYmd : clean;
};

/**
 * Normaliza un rango de fechas YYYY-MM-DD ordenándolo cronológicamente si viene invertido.
 */
export const normalizeDateRange = (fromDate = '', toDate = '') => {
  const clean = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '').trim()) ? String(v).trim() : '');
  const f = clean(fromDate);
  const t = clean(toDate);
  if (f && t && f > t) {
    return { minDate: t, maxDate: f };
  }
  return { minDate: f, maxDate: t };
};

export const isDatePeriodFilterActive = (filter) => {
  if (!filter || typeof filter !== 'object') return false;
  if (filter.mode === 'RANGE') {
    return Boolean(filter.fromDate || filter.toDate);
  }
  return Boolean(filter.exactDate);
};

/**
 * Verifica si una fecha es igual o posterior a una fecha de corte YYYY-MM-DD.
 */
export const isOnOrAfterDate = (dateInput, minYmd) => {
  const cleanMin = String(minYmd || '').trim();
  if (!cleanMin) return true;
  const ymd = extractLocalYmd(dateInput);
  if (!ymd) return false;
  return ymd >= cleanMin;
};

export const matchesDatePeriodFilter = (dateInput, filter) => {
  if (!isDatePeriodFilterActive(filter)) return true;
  const ymd = extractLocalYmd(dateInput);
  if (!ymd) return false;

  if (filter.mode === 'RANGE') {
    const { minDate, maxDate } = normalizeDateRange(filter.fromDate, filter.toDate);
    if (minDate && ymd < minDate) return false;
    if (maxDate && ymd > maxDate) return false;
    return true;
  }

  return ymd === String(filter.exactDate || '').trim();
};

export const formatDateYmdVe = (ymd) => {
  const clean = String(ymd || '').trim();
  const m = clean.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    return `${m[3]}/${m[2]}/${m[1]}`;
  }
  return clean;
};

export const formatDatePeriodLabel = (filter) => {
  if (!isDatePeriodFilterActive(filter)) return '';
  if (filter.mode === 'RANGE') {
    const { minDate, maxDate } = normalizeDateRange(filter.fromDate, filter.toDate);
    if (minDate && maxDate) {
      return `Período: ${formatDateYmdVe(minDate)} al ${formatDateYmdVe(maxDate)}`;
    }
    if (minDate) {
      return `Desde: ${formatDateYmdVe(minDate)}`;
    }
    return `Hasta: ${formatDateYmdVe(maxDate)}`;
  }
  return `Fecha: ${formatDateYmdVe(filter.exactDate)}`;
};
