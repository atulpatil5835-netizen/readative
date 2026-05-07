import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app"
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
  type Auth,
} from "firebase/auth"
import { getFirestore, type Firestore } from "firebase/firestore"

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

function hasUsableFirebaseApiKey() {
  const value = readFirebaseEnvValue("VITE_FIREBASE_API_KEY")
  return /^AIza[0-9A-Za-z_-]{20,}$/.test(value)
}

export const firebaseConfigMissingKeys = [
  hasFirebaseEnvValue("VITE_FIREBASE_API_KEY") && hasUsableFirebaseApiKey()
    ? null
    : "VITE_FIREBASE_API_KEY",
].filter((key): key is string => Boolean(key))

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

const app: FirebaseApp | null = firebaseConfigReady
  ? getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig)
  : null
const maybeDb = app ? getFirestore(app) : null
const maybeAuth = app ? getAuth(app) : null

export const db = maybeDb as Firestore
export const auth = maybeAuth as Auth
export const firebaseAuthDomain = firebaseConfig.authDomain

export const authPersistenceReady = maybeAuth
  ? setPersistence(maybeAuth, browserLocalPersistence).catch((error) => {
      console.error("Firebase auth persistence setup failed:", error)
    })
  : Promise.resolve()
