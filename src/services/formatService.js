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
