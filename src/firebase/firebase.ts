import { initializeApp } from "firebase/app"
import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
} from "firebase/auth"
import { getFirestore } from "firebase/firestore"

const firebaseConfig = {
  apiKey: "AIzaSyDgVfYlVr1N4GdW-CgamNBsXNMn1P4SqXo",
  authDomain: "readative-803b0.firebaseapp.com",
  projectId: "readative-803b0",
  storageBucket: "readative-803b0.firebasestorage.app",
  messagingSenderId: "1015140409360",
  appId: "1:1015140409360:web:198a83bd1d31eb424eea95",
  measurementId: "G-09CXBVC580"
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
