// ============================================
// 📁 src/services/nativeContactsService.ts
// Service de synchronisation des contacts natifs (Puce téléphonique)
// VERSION CORRIGÉE - Types @capacitor-community/contacts
// ============================================

import { Capacitor } from '@capacitor/core';
import { Contacts, Contact, PhoneNumber } from '@capacitor-community/contacts';
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
    return Capacitor.isNativePlatform();
  }

  /**
   * 🔐 Demander la permission d'accès aux contacts
   */
  async requestPermissions(): Promise<boolean> {
    try {
      console.log('📱 [NativeContacts] Demande de permission...');
      
      const permission = await Contacts.requestPermissions();
      
      console.log('📱 [NativeContacts] Réponse permission:', permission);
      
      return permission.contacts === 'granted';
    } catch (error) {
      console.error('❌ [NativeContacts] Erreur permission:', error);
      return false;
    }
  }

  /**
   * 🔍 Vérifier si la permission est déjà accordée
   */
  async checkPermissions(): Promise<boolean> {
    try {
      const permission = await Contacts.checkPermissions();
      return permission.contacts === 'granted';
    } catch (error) {
      console.error('❌ [NativeContacts] Erreur vérification permission:', error);
      return false;
    }
  }

  /**
   * 📋 Récupérer TOUS les contacts du téléphone
   */
  async getAllContacts(): Promise<NativeContact[]> {
    try {
      console.log('📱 [NativeContacts] Récupération des contacts natifs...');
      
      // Vérifier la permission d'abord
      const hasPermission = await this.checkPermissions();
      
      if (!hasPermission) {
        const granted = await this.requestPermissions();
        if (!granted) {
          throw new Error('Permission refusée pour accéder aux contacts');
        }
      }

      // Récupérer les contacts avec le plugin @capacitor-community/contacts
      const result = await Contacts.getContacts({
        projection: {
          name: true,
          phones: true,
          image: true
        }
      });

      console.log(`📱 [NativeContacts] ${result.contacts?.length || 0} contacts trouvés`);

      // Traiter et normaliser les contacts
      const processedContacts: NativeContact[] = [];
      
      for (const contact of result.contacts || []) {
        // ✅ Extraction sécurisée du nom
        const name = (contact.name?.display || 
                     contact.name?.given || 
                     contact.name?.family || 
                     'Sans nom') as string;

        // ✅ Extraction sécurisée des numéros de téléphone
        const phones = contact.phones || [];
        
        for (const phoneEntry of phones) {
          // ✅ Accès sécurisé au numéro
          const phoneNumber = phoneEntry.number;
          
          if (!phoneNumber) continue;
          
          const normalizedPhone = normalizePhone(phoneNumber);
          
          if (normalizedPhone) {
            processedContacts.push({
              id: contact.contactId || String(Math.random()),
              name,
              phone: normalizedPhone,
              displayName: contact.name?.display || undefined,
              photoUri: contact.image?.base64String 
                ? `data:image/png;base64,${contact.image.base64String}` 
                : undefined
            });
          }
        }
      }

      console.log(`✅ [NativeContacts] ${processedContacts.length} contacts valides extraits`);

      return processedContacts;
    } catch (error) {
      console.error('❌ [NativeContacts] Erreur récupération:', error);
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
      console.log('📱 [NativeContacts] Début synchronisation');
      console.log('═══════════════════════════════════════════════');

      // 1. Récupérer les contacts natifs
      if (onProgress) onProgress(10);
      
      const nativeContacts = await this.getAllContacts();
      
      if (nativeContacts.length === 0) {
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

      console.log(`📊 [NativeContacts] ${nativeContacts.length} contacts à synchroniser`);
      
      if (onProgress) onProgress(30);

      // 2. Dédupliquer les contacts (même numéro)
      const uniqueContacts = this.deduplicateContacts(nativeContacts);
      
      console.log(`🔍 [NativeContacts] ${uniqueContacts.length} contacts uniques après déduplication`);
      
      if (onProgress) onProgress(50);

      // 3. Envoyer au backend par lots de 100
      const BATCH_SIZE = 100;
      const batches = this.splitIntoBatches(uniqueContacts, BATCH_SIZE);
      
      let allOnChantilink: any[] = [];
      let allNotOnChantilink: NativeContact[] = [];
      
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        
        console.log(`📤 [NativeContacts] Envoi du lot ${i + 1}/${batches.length} (${batch.length} contacts)`);
        
        try {
          const result = await API.syncContacts(
            token, 
            batch.map(c => ({ name: c.name, phone: c.phone }))
          );

          allOnChantilink = [...allOnChantilink, ...(result.onChantilink || [])];
          allNotOnChantilink = [...allNotOnChantilink, ...(result.notOnChantilink || [])];

          // Progression
          const progress = 50 + ((i + 1) / batches.length) * 50;
          if (onProgress) onProgress(Math.round(progress));
          
        } catch (batchError) {
          console.error(`❌ [NativeContacts] Erreur lot ${i + 1}:`, batchError);
        }
      }

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
      console.log('✅ [NativeContacts] Synchronisation terminée');
      console.log(`📊 Résultats:`, finalResult.stats);
      console.log('═══════════════════════════════════════════════');

      if (onProgress) onProgress(100);

      return finalResult;

    } catch (error) {
      console.error('❌ [NativeContacts] Erreur synchronisation:', error);
      
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
        if (contact.name.length > existing.name.length) {
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
}

// ============================================
// 📤 EXPORT SINGLETON
// ============================================

export const nativeContactsService = new NativeContactsService();
export default nativeContactsService;