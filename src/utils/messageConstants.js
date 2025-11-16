// ============================================
// 📁 src/utils/messageConstants.js
// ============================================
export const CFG = {
  MAX_LEN: 5000,
  MAX_FILE: 10 * 1024 * 1024,
  RETRY: 3,
  DELAY: 1000,
  TIMEOUT: 30000,
  TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'audio/mp3', 'audio/wav'],
  MAX_PENDING_SENDERS: 50,
};

export const MSG = {
  err: { 
    send: 'Échec envoi', 
    file: 'Fichier trop gros', 
    type: 'Type non supporté', 
    net: 'Pas de réseau', 
    long: 'Message trop long' 
  },
  ok: { 
    sent: 'Envoyé', 
    del: 'Supprimé', 
    fwd: 'Transféré', 
    sync: 'Synchronisé', 
    phone: 'Numéro ajouté', 
    recon: 'Reconnecté', 
    contactAdded: 'Contact ajouté',
    contactDeleted: 'Contact supprimé',
    invited: 'Invitation envoyée'
  },
  info: { 
    load: 'Chargement...', 
    up: 'Envoi...', 
    recon: 'Reconnexion...' 
  },
};

export const TZ = 'Africa/Abidjan';

export const fmt = (t) => new Date(t).toLocaleTimeString('fr-FR', { 
  hour: '2-digit', 
  minute: '2-digit', 
  timeZone: TZ 
});

export const day = (t) => {
  const d = new Date(t), today = new Date(), yest = new Date(today);
  yest.setDate(yest.getDate() - 1);
  const opts = { day: 'numeric', month: 'short', timeZone: TZ };
  return d.toDateString() === today.toDateString() ? 'Aujourd\'hui' :
         d.toDateString() === yest.toDateString() ? 'Hier' :
         d.toLocaleDateString('fr-FR', opts);
};

