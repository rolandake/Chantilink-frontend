// ============================================
// 📁 src/pages/Chat/hooks/useMessagesData.js
// VERSION: ÉLITE - FIABILITÉ & CONFIDENTIALITÉ 🔐
// ✅ CORRIGÉ : API.getConversations + showToast sécurisé
// ============================================
import { useState, useEffect, useCallback, useRef } from "react";
import { API } from "../../../services/apiService";

/**
 * Hook de gestion des données pour la messagerie privée.
 * Gère les états de l'interface, les données des contacts et la sécurité des transitions.
 */
export function useMessagesData(token, showToast) {
  // --- 1. ÉTATS DE L'INTERFACE (Simplicité UX) ---
  const [ui, setUi] = useState({
    load: true,          // Chargement initial des données
    up: false,           // État d'upload (fichiers/médias)
    search: "",          // Recherche dans la liste de contacts
    showPending: false,  // Modal des demandes en attente
    showEmoji: false,    // Sélecteur d'emojis
    showAddContact: false,
    showForward: false,  // Modal de transfert de message
    contactFilter: 'all' // Filtre de liste (Tous / App / Autres)
  });

  // --- 2. DONNÉES MÉTIER (Fiabilité) ---
  const [data, setData] = useState({
    conn: [],             // Liste des contacts (amis et collègues)
    msg: [],              // Historique des messages de la discussion active
    unread: {},           // Compteurs de non-lus par utilisateur { userId: count }
    stats: { total: 0, onChantilink: 0, other: 0 },
    pendingRequests: []   // Demandes d'accès pour nouveaux messages
  });

  // --- 3. SÉLECTION ACTIVE (Confidentialité) ---
  const [sel, setSel] = useState({ 
    friend: null,         // Utilisateur sélectionné pour le chat
    msgToForward: null    // Message sélectionné pour un transfert
  });

  // --- 4. GESTION DES ERREURS & RÉSEAU ---
  const [err, setErr] = useState(null);
  const isMounted = useRef(true);

  /**
   * ✅ CHARGEMENT PARALLÈLE (Vitesse & Fiabilité)
   * On récupère conversations, stats et demandes en une seule fois.
   * Si une requête échoue, les autres continuent de fonctionner.
   */
  const load = useCallback(async () => {
    if (!token) return;

    setUi(prev => ({ ...prev, load: true }));
    setErr(null);

    try {
      const [convRes, statsRes, pendingRes] = await Promise.all([
        // ✅ CORRECTION 1 : loadConversations → getConversations
        API.getConversations(token).catch(e => {
          console.error("⚠️ Erreur Conversations:", e);
          return { conversations: [] }; // ✅ Ajusté pour correspondre à apiService
        }),
        // ✅ CORRECTION : loadStats n'existe pas dans apiService
        // Utiliser getContactsStats à la place
        API.getContactsStats(token).catch(e => {
          console.error("⚠️ Erreur Stats:", e);
          return { totalContacts: 0, unreadMessages: 0, pendingRequests: 0 };
        }),
        API.getPendingMessageRequests(token).catch(e => {
          console.error("⚠️ Erreur Demandes:", e);
          return { requests: [] };
        })
      ]);

      // Vérifier si le composant est toujours affiché pour éviter les fuites de mémoire
      if (!isMounted.current) return;

      // ✅ CORRECTION : Adapter la structure des données reçues
      setData(prev => ({
        ...prev,
        conn: convRes.conversations || [], // ✅ conversations au lieu de connections
        stats: {
          total: statsRes.totalContacts || 0,
          onChantilink: statsRes.totalContacts || 0,
          other: 0
        },
        pendingRequests: Array.isArray(pendingRes) ? pendingRes : (pendingRes.requests || [])
      }));

    } catch (globalError) {
      console.error("❌ [Critical Sync Error]:", globalError);
      
      // ✅ CORRECTION 2 : showToast sécurisé
      if (typeof showToast === 'function') {
        showToast("Problème de synchronisation réseau", "error");
      } else {
        console.error("❌ [Messages] Problème de synchronisation réseau");
      }
      
      setErr(globalError.message);
    } finally {
      if (isMounted.current) setUi(prev => ({ ...prev, load: false }));
    }
  }, [token, showToast]);

  /**
   * ✅ SÉCURITÉ DE TRANSITION (Confidentialité)
   * Dès qu'on clique sur un nouveau contact, on vide les messages à l'écran.
   * Cela évite que les messages d'un collègue s'affichent par erreur chez un autre (Leak visuel).
   */
  useEffect(() => {
    if (sel.friend?.id) {
      setData(prev => ({ ...prev, msg: [] }));
    }
  }, [sel.friend?.id]);

  /**
   * ✅ CYCLE DE VIE
   */
  useEffect(() => {
    isMounted.current = true;
    load();
    return () => { 
      isMounted.current = false; 
    };
  }, [load]);

  return {
    ui, setUi,
    data, setData,
    sel, setSel,
    err,
    load
  };
}