import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

let app;
try {
  app = initializeApp(firebaseConfig);
} catch (error) {
  console.error("Firebase initialization failed. Check your firebase-applet-config.json", error);
  // Fallback to prevent crash, though app functionality will be limited
  app = initializeApp({
    apiKey: "dummy",
    authDomain: "dummy",
    projectId: "dummy",
    appId: "dummy"
  });
}

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
