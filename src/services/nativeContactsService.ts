// ============================================
// 📁 src/services/nativeContactsService.ts
// Service de synchronisation des contacts natifs (Puce téléphonique)
// VERSION FINALE - Imports corrects pour @capacitor-community/contacts
// ============================================

import { Capacitor } from '@capacitor/core';
import { Contacts, PermissionStatus as ContactPermissionStatus } from '@capacitor-community/contacts';
import { API } from './apiService';

// ============================================
// 🔧 TYPES & INTERFACES
// ============================================

export interface NativeContact {
  id: string;
  name: string;
  phone: string;
  displayName?: string;
  photoUri?: string;
}

export interface SyncResult {
  success: boolean;
  onChantilink: any[];
  notOnChantilink: NativeContact[];
  stats: {
    total: number;
    scanned: number;
    onApp: number;
    offApp: number;
    invalid: number;
  };
  errors?: string[];
}

export interface PermissionStatus {
  available: boolean;
  status: 'granted' | 'denied' | 'prompt' | 'prompt-with-rationale' | 'web' | 'error';
  message: string;
  canRequest: boolean;
}

// ============================================
// 🔐 NORMALISATION DU NUMÉRO (IDENTIQUE AU BACKEND)
// ============================================

const normalizePhone = (phoneNumber: string): string | null => {
  if (!phoneNumber) return null;
  
  // Retirer espaces, tirets, parenthèses, points
  let cleaned = phoneNumber.replace(/[\s\-\(\)\.]/g, '');
  
  // Remplacer 00 par +
  cleaned = cleaned.replace(/^00/, '+');
  
  // Si pas de +, ajouter +225 (Côte d'Ivoire)
  if (!cleaned.startsWith('+')) {
    cleaned = '+225' + cleaned.replace(/^0/, ''); // Enlever le 0 initial
  }
  
  // Validation minimale: au moins 10 chiffres
  const digitsOnly = cleaned.replace(/\D/g, '');
  if (digitsOnly.length < 10) {
    return null;
  }
  
  return cleaned;
};

// ============================================
// 📱 SERVICE PRINCIPAL
// ============================================

class NativeContactsService {
  
  /**
   * 🔍 Vérifier si l'environnement est natif (iOS/Android)
   */
  isNativePlatform(): boolean {
    const isNative = Capacitor.isNativePlatform();
    console.log(`📱 [NativeContacts] Plateforme: ${isNative ? 'NATIVE (iOS/Android)' : 'WEB'}`);
    return isNative;
  }

  /**
   * 🔐 Vérifier si la permission est déjà accordée
   * SANS déclencher de popup
   */
  async checkPermissions(): Promise<boolean> {
    if (!this.isNativePlatform()) {
      console.log('📱 [NativeContacts] Mode WEB - pas de vérification');
      return false;
    }

    try {
      const result = await Contacts.checkPermissions();
      console.log('🔐 [NativeContacts] Permission actuelle:', result);
      
      // Le plugin retourne { contacts: 'granted' | 'denied' | 'prompt' }
      return result.contacts === 'granted';
    } catch (error) {
      console.error('❌ [NativeContacts] Erreur vérification permission:', error);
      return false;
    }
  }

  /**
   * 🔐 Demander la permission (DÉCLENCHE LA POPUP SYSTÈME NATIVE)
   * C'est ici que la popup iOS/Android apparaît - comme Telegram
   */
  async requestPermissions(): Promise<boolean> {
    if (!this.isNativePlatform()) {
      console.log('📱 [NativeContacts] Mode WEB - pas de demande');
      return false;
    }

    try {
      console.log('🔐 [NativeContacts] Demande de permission système native...');
      
      // 🎯 CETTE LIGNE AFFICHE LA POPUP NATIVE
      // iOS: "Chantilink souhaite accéder à vos contacts"
      // Android: "Autoriser Chantilink à accéder à vos contacts ?"
      const result = await Contacts.requestPermissions();
      
      console.log('🔐 [NativeContacts] Réponse utilisateur:', result);
      
      const granted = result.contacts === 'granted';
      
      if (granted) {
        console.log('✅ [NativeContacts] Permission accordée !');
      } else {
        console.log('❌ [NativeContacts] Permission refusée');
      }
      
      return granted;
    } catch (error) {
      console.error('❌ [NativeContacts] Erreur demande permission:', error);
      
      // Certaines erreurs spécifiques
      if (error instanceof Error && error.message?.includes('not available')) {
        throw new Error('Fonction non disponible sur cet appareil');
      }
      
      return false;
    }
  }

  /**
   * 📊 Obtenir le statut détaillé des permissions
   */
  async getPermissionStatus(): Promise<PermissionStatus> {
    if (!this.isNativePlatform()) {
      return {
        available: false,
        status: 'web',
        message: 'Fonctionnalité disponible uniquement sur mobile',
        canRequest: false
      };
    }

    try {
      const result = await Contacts.checkPermissions();
      const status = result.contacts as PermissionStatus['status'];

      const messages: Record<string, string> = {
        'granted': 'Accès autorisé',
        'denied': 'Accès refusé définitivement',
        'prompt': 'Jamais demandé',
        'prompt-with-rationale': 'Refusé précédemment (Android)'
      };

      return {
        available: true,
        status,
        message: messages[status] || status,
        canRequest: status !== 'denied'
      };
    } catch (error) {
      return {
        available: false,
        status: 'error',
        message: error instanceof Error ? error.message : 'Erreur inconnue',
        canRequest: false
      };
    }
  }

  /**
   * 📋 Récupérer TOUS les contacts du téléphone
   */
  async getAllContacts(): Promise<NativeContact[]> {
    try {
      console.log('📱 [NativeContacts] Récupération des contacts natifs...');
      
      // ✅ Vérifier la permission d'abord
      const hasPermission = await this.checkPermissions();
      
      if (!hasPermission) {
        // ✅ Demander la permission (popup native apparaît ici)
        console.log('🔐 [NativeContacts] Permission non accordée, demande...');
        const granted = await this.requestPermissions();
        
        if (!granted) {
          throw new Error('Permission refusée pour accéder aux contacts');
        }
      }

      // ✅ Récupérer les contacts avec le plugin @capacitor-community/contacts
      const result = await Contacts.getContacts({
        projection: {
          name: true,
          phones: true,
          image: true
        }
      });

      console.log(`📱 [NativeContacts] ${result.contacts?.length || 0} contacts bruts trouvés`);

      // ✅ Traiter et normaliser les contacts
      const processedContacts: NativeContact[] = [];
      
      // Le plugin retourne un tableau de contacts
      const contacts = result.contacts || [];
      
      for (const contact of contacts) {
        // ✅ Extraction sécurisée du nom
        // Le format exact dépend de la plateforme (iOS vs Android)
        let name = 'Sans nom';
        
        if (contact.name) {
          // Essayer différentes propriétés selon la plateforme
          name = contact.name.display || 
                 (contact.name.given && contact.name.family 
                   ? `${contact.name.given} ${contact.name.family}`.trim()
                   : contact.name.given || contact.name.family || 'Sans nom');
        }

        // ✅ Extraction sécurisée des numéros de téléphone
        const phones = contact.phones || [];
        
        for (const phoneEntry of phones) {
          // Le format peut varier : {number: string} ou {value: string}
          const phoneNumber = phoneEntry.number || (phoneEntry as any).value;
          
          if (!phoneNumber) continue;
          
          const normalizedPhone = normalizePhone(phoneNumber);
          
          if (normalizedPhone) {
            processedContacts.push({
              id: contact.contactId || String(Math.random()),
              name: name.trim(),
              phone: normalizedPhone,
              displayName: contact.name?.display || name,
              photoUri: contact.image?.base64String 
                ? `data:image/png;base64,${contact.image.base64String}` 
                : undefined
            });
          }
        }
      }

      console.log(`✅ [NativeContacts] ${processedContacts.length} contacts valides extraits`);
      console.log('📋 Exemples:', processedContacts.slice(0, 3));

      return processedContacts;
    } catch (error) {
      console.error('❌ [NativeContacts] Erreur récupération contacts:', error);
      
      // Messages d'erreur plus clairs
      if (error instanceof Error && error.message?.includes('permission')) {
        throw new Error('Permission refusée. Activez l\'accès aux contacts dans les paramètres.');
      }
      
      throw error;
    }
  }

  /**
   * 📋 Récupérer les contacts avec pagination (pour grandes listes)
   */
  async getContactsBatch(offset: number = 0, limit: number = 100): Promise<NativeContact[]> {
    const allContacts = await this.getAllContacts();
    return allContacts.slice(offset, offset + limit);
  }

  /**
   * 🔄 Synchroniser avec le backend
   */
  async syncWithBackend(token: string, onProgress?: (percent: number) => void): Promise<SyncResult> {
    try {
      console.log('═══════════════════════════════════════════════');
      console.log('📱 [NativeContacts] DÉBUT SYNCHRONISATION');
      console.log('═══════════════════════════════════════════════');

      // 1️⃣ Récupérer les contacts natifs (permission sera demandée si besoin)
      if (onProgress) onProgress(10);
      console.log('📱 [1/5] Lecture de la puce téléphonique...');
      
      const nativeContacts = await this.getAllContacts();
      
      if (nativeContacts.length === 0) {
        console.log('⚠️ [NativeContacts] Aucun contact trouvé');
        return {
          success: true,
          onChantilink: [],
          notOnChantilink: [],
          stats: {
            total: 0,
            scanned: 0,
            onApp: 0,
            offApp: 0,
            invalid: 0
          }
        };
      }

      console.log(`📊 [NativeContacts] ${nativeContacts.length} contacts à traiter`);
      
      if (onProgress) onProgress(30);

      // 2️⃣ Dédupliquer les contacts (même numéro = même personne)
      console.log('🔍 [2/5] Déduplication...');
      const uniqueContacts = this.deduplicateContacts(nativeContacts);
      
      console.log(`✅ [NativeContacts] ${uniqueContacts.length} contacts uniques (${nativeContacts.length - uniqueContacts.length} doublons retirés)`);
      
      if (onProgress) onProgress(50);

      // 3️⃣ Envoyer au backend par lots de 100
      console.log('📤 [3/5] Envoi au serveur...');
      const BATCH_SIZE = 100;
      const batches = this.splitIntoBatches(uniqueContacts, BATCH_SIZE);
      
      let allOnChantilink: any[] = [];
      let allNotOnChantilink: NativeContact[] = [];
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        
        console.log(`📤 [NativeContacts] Lot ${i + 1}/${batches.length} (${batch.length} contacts)`);
        
        try {
          const result = await API.syncContacts(
            token, 
            batch.map(c => ({ name: c.name, phone: c.phone }))
          );

          allOnChantilink = [...allOnChantilink, ...(result.onChantilink || [])];
          allNotOnChantilink = [...allNotOnChantilink, ...(result.notOnChantilink || [])];

          // Progression
          const progress = 50 + ((i + 1) / batches.length) * 40;
          if (onProgress) onProgress(Math.round(progress));
          
        } catch (batchError) {
          console.error(`❌ [NativeContacts] Erreur lot ${i + 1}:`, batchError);
        }
      }

      // 4️⃣ Construire le résultat final
      console.log('📊 [4/5] Traitement des résultats...');
      
      const finalResult: SyncResult = {
        success: true,
        onChantilink: allOnChantilink,
        notOnChantilink: allNotOnChantilink,
        stats: {
          total: uniqueContacts.length,
          scanned: nativeContacts.length,
          onApp: allOnChantilink.length,
          offApp: allNotOnChantilink.length,
          invalid: nativeContacts.length - uniqueContacts.length
        }
      };

      console.log('═══════════════════════════════════════════════');
      console.log('✅ [NativeContacts] SYNCHRONISATION RÉUSSIE');
      console.log(`📊 Résultats:`, finalResult.stats);
      console.log(`   ✓ Sur Chantilink: ${finalResult.stats.onApp}`);
      console.log(`   ➖ Hors app: ${finalResult.stats.offApp}`);
      console.log(`   🚫 Doublons retirés: ${finalResult.stats.invalid}`);
      console.log('═══════════════════════════════════════════════');

      if (onProgress) onProgress(100);

      return finalResult;

    } catch (error) {
      console.error('═══════════════════════════════════════════════');
      console.error('❌ [NativeContacts] ÉCHEC SYNCHRONISATION');
      console.error('   Erreur:', error instanceof Error ? error.message : error);
      console.error('═══════════════════════════════════════════════');
      
      return {
        success: false,
        onChantilink: [],
        notOnChantilink: [],
        stats: {
          total: 0,
          scanned: 0,
          onApp: 0,
          offApp: 0,
          invalid: 0
        },
        errors: [error instanceof Error ? error.message : 'Erreur inconnue']
      };
    }
  }

  /**
   * 🔄 Dédupliquer les contacts (même numéro = même personne)
   */
  private deduplicateContacts(contacts: NativeContact[]): NativeContact[] {
    const seen = new Map<string, NativeContact>();
    
    for (const contact of contacts) {
      const key = contact.phone;
      
      if (!seen.has(key)) {
        seen.set(key, contact);
      } else {
        // Si on a déjà ce numéro, garder celui avec le nom le plus complet
        const existing = seen.get(key)!;
        if (contact.name.length > existing.name.length && contact.name !== 'Sans nom') {
          seen.set(key, contact);
        }
      }
    }
    
    return Array.from(seen.values());
  }

  /**
   * 📦 Diviser en lots pour l'envoi
   */
  private splitIntoBatches<T>(array: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    
    return batches;
  }

  /**
   * 🔍 Rechercher un contact par nom
   */
  async searchContacts(query: string): Promise<NativeContact[]> {
    const allContacts = await this.getAllContacts();
    
    const lowerQuery = query.toLowerCase();
    
    return allContacts.filter(contact => 
      contact.name.toLowerCase().includes(lowerQuery) ||
      contact.displayName?.toLowerCase().includes(lowerQuery)
    );
  }

  /**
   * 📊 Obtenir des statistiques sur les contacts
   */
  async getContactsStats(): Promise<{
    total: number;
    withPhoto: number;
    withMultipleNumbers: number;
  }> {
    const contacts = await this.getAllContacts();
    
    // Grouper par nom pour détecter les doublons
    const contactsByName = new Map<string, NativeContact[]>();
    
    for (const contact of contacts) {
      const existing = contactsByName.get(contact.name) || [];
      existing.push(contact);
      contactsByName.set(contact.name, existing);
    }
    
    const withPhoto = contacts.filter(c => c.photoUri).length;
    const withMultipleNumbers = Array.from(contactsByName.values())
      .filter(group => group.length > 1).length;
    
    return {
      total: contacts.length,
      withPhoto,
      withMultipleNumbers
    };
  }

  /**
   * ✅ Vérifier si le plugin Contacts est disponible
   */
  async isContactsPluginAvailable(): Promise<boolean> {
    try {
      if (!this.isNativePlatform()) {
        return false;
      }
      
      // Tenter de vérifier les permissions
      await Contacts.checkPermissions();
      return true;
    } catch (error) {
      console.error('❌ [NativeContacts] Plugin non disponible:', error);
      return false;
    }
  }
}

// ============================================
// 📤 EXPORT SINGLETON
// ============================================

export const nativeContactsService = new NativeContactsService();
export default nativeContactsService;