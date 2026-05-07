import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import {
  auth,
  authPersistenceReady,
  firebaseAuthDomain,
} from "../firebase/firebase";
import {
  clearKnowledgeIdentity,
  saveKnowledgeIdentity,
  type KnowledgeIdentity,
} from "./knowledgeIdentity";
import { ensureGoogleProfile } from "./userProfiles";

const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("email");
googleProvider.addScope("profile");
googleProvider.setCustomParameters({
  prompt: "select_account",
});

function getFirebaseAuthErrorMessage(error: unknown) {
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";

  if (code === "auth/popup-closed-by-user") {
    return "Google sign-in was closed before it finished.";
  }

  if (code === "auth/popup-blocked") {
    return "Your browser blocked the Google sign-in popup. Allow popups for this site and try again.";
  }

  if (code === "auth/unauthorized-domain") {
    const host =
      typeof window !== "undefined" ? window.location.hostname : "this domain";
    return `This site is not added to Firebase Auth authorized domains. Add ${host} for ${firebaseAuthDomain}.`;
  }

  if (code === "auth/network-request-failed") {
    return "Google sign-in could not reach Firebase. Check your connection and try again.";
  }

  return "Google sign-in could not finish right now. Please try again.";
}

export async function resolveGoogleUserIdentity(
  user: User,
): Promise<KnowledgeIdentity> {
  const profile = await ensureGoogleProfile(user);
  return saveKnowledgeIdentity(profile.username, profile.id);
}

export async function signInWithGoogleAccount(): Promise<KnowledgeIdentity> {
  try {
    void authPersistenceReady;
    const result = await signInWithPopup(auth, googleProvider);
    return resolveGoogleUserIdentity(result.user);
  } catch (error) {
    throw new Error(getFirebaseAuthErrorMessage(error));
  }
}

export function subscribeToGoogleIdentity(
  onChange: (identity: KnowledgeIdentity | null) => void,
  onError?: (message: string) => void,
) {
  return onAuthStateChanged(
    auth,
    (user) => {
      if (!user) {
        clearKnowledgeIdentity();
        onChange(null);
        return;
      }

      void resolveGoogleUserIdentity(user)
        .then(onChange)
        .catch((error) => {
          console.error("Failed to sync Google profile:", error);
          onError?.(
            error instanceof Error
              ? error.message
              : "Could not load your Google profile right now.",
          );
        });
    },
    (error) => {
      console.error("Firebase auth listener error:", error);
      onError?.(getFirebaseAuthErrorMessage(error));
    },
  );
}

export async function signOutGoogleAccount() {
  await signOut(auth);
  clearKnowledgeIdentity();
}
