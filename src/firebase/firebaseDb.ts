import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";
import { firebaseApp } from "./firebaseApp";
import { firebaseClientDataEnabled } from "./costControls";

function createFirestore() {
  if (!firebaseApp || !firebaseClientDataEnabled) {
    return null;
  }

  try {
    return initializeFirestore(firebaseApp, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } catch {
    return getFirestore(firebaseApp);
  }
}

export const db = createFirestore() as Firestore;
