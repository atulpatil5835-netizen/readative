import {
  GoogleAuthProvider,
  GithubAuthProvider,
  createUserWithEmailAndPassword,
  isSignInWithEmailLink as firebaseIsSignInWithEmailLink,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendSignInLinkToEmail,
  signInWithEmailAndPassword,
  signInWithEmailLink,
  signInWithPopup,
  signOut,
  updateProfile,
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

const EMAIL_FOR_SIGN_IN_KEY = "readativeEmailForSignIn";
const EMAIL_SIGN_IN_QUERY_PARAMS = [
  "apiKey",
  "continueUrl",
  "lang",
  "mode",
  "oobCode",
  "tenantId",
];

const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("email");
googleProvider.addScope("profile");
googleProvider.setCustomParameters({
  prompt: "select_account",
});

const githubProvider = new GithubAuthProvider();
githubProvider.addScope("read:user");
githubProvider.addScope("user:email");

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

export function getAuthErrorMessage(error: unknown, fallbackMessage = "Authentication failed. Please try again."): string {
  const code =
    typeof error === "object" && error && "code" in error
      ? String((error as { code?: unknown }).code)
      : "";
  const details = collectErrorText(error).toLowerCase();

  if (details.includes("firebase is missing required environment variables")) {
    return `Firebase is missing or has invalid environment variables: ${firebaseConfigMissingKeys.join(", ")}.`;
  }

  if (
    details.includes("api_key_service_blocked") ||
    (details.includes("identitytoolkit") && details.includes("blocked"))
  ) {
    return "Sign-in is blocked by the Firebase API key settings. Allow Identity Toolkit API in Google Cloud Console.";
  }

  switch (code) {
    case "auth/popup-closed-by-user":
      return "Sign-in window was closed before completing.";
    case "auth/popup-blocked":
      return "Your browser blocked the sign-in popup. Allow popups for this site and try again.";
    case "auth/unauthorized-domain": {
      const host = typeof window !== "undefined" ? window.location.hostname : "this domain";
      return `This domain (${host}) is not in Firebase authorized domains. Add ${host} and ${firebaseAuthDomain} in Firebase Console.`;
    }
    case "auth/operation-not-allowed":
      return "This sign-in provider is not enabled in Firebase Authentication Console. Enable it under Sign-in method tab.";
    case "auth/api-key-not-valid":
    case "auth/invalid-api-key":
      return "The Firebase web API key is not valid for this app.";
    case "auth/network-request-failed":
      return "Could not reach authentication servers. Please check your internet connection.";
    case "auth/user-not-found":
      return "No account found with this email address. Please create an account or use Google Sign-in.";
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password. Please try again or reset your password.";
    case "auth/email-already-in-use":
      return "An account with this email already exists. Please sign in or reset your password.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/weak-password":
      return "Password should be at least 6 characters long.";
    case "auth/too-many-requests":
      return "Access temporarily disabled due to multiple failed attempts. Please try again in a few minutes or reset your password.";
    case "auth/invalid-action-code":
    case "auth/expired-action-code":
      return "This sign-in or reset link has expired or has already been used. Please request a new one.";
    case "auth/account-exists-with-different-credential":
      return "An account already exists with this email using a different sign-in method. Try signing in with Google.";
    default:
      if (error instanceof Error && error.message) {
        return error.message;
      }
      return fallbackMessage;
  }
}

export async function resolveUserIdentity(
  user: User,
  fallbackDisplayName?: string,
  providerName?: string,
): Promise<KnowledgeIdentity> {
  const { ensureUserProfile } = await import("./userProfiles");
  const profile = await ensureUserProfile(user, fallbackDisplayName, providerName);
  return saveKnowledgeIdentity(profile.username, profile.id, profile.email);
}

export async function resolveGoogleUserIdentity(user: User): Promise<KnowledgeIdentity> {
  return resolveUserIdentity(user, undefined, "google");
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
    return resolveUserIdentity(result.user, undefined, "google");
  } catch (error) {
    console.error("Google sign-in failed:", error);
    throw new Error(getAuthErrorMessage(error, "Google sign-in could not finish right now."));
  }
}

export async function signInWithGithubAccount(): Promise<KnowledgeIdentity> {
  try {
    if (!firebaseConfigReady) {
      throw new Error(
        `Firebase is missing required environment variables: ${firebaseConfigMissingKeys.join(", ")}.`,
      );
    }

    await authPersistenceReady;
    const result = await signInWithPopup(auth, githubProvider);
    return resolveUserIdentity(result.user, undefined, "github");
  } catch (error) {
    console.error("GitHub sign-in failed:", error);
    throw new Error(getAuthErrorMessage(error, "GitHub sign-in could not finish right now."));
  }
}

export async function sendSignInEmailLink(email: string): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    throw new Error("Please provide a valid email address.");
  }

  if (!firebaseConfigReady) {
    throw new Error(
      `Firebase is missing required environment variables: ${firebaseConfigMissingKeys.join(", ")}.`,
    );
  }

  const actionCodeSettings = {
    url: typeof window !== "undefined" ? window.location.href.split("?")[0] : "https://readative.com",
    handleCodeInApp: true,
  };

  try {
    await authPersistenceReady;
    await sendSignInLinkToEmail(auth, cleanEmail, actionCodeSettings);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(EMAIL_FOR_SIGN_IN_KEY, cleanEmail);
    }
  } catch (error) {
    console.error("Failed to send sign-in link:", error);
    throw new Error(getAuthErrorMessage(error, "Could not send sign-in link. Please verify your email and try again."));
  }
}

export function isEmailSignInLink(href?: string): boolean {
  if (!auth) return false;
  const targetUrl = href || (typeof window !== "undefined" ? window.location.href : "");
  if (!targetUrl) return false;
  return firebaseIsSignInWithEmailLink(auth, targetUrl);
}

export function getSavedEmailForSignIn(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(EMAIL_FOR_SIGN_IN_KEY) || null;
}

export function clearSavedEmailForSignIn(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(EMAIL_FOR_SIGN_IN_KEY);
}

export function clearEmailSignInUrl(href?: string): void {
  if (typeof window === "undefined") return;

  const currentUrl = new URL(href || window.location.href, window.location.origin);
  EMAIL_SIGN_IN_QUERY_PARAMS.forEach((param) => {
    currentUrl.searchParams.delete(param);
  });

  const nextSearch = currentUrl.searchParams.toString();
  const nextPath = `${currentUrl.pathname}${nextSearch ? `?${nextSearch}` : ""}${currentUrl.hash}`;
  window.history.replaceState({}, document.title, nextPath || "/");
}

export async function completeSignInWithEmailLink(
  email: string,
  href?: string,
): Promise<KnowledgeIdentity> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) {
    throw new Error("Please provide your email address to complete sign in.");
  }

  const targetUrl = href || (typeof window !== "undefined" ? window.location.href : "");
  if (!isEmailSignInLink(targetUrl)) {
    throw new Error("The provided sign-in link is invalid or expired.");
  }

  try {
    await authPersistenceReady;
    const result = await signInWithEmailLink(auth, cleanEmail, targetUrl);
    clearSavedEmailForSignIn();
    return resolveUserIdentity(result.user, undefined, "email-link");
  } catch (error) {
    console.error("Complete email link sign-in failed:", error);
    throw new Error(getAuthErrorMessage(error, "Could not complete sign in with this link."));
  }
}

export async function signInWithEmailPassword(
  email: string,
  password: string,
): Promise<KnowledgeIdentity> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    throw new Error("Please provide a valid email address.");
  }
  if (!password) {
    throw new Error("Please enter your password.");
  }

  try {
    if (!firebaseConfigReady) {
      throw new Error(
        `Firebase is missing required environment variables: ${firebaseConfigMissingKeys.join(", ")}.`,
      );
    }

    await authPersistenceReady;
    const result = await signInWithEmailAndPassword(auth, cleanEmail, password);
    return resolveUserIdentity(result.user, undefined, "password");
  } catch (error) {
    console.error("Email password sign-in failed:", error);
    throw new Error(getAuthErrorMessage(error, "Incorrect email or password."));
  }
}

export async function signUpWithEmailPassword(
  email: string,
  password: string,
  displayName?: string,
): Promise<KnowledgeIdentity> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    throw new Error("Please provide a valid email address.");
  }
  if (!password || password.length < 6) {
    throw new Error("Password must be at least 6 characters long.");
  }

  try {
    if (!firebaseConfigReady) {
      throw new Error(
        `Firebase is missing required environment variables: ${firebaseConfigMissingKeys.join(", ")}.`,
      );
    }

    await authPersistenceReady;
    const result = await createUserWithEmailAndPassword(auth, cleanEmail, password);
    const cleanName = displayName?.trim();
    if (cleanName) {
      try {
        await updateProfile(result.user, { displayName: cleanName });
      } catch {
        // Continue even if auth profile update fails; ensureUserProfile will save displayName
      }
    }
    return resolveUserIdentity(result.user, cleanName, "password");
  } catch (error) {
    console.error("Email password registration failed:", error);
    throw new Error(getAuthErrorMessage(error, "Could not create account with this email."));
  }
}

export async function sendPasswordReset(email: string): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    throw new Error("Please enter a valid email address.");
  }

  try {
    if (!firebaseConfigReady) {
      throw new Error(
        `Firebase is missing required environment variables: ${firebaseConfigMissingKeys.join(", ")}.`,
      );
    }

    await authPersistenceReady;
    await sendPasswordResetEmail(auth, cleanEmail);
  } catch (error) {
    console.error("Password reset email failed:", error);
    throw new Error(getAuthErrorMessage(error, "Could not send password reset email."));
  }
}

export function subscribeToAuthIdentity(
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

          void resolveUserIdentity(user)
            .then(onChange)
            .catch((error) => {
              console.error("Failed to sync user profile:", error);
              onError?.(
                error instanceof Error
                  ? error.message
                  : "Could not load your profile right now.",
              );
            });
        },
        (error) => {
          console.error("Firebase auth listener error:", error);
          onError?.(getAuthErrorMessage(error));
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

export const subscribeToGoogleIdentity = subscribeToAuthIdentity;

export async function signOutAccount(): Promise<void> {
  if (firebaseConfigReady && auth) {
    await signOut(auth);
  }
  clearKnowledgeIdentity();
}

export const signOutGoogleAccount = signOutAccount;
