import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { auth, authPersistenceReady } from "../firebase/firebaseAuth";
import {
  firebaseConfigMissingKeys,
  firebaseConfigReady,
  firebaseAuthDomain,
} from "../firebase/firebaseConfig";
import {
  clearKnowledgeIdentity,
  saveKnowledgeIdentity,
  type KnowledgeIdentity,
} from "./knowledgeIdentity";

const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("email");
googleProvider.addScope("profile");
googleProvider.setCustomParameters({
  prompt: "select_account",
});

function collectErrorText(error: unknown, depth = 0, seen = new WeakSet<object>()): string {
  if (depth > 4 || error == null) {
    return "";
  }

  if (typeof error === "string") {
    return error;
  }

  if (typeof error === "number" || typeof error === "boolean") {
    return String(error);
  }

  if (typeof error !== "object") {
    return "";
  }

  if (seen.has(error)) {
    return "";
  }
  seen.add(error);

  const parts: string[] = [];
  if (error instanceof Error) {
    parts.push(error.name, error.message);
  }

  for (const key of Object.getOwnPropertyNames(error)) {
    try {
      parts.push(
        key,
        collectErrorText(
          (error as Record<string, unknown>)[key],
          depth + 1,
          seen,
        ),
      );
    } catch {
      // Ignore unreadable properties on Firebase's internal error objects.
    }
  }

  return parts.filter(Boolean).join(" ");
}

function getFirebaseAuthErrorMessage(error: unknown) {
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";
  const details = collectErrorText(error).toLowerCase();

  if (details.includes("firebase is missing required environment variables")) {
    return `Firebase is missing or has invalid environment variables: ${firebaseConfigMissingKeys.join(", ")}. Add valid values in your hosting environment and redeploy.`;
  }

  if (
    details.includes("api_key_service_blocked") ||
    (details.includes("identitytoolkit") && details.includes("blocked"))
  ) {
    return "Google sign-in is blocked by the Firebase API key settings. Allow the Identity Toolkit API for this web API key, then try again.";
  }

  if (code === "auth/popup-closed-by-user") {
    return "Google sign-in was closed before it finished.";
  }

  if (code === "auth/popup-blocked") {
    return "Your browser blocked the Google sign-in popup. Allow popups for this site and try again.";
  }

  if (code === "auth/unauthorized-domain") {
    const host =
      typeof window !== "undefined" ? window.location.hostname : "this domain";
    return `This site is not added to Firebase Auth authorized domains. Add ${host} and ${firebaseAuthDomain} in Firebase Authentication authorized domains, then try again.`;
  }

  if (code === "auth/operation-not-allowed") {
    return "Google sign-in is not enabled in Firebase Authentication. Enable the Google provider and try again.";
  }

  if (code === "auth/api-key-not-valid" || code === "auth/invalid-api-key") {
    return "The Firebase web API key is not valid for this app. Check the Firebase web app configuration.";
  }

  if (code === "auth/network-request-failed") {
    return "Google sign-in could not reach Firebase. Check your connection and try again.";
  }

  return "Google sign-in could not finish right now. Please try again.";
}

export async function resolveGoogleUserIdentity(
  user: User,
): Promise<KnowledgeIdentity> {
  const { ensureGoogleProfile } = await import("./userProfiles");
  const profile = await ensureGoogleProfile(user);
  return saveKnowledgeIdentity(profile.username, profile.id, profile.email);
}

export async function signInWithGoogleAccount(): Promise<KnowledgeIdentity> {
  try {
    if (!firebaseConfigReady) {
      throw new Error(
        `Firebase is missing required environment variables: ${firebaseConfigMissingKeys.join(", ")}.`,
      );
    }

    await authPersistenceReady;
    const result = await signInWithPopup(auth, googleProvider);
    return resolveGoogleUserIdentity(result.user);
  } catch (error) {
    console.error("Google sign-in failed:", error);
    throw new Error(getFirebaseAuthErrorMessage(error));
  }
}

export function subscribeToGoogleIdentity(
  onChange: (identity: KnowledgeIdentity | null) => void,
  onError?: (message: string) => void,
) {
  if (!firebaseConfigReady) {
    clearKnowledgeIdentity();
    onChange(null);
    onError?.(
      `Firebase is missing or has invalid environment variables: ${firebaseConfigMissingKeys.join(", ")}.`,
    );
    return () => undefined;
  }

  let cancelled = false;
  let unsubscribe = () => undefined;

  void authPersistenceReady
    .then(() => {
      if (cancelled) return;
      unsubscribe = onAuthStateChanged(
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
    })
    .catch((error) => {
      console.error("Firebase auth persistence setup failed:", error);
      if (!cancelled) {
        onError?.("Could not restore your sign-in session in this browser.");
      }
    });

  return () => {
    cancelled = true;
    unsubscribe();
  };
}

export async function signOutGoogleAccount() {
  if (firebaseConfigReady) {
    await signOut(auth);
  }
  clearKnowledgeIdentity();
}
