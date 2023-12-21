// firebaseConfig.ts
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';

const config = {
    apiKey: "AIzaSyCRlDX1DYaQpHcs0fZm05pmabuGVWeL8Es",
    authDomain: "127.0.0.1:9099", // "legion-32c6d.firebaseapp.com",
    projectId: "legion-32c6d",
    storageBucket: "legion-32c6d.appspot.com",
    messagingSenderId: "470800826393",
    appId: "1:470800826393:web:0c445c8499c0a0f26b2a88",
    measurementId: "G-FWZMZZ038Q"
};

firebase.initializeApp(config);

export default firebase;