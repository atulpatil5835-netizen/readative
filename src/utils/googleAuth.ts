import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type AuthError,
} from "firebase/auth";
import { auth, authPersistenceReady } from "../firebase/firebase";
import { clearKnowledgeIdentity, type KnowledgeIdentity } from "./knowledgeIdentity";
import { ensureGoogleProfile } from "./userProfiles";

const provider = new GoogleAuthProvider();

function shouldFallbackToRedirect(error: unknown) {
  const code = (error as Partial<AuthError>)?.code;
  return (
    code === "auth/popup-blocked" ||
    code === "auth/operation-not-supported-in-this-environment" ||
    code === "auth/web-storage-unsupported"
  );
}

export function formatGoogleAuthError(error: unknown) {
  const code = (error as Partial<AuthError>)?.code;

  switch (code) {
    case "auth/account-exists-with-different-credential":
      return "This email already exists with another sign-in provider.";
    case "auth/operation-not-allowed":
      return "Google sign-in is not enabled in Firebase Auth yet.";
    case "auth/popup-closed-by-user":
      return "Google sign-in was closed before it finished.";
    case "auth/popup-blocked":
      return "Your browser blocked the Google sign-in popup.";
    default:
      return error instanceof Error
        ? error.message
        : "Could not sign in with Google right now.";
  }
}

export async function signInWithGoogleProfile(): Promise<KnowledgeIdentity | null> {
  await authPersistenceReady;
  auth.useDeviceLanguage();

  try {
    const result = await signInWithPopup(auth, provider);
    const profile = await ensureGoogleProfile(result.user);
    return {
      email: profile.email,
      displayName: profile.username,
      authorId: profile.id,
    };
  } catch (error) {
    if (shouldFallbackToRedirect(error)) {
      await signInWithRedirect(auth, provider);
      return null;
    }

    if ((error as Partial<AuthError>)?.code === "auth/popup-closed-by-user") {
      return null;
    }

    throw error;
  }
}

export async function signOutGoogleProfile() {
  await authPersistenceReady;
  await signOut(auth);
  clearKnowledgeIdentity();
}
