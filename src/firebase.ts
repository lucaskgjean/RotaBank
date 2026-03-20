import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const firestoreDatabaseId = (firebaseConfig as any).firestoreDatabaseId || "(default)";
console.log("Initializing Firebase with Project:", firebaseConfig.projectId, "Database:", firestoreDatabaseId);
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

export const db = getFirestore(app, firestoreDatabaseId);
export const auth = getAuth(app);
console.log("Firestore DB initialized. Project:", firebaseConfig.projectId, "Database ID:", firestoreDatabaseId);
