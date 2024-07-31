import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';

import firebaseConfig from '@legion/shared/firebaseConfig';

// Initialize Firebase only if it hasn't been initialized yet
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const firebaseApp = firebase.app();
const firebaseAuth = firebase.auth();

if (process.env.USE_FIREBASE_EMULATOR == 'true') {
  console.log(`Using Firebase emulator at ${process.env.FIREBASE_AUTH_EMULATOR_HOST}`);
  firebaseAuth.useEmulator(process.env.FIREBASE_AUTH_EMULATOR_HOST);
}

export { firebaseApp, firebaseAuth };
