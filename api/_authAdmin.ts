import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

const DEFAULT_PROJECT_ID = "readative-803b0";

function readEnv(name: string) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function assertServerFirestoreDataEnabled() {
  if (readEnv("READATIVE_FIRESTORE_DATA_ENABLED").toLowerCase() !== "true") {
    throw new Error(
      "Firebase Admin Firestore access is disabled by READATIVE_FIRESTORE_DATA_ENABLED.",
    );
  }
}

export function getFirebaseAdminProjectId() {
  return (
    readEnv("FIREBASE_PROJECT_ID") ||
    readEnv("VITE_FIREBASE_PROJECT_ID") ||
    DEFAULT_PROJECT_ID
  );
}

function getFirebaseAdminApp(): App {
  const existingApp = getApps()[0];
  if (existingApp) return existingApp;

  const projectId = getFirebaseAdminProjectId();
  const clientEmail = readEnv("FIREBASE_CLIENT_EMAIL");
  const privateKey = readEnv("FIREBASE_PRIVATE_KEY").replace(/\\n/g, "\n");

  if (!clientEmail || !privateKey) {
    throw new Error(
      "Firebase Admin credentials are not configured. Set FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.",
    );
  }

  return initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

export function getFirebaseAdminAuth(): Auth {
  return getAuth(getFirebaseAdminApp());
}

export function getFirebaseAdminDb(): Firestore {
  assertServerFirestoreDataEnabled();
  return getFirestore(getFirebaseAdminApp());
}

export function getFirebaseAdminTechNewsDb(): Firestore {
  if (readEnv("READATIVE_TECH_NEWS_ENABLED").toLowerCase() !== "true") {
    throw new Error("Tech News publishing is disabled.");
  }
  return getFirestore(getFirebaseAdminApp());
}
