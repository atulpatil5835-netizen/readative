import { initializeApp } from "firebase/app"
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth"
import { getFirestore } from "firebase/firestore"

const firebaseConfig = {
  apiKey: "AIzaSyDgVfYlVr1N4GdW-CgamNBsXNMn1P4SqXo",
  authDomain: "readative-803b0.firebaseapp.com",
  projectId: "readative-803b0",
  storageBucket: "readative-803b0.firebasestorage.app",
  messagingSenderId: "1015140409360",
  appId: "1:1015140409360:web:198a83bd1d31eb424eea95",
  measurementId: "G-97DRT1B7SN"
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)

// Persist Firebase auth session across refreshes.
export const authPersistenceReady = setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error("Failed to set auth persistence:", error)
})
