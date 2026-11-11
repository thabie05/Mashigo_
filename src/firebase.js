// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: 'AIzaSyDQwvN8H9sNoaAqJ04l2L5UC1OJZL4ztwM',
  authDomain: 'b-mashilo.firebaseapp.com',
  projectId: 'b-mashilo',
  storageBucket: 'b-mashilo.firebasestorage.app',
  messagingSenderId: '830616006779',
  appId: '1:830616006779:web:5be7f76fa86cb2b42972de',
  measurementId: 'G-C519XEGV78',
};

const app = initializeApp(firebaseConfig);

// Analytics is optional and only loads in browsers that support it.
isSupported().then((supported) => {
  if (supported) getAnalytics(app);
});

// This is what every other file imports: `import { db } from '../firebase'`
export const db = getFirestore(app);
export default app;
