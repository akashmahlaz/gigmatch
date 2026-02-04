/// 🔔 Firebase Provider for GigMatch Notifications
///
/// This module provides Firebase Admin SDK injection token and configuration
/// Uses HTTP v1 API with Service Account authentication

import { Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

export const INJECTION_TOKEN = 'FIREBASE_ADMIN';

export interface FirebaseAdmin {
  messaging: admin.messaging.Messaging | null;
  auth: admin.auth.Auth | null;
  firestore: admin.firestore.Firestore | null;
  app: admin.app.App | null;
}

export const firebaseProvider = {
  provide: INJECTION_TOKEN,
  useFactory: async (): Promise<FirebaseAdmin> => {
    const logger = new Logger('FirebaseProvider');

    try {
      // Check if already initialized
      if (admin.apps.length > 0) {
        logger.log('Firebase Admin SDK already initialized');
        const app = admin.app();
        return {
          messaging: admin.messaging(app),
          auth: admin.auth(app),
          firestore: admin.firestore(app),
          app,
        };
      }

      // Look for service account file
      const serviceAccountPath = path.resolve(
        process.cwd(),
        'firebase-service-account.json',
      );

      if (!fs.existsSync(serviceAccountPath)) {
        logger.warn(
          `Firebase service account not found at ${serviceAccountPath}`,
        );
        logger.warn('Push notifications will be disabled');
        return {
          messaging: null,
          auth: null,
          firestore: null,
          app: null,
        };
      }

      // Initialize Firebase Admin SDK
      const serviceAccount = JSON.parse(
        fs.readFileSync(serviceAccountPath, 'utf8'),
      );

      const app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id,
      });

      logger.log(
        `✅ Firebase Admin SDK initialized for project: ${serviceAccount.project_id}`,
      );

      return {
        messaging: admin.messaging(app),
        auth: admin.auth(app),
        firestore: admin.firestore(app),
        app,
      };
    } catch (error: any) {
      logger.error(`Failed to initialize Firebase Admin SDK: ${error.message}`);
      return {
        messaging: null,
        auth: null,
        firestore: null,
        app: null,
      };
    }
  },
};
