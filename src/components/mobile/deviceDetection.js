/**
 * Utilidad de Identificación de Dispositivos Móviles para SIGNUM MOTORVEN
 * Detecta con precisión modelos de iPhone, iPad, Android y smartphones modernos
 */

export function detectUserDevice() {
  if (typeof window === 'undefined') {
    return {
      model: 'Móvil',
      brand: 'Smartphone',
      type: 'phone',
      isApple: false,
      isAndroid: false,
      screenWidth: 390,
      screenHeight: 844,
      diagonal: '6.1"'
    };
  }

  const ua = navigator.userAgent || navigator.vendor || window.opera || '';
  const w = window.innerWidth || window.screen?.width || 390;
  const h = window.innerHeight || window.screen?.height || 844;
  const minDim = Math.min(w, h);
  const maxDim = Math.max(w, h);
  const pixelRatio = window.devicePixelRatio || 1;

  // Detección de Apple (iPhone / iPad / iPod)
  const isApple = /(iPhone|iPod|iPad)/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);

  let model = 'Smartphone';
  let brand = isApple ? 'Apple' : (isAndroid ? 'Android' : 'Móvil');
  let diagonal = '6.1"';

  if (isApple) {
    // Clasificación por dimensiones típicas de viewport en iOS Safari
    if (minDim >= 430 || (maxDim >= 920 && pixelRatio >= 3)) {
      model = 'iPhone Pro Max / Plus';
      diagonal = '6.7"';
    } else if (minDim >= 393 || (maxDim >= 850 && pixelRatio >= 3)) {
      model = 'iPhone 15 / 16 Pro';
      diagonal = '6.1"';
    } else if (minDim >= 390 || (maxDim >= 840)) {
      model = 'iPhone 13 / 14';
      diagonal = '6.1"';
    } else if (minDim <= 375 && maxDim <= 680) {
      model = 'iPhone SE';
      diagonal = '4.7"';
    } else if (minDim <= 375 && maxDim >= 800) {
      model = 'iPhone 12 / 13 mini';
      diagonal = '5.4"';
    } else {
      model = 'iPhone';
      diagonal = '6.1"';
    }
  } else if (isAndroid) {
    if (minDim >= 412 || maxDim >= 910) {
      model = 'Galaxy S24 / Ultra';
      diagonal = '6.8"';
    } else if (minDim >= 380) {
      model = 'Android Pro';
      diagonal = '6.5"';
    } else if (minDim <= 360) {
      model = 'Android Compact';
      diagonal = '6.1"';
    } else {
      model = 'Android Smartphone';
      diagonal = '6.4"';
    }
  }

  return {
    model,
    brand,
    isApple,
    isAndroid,
    screenWidth: w,
    screenHeight: h,
    pixelRatio,
    diagonal
  };
}
