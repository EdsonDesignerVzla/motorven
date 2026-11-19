/**
 * Utilidades puras para filtrado uniforme por Fecha Exacta o Período (Desde - Hasta)
 * en vistas y modales de SIGNUM MOTORVEN.
 */

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

  const utcMidnightMatch = s.match(/^(\d{4}-\d{2}-\d{2})T00:00:00(?:\.000)?(?:Z|\+00:00)$/i);
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
