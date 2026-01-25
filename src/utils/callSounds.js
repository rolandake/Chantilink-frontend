// ============================================
// 📁 src/utils/callSounds.js
// SONS D'APPELS PROFESSIONNELS
// ============================================

/**
 * 📤 Son d'envoi de message (montée rapide)
 */
export const playSendSound = () => {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "triangle";
  osc.frequency.setValueAtTime(600, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.1);
  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.15);
};

/**
 * 📥 Son de réception de message (descente douce)
 */
export const playReceiveSound = () => {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.setValueAtTime(400, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.12);
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.12);
};

/**
 * 📞 Son d'appel sortant (sonnerie répétitive)
 * Style : "Tut... Tut... Tut..."
 */
export const playOutgoingCallSound = () => {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  
  const playRing = (time) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(440, time); // Note La (A4)
    
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.15, time + 0.05);
    gain.gain.linearRampToValueAtTime(0, time + 0.4);

    osc.connect(gain).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + 0.4);
  };

  // Jouer 3 sonneries espacées de 1.5s
  playRing(ctx.currentTime);
  playRing(ctx.currentTime + 1.5);
  playRing(ctx.currentTime + 3);
  
  return ctx; // Retourner le contexte pour pouvoir l'arrêter
};

/**
 * 📲 Son d'appel entrant (vibration + mélodie)
 * Style WhatsApp/iPhone
 */
export const playIncomingCallSound = () => {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  
  const playMelody = (startTime) => {
    const notes = [
      { freq: 523.25, time: 0 },      // Do (C5)
      { freq: 659.25, time: 0.15 },   // Mi (E5)
      { freq: 783.99, time: 0.3 },    // Sol (G5)
      { freq: 659.25, time: 0.45 },   // Mi (E5)
    ];

    notes.forEach(note => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(note.freq, startTime + note.time);
      
      gain.gain.setValueAtTime(0, startTime + note.time);
      gain.gain.linearRampToValueAtTime(0.2, startTime + note.time + 0.02);
      gain.gain.linearRampToValueAtTime(0, startTime + note.time + 0.15);

      osc.connect(gain).connect(ctx.destination);
      osc.start(startTime + note.time);
      osc.stop(startTime + note.time + 0.15);
    });
  };

  // Jouer la mélodie en boucle
  playMelody(ctx.currentTime);
  playMelody(ctx.currentTime + 1);
  playMelody(ctx.currentTime + 2);
  playMelody(ctx.currentTime + 3);
  
  return ctx;
};

/**
 * ✅ Son de connexion établie (succès)
 */
export const playCallConnectedSound = () => {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  
  const playTone = (freq, time, duration = 0.1) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, time);
    
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.15, time + 0.02);
    gain.gain.linearRampToValueAtTime(0, time + duration);

    osc.connect(gain).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + duration);
  };

  // Double bip ascendant
  playTone(523.25, ctx.currentTime, 0.08);      // Do (C5)
  playTone(783.99, ctx.currentTime + 0.1, 0.08); // Sol (G5)
};

/**
 * 📴 Son de déconnexion (fin d'appel)
 */
export const playCallEndedSound = () => {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  
  const playTone = (freq, time, duration = 0.1) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, time);
    
    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(0.15, time + 0.02);
    gain.gain.linearRampToValueAtTime(0, time + duration);

    osc.connect(gain).connect(ctx.destination);
    osc.start(time);
    osc.stop(time + duration);
  };

  // Double bip descendant
  playTone(783.99, ctx.currentTime, 0.08);      // Sol (G5)
  playTone(523.25, ctx.currentTime + 0.1, 0.08); // Do (C5)
};

/**
 * ❌ Son d'appel rejeté/occupé
 */
export const playCallRejectedSound = () => {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  
  // Bip d'occupation (ton continu bas)
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "square";
  osc.frequency.setValueAtTime(200, ctx.currentTime);
  
  gain.gain.setValueAtTime(0.1, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);

  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.8);
};

/**
 * 🔄 Gestion de la sonnerie continue (appel entrant)
 * Retourne un objet avec méthode stop()
 */
export class CallRingtone {
  constructor() {
    this.audioContext = null;
    this.intervalId = null;
    this.isPlaying = false;
  }

  start() {
    if (this.isPlaying) return;
    
    this.isPlaying = true;
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Jouer immédiatement
    this.playRing();
    
    // Puis répéter toutes les 2 secondes
    this.intervalId = setInterval(() => {
      this.playRing();
    }, 2000);
    
    console.log('🔔 [CallRingtone] Sonnerie démarrée');
  }

  playRing() {
    if (!this.audioContext) return;

    const ctx = this.audioContext;
    const now = ctx.currentTime;
    
    const notes = [
      { freq: 523.25, time: 0 },      // Do
      { freq: 659.25, time: 0.15 },   // Mi
      { freq: 783.99, time: 0.3 },    // Sol
      { freq: 659.25, time: 0.45 },   // Mi
    ];

    notes.forEach(note => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(note.freq, now + note.time);
      
      gain.gain.setValueAtTime(0, now + note.time);
      gain.gain.linearRampToValueAtTime(0.2, now + note.time + 0.02);
      gain.gain.linearRampToValueAtTime(0, now + note.time + 0.15);

      osc.connect(gain).connect(ctx.destination);
      osc.start(now + note.time);
      osc.stop(now + note.time + 0.15);
    });
  }

  stop() {
    if (!this.isPlaying) return;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch (e) {
        console.warn('[CallRingtone] Erreur fermeture AudioContext:', e);
      }
      this.audioContext = null;
    }
    
    this.isPlaying = false;
    console.log('🔕 [CallRingtone] Sonnerie arrêtée');
  }
}

/**
 * 📳 Vibration (si supportée par l'appareil)
 */
export const vibrateCall = () => {
  if ('vibrate' in navigator) {
    // Pattern: vibrer 500ms, pause 500ms, répéter
    navigator.vibrate([500, 500, 500, 500, 500, 500]);
  }
};

export const stopVibration = () => {
  if ('vibrate' in navigator) {
    navigator.vibrate(0);
  }
};