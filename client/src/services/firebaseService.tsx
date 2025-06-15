import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';

import firebaseConfig from '@legion/shared/firebaseConfig';
import { isElectron } from '../utils/electronUtils';

// Initialize Firebase only if it hasn't been initialized yet
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const firebaseApp = firebase.app();
const firebaseAuth = firebase.auth();

// Configure persistence for Electron environment
const configureFirebaseAuth = async () => {
  try {
    // Check if we're in Electron environment
    if (isElectron()) {
      // For Electron, try persistence types in order of preference
      const persistenceTypes = [
        firebase.auth.Auth.Persistence.LOCAL,
        firebase.auth.Auth.Persistence.SESSION,
        firebase.auth.Auth.Persistence.NONE
      ];
      
      for (const persistenceType of persistenceTypes) {
        try {
          await firebaseAuth.setPersistence(persistenceType);
          console.log(`Firebase Auth: Successfully set ${persistenceType} persistence in Electron`);
          break;
        } catch (error) {
          console.warn(`Firebase Auth: ${persistenceType} persistence not supported, trying next option`);
          continue;
        }
      }
    } else {
      // For regular web environment, use LOCAL persistence
      try {
        await firebaseAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
        console.log('Firebase Auth: Using LOCAL persistence in web environment');
      } catch (error) {
        console.warn('Firebase Auth: LOCAL persistence not supported in web environment, using default');
      }
    }
  } catch (error) {
    console.error('Error configuring Firebase Auth persistence:', error);
    // If all else fails, Firebase will use its default persistence
  }
};

// Configure persistence when auth is ready
configureFirebaseAuth();

if (process.env.USE_FIREBASE_EMULATOR == 'true') {
  console.log(`Using Firebase emulator at ${process.env.FIREBASE_AUTH_EMULATOR_HOST}`);
  firebaseAuth.useEmulator(process.env.FIREBASE_AUTH_EMULATOR_HOST);
}

export { firebaseApp, firebaseAuth };
