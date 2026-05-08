import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app"
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
  type Auth,
} from "firebase/auth"
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore"

const FALLBACK_FIREBASE_CONFIG = {
  authDomain: "readative-803b0.firebaseapp.com",
  projectId: "readative-803b0",
  storageBucket: "readative-803b0.firebasestorage.app",
  messagingSenderId: "1015140409360",
  appId: "1:1015140409360:web:198a83bd1d31eb424eea95",
  measurementId: "G-09CXBVC580",
} as const

const BRANDED_AUTH_DOMAIN = "readative.com"

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

function normalizeAuthDomain(value: string) {
  return value
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .trim()
}

function isDefaultFirebaseAuthDomain(value: string) {
  const normalized = normalizeAuthDomain(value)
  return (
    normalized === FALLBACK_FIREBASE_CONFIG.authDomain ||
    normalized.endsWith(".firebaseapp.com")
  )
}

function isLocalAuthHost() {
  if (typeof window === "undefined") {
    return false
  }

  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)
}

function getProjectAuthDomain() {
  return normalizeAuthDomain(
    readFirebaseEnvValue(
      "VITE_FIREBASE_PROJECT_AUTH_DOMAIN",
      FALLBACK_FIREBASE_CONFIG.authDomain,
    ),
  )
}

function resolveFirebaseAuthDomain() {
  const configuredAuthDomain = normalizeAuthDomain(
    readFirebaseEnvValue("VITE_FIREBASE_AUTH_DOMAIN"),
  )
  const projectAuthDomain = getProjectAuthDomain()
  const brandedAuthDomain = normalizeAuthDomain(
    readFirebaseEnvValue("VITE_FIREBASE_BRANDED_AUTH_DOMAIN", BRANDED_AUTH_DOMAIN),
  )
  const forceProjectAuthDomain =
    readFirebaseEnvValue("VITE_FIREBASE_USE_PROJECT_AUTH_DOMAIN").toLowerCase() ===
    "true"
  const useBrandedAuthDomain =
    readFirebaseEnvValue("VITE_FIREBASE_USE_BRANDED_AUTH_DOMAIN").toLowerCase() ===
    "true"

  if (
    forceProjectAuthDomain ||
    !useBrandedAuthDomain ||
    isLocalAuthHost() ||
    import.meta.env.DEV
  ) {
    return projectAuthDomain || FALLBACK_FIREBASE_CONFIG.authDomain
  }

  if (!configuredAuthDomain || isDefaultFirebaseAuthDomain(configuredAuthDomain)) {
    return brandedAuthDomain || projectAuthDomain || FALLBACK_FIREBASE_CONFIG.authDomain
  }

  return configuredAuthDomain
}

export const firebaseConfigMissingKeys = [
  hasFirebaseEnvValue("VITE_FIREBASE_API_KEY") && hasUsableFirebaseApiKey()
    ? null
    : "VITE_FIREBASE_API_KEY",
].filter((key): key is string => Boolean(key))

export const firebaseConfigReady = firebaseConfigMissingKeys.length === 0

const firebaseConfig = {
  apiKey: readFirebaseEnvValue("VITE_FIREBASE_API_KEY"),
  authDomain: resolveFirebaseAuthDomain(),
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

function createFirestore(app: FirebaseApp) {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    })
  } catch {
    return getFirestore(app)
  }
}

const maybeDb = app ? createFirestore(app) : null
const maybeAuth = app ? getAuth(app) : null

export const db = maybeDb as Firestore
export const auth = maybeAuth as Auth
export const firebaseAuthDomain = firebaseConfig.authDomain

export const authPersistenceReady = maybeAuth
  ? setPersistence(maybeAuth, browserLocalPersistence).catch((error) => {
      console.error("Firebase auth persistence setup failed:", error)
    })
  : Promise.resolve()
