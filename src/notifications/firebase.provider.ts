/// 🔔 Firebase Provider for GigMatch Notifications
///
/// This module provides Firebase Admin SDK injection token and configuration

import { Logger } from '@nestjs/common';

export const INJECTION_TOKEN = 'FIREBASE_ADMIN';

export interface FirebaseAdmin {
  messaging: any;
  auth: any;
  firestore: any;
}

export const firebaseProvider = {
  provide: INJECTION_TOKEN,
  useFactory: async (): Promise<FirebaseAdmin> => {
    const logger = new Logger('FirebaseProvider');

    // Firebase admin will be initialized in the module
    // This is a placeholder until Firebase is configured
    logger.warn('Firebase Admin SDK not configured - push notifications disabled');

    return {
      messaging: null,
      auth: null,
      firestore: null,
    };
  },
};
