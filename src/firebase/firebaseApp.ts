import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { firebaseConfig, firebaseConfigReady } from "./firebaseConfig";

export const firebaseApp: FirebaseApp | null = firebaseConfigReady
  ? getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;
