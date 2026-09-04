import {
  GoogleAuthProvider,
  GithubAuthProvider,
  onAuthStateChanged,
  signInWithCustomToken,
  signInWithEmailAndPassword,
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

interface AuthApiErrorPayload {
  error?: string;
  retryAfterSeconds?: number;
}

export type EmailOtpPurpose = "signup" | "reset";

export interface EmailOtpRequestResult {
  email: string;
  expiresInSeconds: number;
  resendCooldownSeconds: number;
}

interface EmailOtpVerifyResult {
  customToken: string;
  email: string;
  isNewUser: boolean;
}

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
      return "This security action has expired or has already been used. Please request a new one.";
    case "auth/account-exists-with-different-credential":
      return "An account already exists with this email using a different sign-in method. Try signing in with Google.";
    default:
      if (error instanceof Error && error.message) {
        return error.message;
      }
      return fallbackMessage;
  }
}

async function postAuthJson<T>(
  path: string,
  payload: Record<string, unknown>,
  fallbackMessage: string,
): Promise<T> {
  let response: Response;

  try {
    response = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error("Auth API request failed:", error);
    throw new Error("Could not reach secure email verification. Please try again.");
  }

  const data = (await response.json().catch(() => null)) as
    | AuthApiErrorPayload
    | T
    | null;

  if (!response.ok) {
    const message =
      data && typeof data === "object" && "error" in data && data.error
        ? data.error
        : fallbackMessage;
    throw new Error(message);
  }

  if (!data || typeof data !== "object") {
    throw new Error(fallbackMessage);
  }

  return data as T;
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

export async function requestEmailOtp(
  email: string,
  purpose: EmailOtpPurpose,
): Promise<EmailOtpRequestResult> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    throw new Error("Please provide a valid email address.");
  }

  if (!firebaseConfigReady) {
    throw new Error(
      `Firebase is missing required environment variables: ${firebaseConfigMissingKeys.join(", ")}.`,
    );
  }

  return postAuthJson<EmailOtpRequestResult>(
    "/api/auth/request-otp",
    { email: cleanEmail, purpose },
    "Could not send the verification code. Please try again.",
  );
}

async function signInWithVerifiedCustomToken(
  customToken: string,
  fallbackDisplayName: string | undefined,
  providerName: string,
): Promise<KnowledgeIdentity> {
  if (!customToken) {
    throw new Error("Secure verification did not return a sign-in token.");
  }

  if (!firebaseConfigReady) {
    throw new Error(
      `Firebase is missing required environment variables: ${firebaseConfigMissingKeys.join(", ")}.`,
    );
  }

  await authPersistenceReady;
  const result = await signInWithCustomToken(auth, customToken);
  return resolveUserIdentity(result.user, fallbackDisplayName, providerName);
}

export async function signUpWithEmailPasswordOtp(
  email: string,
  password: string,
  displayName: string | undefined,
  verificationCode: string,
): Promise<KnowledgeIdentity> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = displayName?.trim();
  const cleanCode = verificationCode.replace(/\D/g, "");
  const result = await postAuthJson<EmailOtpVerifyResult>(
    "/api/auth/verify-otp",
    {
      email: cleanEmail,
      code: cleanCode,
      purpose: "signup",
      password,
      displayName: cleanName,
    },
    "Could not verify this code. Please try again.",
  );

  return signInWithVerifiedCustomToken(
    result.customToken,
    cleanName,
    "email-password",
  );
}

export async function resetPasswordWithEmailOtp(
  email: string,
  verificationCode: string,
  newPassword: string,
): Promise<KnowledgeIdentity> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = verificationCode.replace(/\D/g, "");
  const result = await postAuthJson<EmailOtpVerifyResult>(
    "/api/auth/verify-otp",
    {
      email: cleanEmail,
      code: cleanCode,
      purpose: "reset",
      password: newPassword,
    },
    "Could not verify this reset code. Please try again.",
  );

  return signInWithVerifiedCustomToken(result.customToken, undefined, "password");
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
    if (result.user.email && !result.user.emailVerified) {
      await signOut(auth).catch(() => undefined);
      throw new Error(
        "This email is not verified yet. Use forgot password to verify your email and set a new password.",
      );
    }
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
  verificationCode?: string,
): Promise<KnowledgeIdentity> {
  if (!verificationCode) {
    throw new Error("Enter the 6-digit verification code sent to your email.");
  }

  return signUpWithEmailPasswordOtp(email, password, displayName, verificationCode);
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
