// firebaseAdmin.ts
import * as admin from "firebase-admin";
import cors from "cors";
import {Request} from "express";
import firebaseConfig from '@legion/shared/firebaseConfig';
import { getStorage } from 'firebase-admin/storage';
import {hasValidAPIKey, verifyUID} from "./authPolicy";

admin.initializeApp(firebaseConfig);

export const storage = getStorage();

const LOCK_TIMEOUT = 10000; 

const corsOptions = {
  origin: true,
};
export const corsMiddleware = cors(corsOptions);

export async function getUID(request: Request): Promise<string> {
  return verifyUID(request.headers.authorization, token => admin.auth().verifyIdToken(token));
}

export const isDevelopment = process.env.NODE_ENV != "production";

export const checkAPIKey = (request: Request): boolean => {
  return hasValidAPIKey(request.headers["x-api-key"], process.env.API_KEY, isDevelopment);
};

async function acquireLock(uid: string) {
  const db = admin.firestore();
  const lockRef = db.collection('locks').doc(uid);
  const lockTimestamp = Date.now();

  try {
      const result = await db.runTransaction(async (transaction) => {
          const doc = await transaction.get(lockRef);
          if (doc.exists) {
              const existingLock = doc.data();
              if (existingLock && existingLock.timestamp > lockTimestamp - LOCK_TIMEOUT) {
                  return false; // Lock is held and not expired
              }
          }
          // Set the lock with the current timestamp
          transaction.set(lockRef, { timestamp: lockTimestamp });
          return true; // Lock acquired
      });

      return result; // This will be true if the lock was acquired, false otherwise
  } catch (error) {
      console.error('Failed to acquire lock:', error);
      return false;
  }
}

async function releaseLock(uid: string) {
  const db = admin.firestore();
  const lockRef = db.collection('locks').doc(uid);
  try {
      await lockRef.delete();
  } catch (error) {
      console.error('Failed to release lock:', error);
  }
}

export async function performLockedOperation(uid: string, operation: () => Promise<any>) {
  let lockAcquired = false;
  try {
      lockAcquired = await acquireLock(uid);
      if (!lockAcquired) {
          throw new Error('Failed to acquire lock. Resource is busy.');
      }
      return await operation();
  } finally {
      if (lockAcquired) {
          await releaseLock(uid);
      }
  }
}

export default admin;
