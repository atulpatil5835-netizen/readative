import { initializeApp } from "firebase/app"
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
} from "firebase/auth"
import { getFirestore } from "firebase/firestore"

function getFirebaseEnvValue(key: string) {
  const value = import.meta.env[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing Firebase environment variable: ${key}`);
  }

  return value;
}

const firebaseConfig = {
  apiKey: getFirebaseEnvValue("VITE_FIREBASE_API_KEY"),
  authDomain: getFirebaseEnvValue("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: getFirebaseEnvValue("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: getFirebaseEnvValue("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: getFirebaseEnvValue("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: getFirebaseEnvValue("VITE_FIREBASE_APP_ID"),
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || undefined,
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const auth = getAuth(app)
export const firebaseAuthDomain = firebaseConfig.authDomain

export const authPersistenceReady = setPersistence(
  auth,
  browserLocalPersistence,
).catch((error) => {
  console.error("Firebase auth persistence setup failed:", error)
})
