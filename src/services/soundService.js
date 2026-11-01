/**
 * soundService.js - Motorven Audio FX Engine
 * Utiliza Web Audio API pura para sintetizar sonidos de interfaz limpios,
 * modernos y sin dependencias de archivos externos ni latencia de red.
 */

let audioCtx = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

// Escuchar primer toque o click del usuario para desbloquear audio de forma segura
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().then(() => {
        ['click', 'touchstart', 'keydown'].forEach(evt => 
          window.removeEventListener(evt, unlockAudio)
        );
      }).catch(() => {});
    }
  };
  ['click', 'touchstart', 'keydown'].forEach(evt => 
    window.addEventListener(evt, unlockAudio, { once: true, passive: true })
  );
}

/**
 * Verifica si los sonidos están habilitados en la configuración de la app
 */
export function areSoundsEnabled(config) {
  if (config && typeof config.sonidosNotificacion === 'boolean') {
    return config.sonidosNotificacion;
  }
  try {
    const savedConfig = localStorage.getItem('signum_app_config');
    if (savedConfig) {
      const parsed = JSON.parse(savedConfig);
      if (typeof parsed.sonidosNotificacion === 'boolean') {
        return parsed.sonidosNotificacion;
      }
    }
  } catch (_) {}
  return true; // Por defecto activado
}

/**
 * Sintetizador de tonos armónicos con envolvente ADSR suave
 */
function playTone({ freq, type = 'sine', duration = 0.25, gain = 0.15, startTime = 0 }) {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime + startTime;
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);

  // Envolvente de volumen suave anti-clipping
  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(gain, now + 0.02);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(gainNode);
  gainNode.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + duration + 0.05);
}

/**
 * Efectos de sonido para cada tipo de notificación
 */
export const soundFX = {
  // Notificación de éxito: acorde mayor brillante y ascendente (Do5 - Mi5 - Sol5)
  success(enabled = true) {
    if (!enabled) return;
    try {
      playTone({ freq: 523.25, type: 'sine', duration: 0.12, gain: 0.12, startTime: 0 });      // C5
      playTone({ freq: 659.25, type: 'sine', duration: 0.14, gain: 0.14, startTime: 0.08 });   // E5
      playTone({ freq: 783.99, type: 'triangle', duration: 0.22, gain: 0.16, startTime: 0.16 }); // G5
    } catch (e) {
      console.debug('Error reproduciendo sonido de éxito:', e);
    }
  },

  // Notificación de error / fallo: tono doble descendente y firme
  error(enabled = true) {
    if (!enabled) return;
    try {
      playTone({ freq: 329.63, type: 'sawtooth', duration: 0.15, gain: 0.12, startTime: 0 });     // E4
      playTone({ freq: 246.94, type: 'sawtooth', duration: 0.25, gain: 0.15, startTime: 0.12 });  // B3
    } catch (e) {
      console.debug('Error reproduciendo sonido de error:', e);
    }
  },

  // Alerta de advertencia: doble pulso llamativo
  warning(enabled = true) {
    if (!enabled) return;
    try {
      playTone({ freq: 587.33, type: 'triangle', duration: 0.12, gain: 0.14, startTime: 0 });     // D5
      playTone({ freq: 587.33, type: 'sine', duration: 0.18, gain: 0.15, startTime: 0.14 });      // D5
    } catch (e) {
      console.debug('Error reproduciendo sonido de advertencia:', e);
    }
  },

  // Información: pop sutil y tecnológico
  info(enabled = true) {
    if (!enabled) return;
    try {
      playTone({ freq: 440.00, type: 'sine', duration: 0.10, gain: 0.10, startTime: 0 });         // A4
      playTone({ freq: 659.25, type: 'sine', duration: 0.15, gain: 0.12, startTime: 0.07 });      // E5
    } catch (e) {
      console.debug('Error reproduciendo sonido informativo:', e);
    }
  },

  // Diálogo de confirmación / decisión requerida: tono de pregunta elegante
  confirm(enabled = true) {
    if (!enabled) return;
    try {
      playTone({ freq: 493.88, type: 'sine', duration: 0.12, gain: 0.12, startTime: 0 });         // B4
      playTone({ freq: 659.25, type: 'triangle', duration: 0.22, gain: 0.15, startTime: 0.10 });  // E5
    } catch (e) {
      console.debug('Error reproduciendo sonido de confirmación:', e);
    }
  }
};

/**
 * Función genérica de sonido
 */
export function playNotificationSound(type = 'info', config = null) {
  const enabled = areSoundsEnabled(config);
  if (!enabled) return;

  const fn = soundFX[type] || soundFX.info;
  fn(enabled);
}

export default soundFX;
