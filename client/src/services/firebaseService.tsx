import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';

import firebaseConfig from '@legion/shared/firebaseConfig';

// Initialize Firebase only if it hasn't been initialized yet
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const firebaseApp = firebase.app();
const firebaseAuth = firebase.auth();

if (process.env.PREACT_APP_USE_FIREBASE_EMULATOR === 'true') {
  // connectAuthEmulator(firebase.auth(), 'http://localhost:9099');
  firebaseAuth.useEmulator('http://localhost:9099');
}

export { firebaseApp, firebaseAuth };
