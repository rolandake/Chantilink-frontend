// ============================================
// 📁 src/utils/contactPickerUtil.js
// ✅ Contact Picker natif — conforme Google Play (avril 2026)
//    Sélection manuelle uniquement, jamais automatique
// ============================================

/**
 * Vérifie si le Contact Picker est supporté sur cet appareil
 */
export const isContactPickerSupported = () =>
  typeof window !== 'undefined' &&
  'contacts' in navigator &&
  'ContactsManager' in window;

/**
 * Ouvre le sélecteur de contacts natif (choix utilisateur)
 * @returns {Array|null} contacts sélectionnés, null si annulé, [] si non supporté
 */
export const openContactPicker = async (showToast) => {
  // ── Vérification support ──
  if (!isContactPickerSupported()) {
    if (showToast) {
      showToast(
        'Sélection de contacts non supportée sur cet appareil',
        'info'
      );
    }
    return [];
  }

  try {
    const props = ['name', 'tel'];
    const opts  = { multiple: true };
    const raw   = await navigator.contacts.select(props, opts);

    // Annulé par l'utilisateur (raw peut être null ou tableau vide)
    if (!raw || raw.length === 0) return null;

    // Aplatir : un contact peut avoir plusieurs numéros
    return raw.flatMap((c) =>
      (c.tel || []).map((phone) => ({
        name:  c.name?.[0]?.trim() || 'Inconnu',
        phone: phone.trim(),
      }))
    );
  } catch (err) {
    // Annulé, permission refusée, ou erreur device
    console.info('Contact Picker:', err.message);

    // Si c'est une vraie erreur (pas juste un cancel), on informe l'utilisateur
    if (err.name !== 'AbortError' && showToast) {
      showToast('Impossible d\'ouvrir le sélecteur de contacts', 'warning');
    }
    return null; // null = annulé / échec
  }
};