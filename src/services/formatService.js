/**
 * Servicio de Formateo de Monedas y Redondeo para SIGNUM MOTORVEN
 * Formato USD: $ 1,000.00
 * Formato Bs.: Bs. 1.000,00
 */

export const formatUsd = (value) => {
  if (value === undefined || value === null || isNaN(Number(value))) {
    return '$ 0.00';
  }
  // Redondeo a 2 decimales
  const rounded = Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(rounded);
  
  return `$ ${formatted}`;
};

export const formatBs = (value) => {
  if (value === undefined || value === null || isNaN(Number(value))) {
    return 'Bs. 0,00';
  }
  // Redondeo financiero estándar a 2 decimales (Normativa SENIAT / Contabilidad)
  const val = Number(value);
  const rounded = Math.round((val + Number.EPSILON) * 100) / 100;
  
  const formatted = new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(rounded);
  
  return `Bs. ${formatted}`;
};

/**
 * Mapa oficial de Unidades de Medida / Presentaciones según tabla `profit_measurement_units`:
 * '01' -> 'Litros'
 * '02' -> 'Totem'
 * '03' -> 'Tambor'
 * '04' -> 'Paila'
 * '05' -> 'Caja'
 * '06' -> 'N/A'
 */
export const PRODUCT_UNIT_MAP = {
  '01': 'Litros',
  '1': 'Litros',
  '02': 'Totem',
  '2': 'Totem',
  '03': 'Tambor',
  '3': 'Tambor',
  '04': 'Paila',
  '4': 'Paila',
  '05': 'Caja',
  '5': 'Caja',
  '06': 'N/A',
  '6': 'N/A'
};

export const PRODUCT_UNITS_LIST = ['Caja', 'Paila', 'Tambor', 'Totem', 'Litros', 'N/A'];

export const resolveProductUnit = (unitOrProduct, fallback = 'Caja') => {
  if (!unitOrProduct) return fallback;
  if (typeof unitOrProduct === 'object') {
    const desc = String(unitOrProduct.descripcion || unitOrProduct.nombre || unitOrProduct.articuloDescripcion || '').toLowerCase();
    if (desc.includes('(paila)') || desc.includes('(pl)')) {
      return 'Paila';
    }
  }
  const raw = typeof unitOrProduct === 'object'
    ? String(
        unitOrProduct.unidad ||
        unitOrProduct.unidadVenta ||
        unitOrProduct.unidad_venta ||
        unitOrProduct.uni_venta ||
        unitOrProduct.des_uni ||
        unitOrProduct.co_uni ||
        ''
      ).trim()
    : String(unitOrProduct).trim();

  if (!raw) return fallback;
  if (PRODUCT_UNIT_MAP[raw]) return PRODUCT_UNIT_MAP[raw];

  const padded = raw.length === 1 && /^\d$/.test(raw) ? `0${raw}` : raw;
  if (PRODUCT_UNIT_MAP[padded]) return PRODUCT_UNIT_MAP[padded];

  // Normalizar variantes descriptivas a su des_uni oficial de profit_measurement_units
  const lower = raw.toLowerCase();
  if (lower === 'caja (12l)' || lower.startsWith('caja')) return 'Caja';
  if (lower === 'cuñete (19l)' || lower.startsWith('cuñete') || lower.startsWith('paila') || lower.startsWith('balde')) return 'Paila';
  if (lower.startsWith('tambor')) return 'Tambor';
  if (lower.startsWith('totem') || lower.startsWith('tótem')) return 'Totem';
  if (lower.startsWith('litro') || lower === 'granel') return 'Litros';

  return raw;
};

/**
 * Resuelve los litros por unidad reales de un producto según su código y presentación:
 * - Paila: 19 L
 * - Caja estándar: 11.35 L
 * - Tambor: 208 L
 * - Totem: 1000 L
 * - Litros (Granel): 1 L
 */
export const resolveProductLitersPerUnit = (product) => {
  if (!product || typeof product !== 'object') return 11.35;

  const unit = resolveProductUnit(product, 'Caja');
  const rawLiters = Number(product.litrosPorUnidad ?? product.litros_por_unidad ?? product.litrosUnitarios ?? 0);

  if (unit === 'Paila') return rawLiters > 1 ? rawLiters : 19;
  if (unit === 'Tambor') return rawLiters > 1 ? rawLiters : 208;
  if (unit === 'Totem') return rawLiters > 1 ? rawLiters : 1000;
  if (unit === 'Litros') return 1;
  if (unit === 'N/A') return 0;

  // Caja (11.35 L; ignora 19 L heredado por error en códigos de caja como 100403/100502)
  return (rawLiters > 1 && rawLiters !== 19) ? rawLiters : 11.35;
};


