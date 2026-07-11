import {
  browserLocalPersistence,
  getAuth,
  setPersistence,
  type Auth,
} from "firebase/auth";
import { firebaseApp } from "./firebaseApp";

const maybeAuth = firebaseApp ? getAuth(firebaseApp) : null;

export const auth = maybeAuth as Auth;

export const authPersistenceReady = maybeAuth
  ? setPersistence(maybeAuth, browserLocalPersistence)
  : Promise.resolve();
