import { getApp, getApps, initializeApp } from "firebase/app"
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
} from "firebase/auth"
import { getFirestore } from "firebase/firestore"

const FALLBACK_FIREBASE_CONFIG = {
  authDomain: "readative-803b0.firebaseapp.com",
  projectId: "readative-803b0",
  storageBucket: "readative-803b0.firebasestorage.app",
  messagingSenderId: "1015140409360",
  appId: "1:1015140409360:web:198a83bd1d31eb424eea95",
  measurementId: "G-09CXBVC580",
} as const

function readFirebaseEnvValue(key: string, fallback = "") {
  const value = import.meta.env[key]
  return typeof value === "string" && value.trim() ? value.trim() : fallback
}

function hasFirebaseEnvValue(key: string) {
  const value = import.meta.env[key]
  return typeof value === "string" && Boolean(value.trim())
}

export const firebaseConfigMissingKeys = [
  "VITE_FIREBASE_API_KEY",
].filter((key) => !hasFirebaseEnvValue(key))

export const firebaseConfigReady = firebaseConfigMissingKeys.length === 0

const firebaseConfig = {
  apiKey: readFirebaseEnvValue("VITE_FIREBASE_API_KEY"),
  authDomain: readFirebaseEnvValue(
    "VITE_FIREBASE_AUTH_DOMAIN",
    FALLBACK_FIREBASE_CONFIG.authDomain,
  ),
  projectId: readFirebaseEnvValue(
    "VITE_FIREBASE_PROJECT_ID",
    FALLBACK_FIREBASE_CONFIG.projectId,
  ),
  storageBucket: readFirebaseEnvValue(
    "VITE_FIREBASE_STORAGE_BUCKET",
    FALLBACK_FIREBASE_CONFIG.storageBucket,
  ),
  messagingSenderId: readFirebaseEnvValue(
    "VITE_FIREBASE_MESSAGING_SENDER_ID",
    FALLBACK_FIREBASE_CONFIG.messagingSenderId,
  ),
  appId: readFirebaseEnvValue(
    "VITE_FIREBASE_APP_ID",
    FALLBACK_FIREBASE_CONFIG.appId,
  ),
  measurementId: readFirebaseEnvValue(
    "VITE_FIREBASE_MEASUREMENT_ID",
    FALLBACK_FIREBASE_CONFIG.measurementId,
  ),
}

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)
export const db = getFirestore(app)
export const auth = getAuth(app)
export const firebaseAuthDomain = firebaseConfig.authDomain

export const authPersistenceReady = setPersistence(
  auth,
  browserLocalPersistence,
).catch((error) => {
  console.error("Firebase auth persistence setup failed:", error)
})
