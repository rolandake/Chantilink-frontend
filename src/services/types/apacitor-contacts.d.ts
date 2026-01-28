// ============================================
// 📁 src/types/capacitor-contacts.d.ts
// Déclarations de types pour @capacitor-community/contacts
// ============================================

declare module '@capacitor-community/contacts' {
  export interface PermissionStatus {
    contacts: 'granted' | 'denied' | 'prompt';
  }

  export interface Name {
    display?: string;
    given?: string;
    middle?: string;
    family?: string;
    prefix?: string;
    suffix?: string;
  }

  export interface PhoneNumber {
    type?: string;
    number?: string;
    label?: string;
  }

  export interface EmailAddress {
    type?: string;
    address?: string;
    label?: string;
  }

  export interface PostalAddress {
    type?: string;
    label?: string;
    street?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    country?: string;
  }

  export interface Image {
    base64String?: string;
    url?: string;
  }

  export interface Contact {
    contactId: string;
    name?: Name;
    displayName?: string;
    phones?: PhoneNumber[];
    emails?: EmailAddress[];
    postalAddresses?: PostalAddress[];
    birthday?: string;
    image?: Image;
    organizationName?: string;
    organizationRole?: string;
  }

  export interface GetContactsOptions {
    projection?: {
      name?: boolean;
      phones?: boolean;
      emails?: boolean;
      postalAddresses?: boolean;
      birthday?: boolean;
      image?: boolean;
      organizationName?: boolean;
      organizationRole?: boolean;
    };
  }

  export interface GetContactsResult {
    contacts: Contact[];
  }

  export interface ContactsPlugin {
    requestPermissions(): Promise<PermissionStatus>;
    checkPermissions(): Promise<PermissionStatus>;
    getContacts(options?: GetContactsOptions): Promise<GetContactsResult>;
  }

  export const Contacts: ContactsPlugin;
}