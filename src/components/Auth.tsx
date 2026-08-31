import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Award,
  Bookmark,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Highlighter,
  KeyRound,
  Lock,
  LogIn,
  Mail,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  User,
  UserPlus,
  UserRound,
  X,
} from "lucide-react";
import {
  clearEmailSignInUrl,
  completeSignInWithEmailLink,
  getSavedEmailForSignIn,
  isEmailSignInLink,
  sendPasswordReset,
  sendSignInEmailLink,
  signInWithEmailPassword,
  signInWithGithubAccount,
  signInWithGoogleAccount,
  signUpWithEmailPassword,
  type KnowledgeIdentity,
} from "../utils/auth";
import { firebaseAuthDomain } from "../firebase/firebaseConfig";

export type AuthModalTab = "magic-link" | "password";

export interface AuthModalProps {
  title?: string;
  description?: string;
  submitLabel?: string;
  defaultTab?: AuthModalTab;
  initialEmail?: string;
  onConfirm?: () => void | Promise<void>;
  onSuccess?: (identity: KnowledgeIdentity) => void | Promise<void>;
  onClose: () => void;
}

export function GoogleLogoSvg({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

export function GithubLogoSvg({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
      />
    </svg>
  );
}

const RESEND_COOLDOWN_SECONDS = 60;

export function AuthModal({
  title = "Welcome to Readative",
  description = "Join trusted readers and writers to share knowledge, save posts, and join conversations.",
  submitLabel = "Continue with Google",
  defaultTab = "magic-link",
  initialEmail = "",
  onConfirm,
  onSuccess,
  onClose,
}: AuthModalProps) {
  const dialogId = useId();
  const [activeTab, setActiveTab] = useState<AuthModalTab>(defaultTab);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [signingInProvider, setSigningInProvider] = useState<"google" | "github" | "magic-link" | "password" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showBenefits, setShowBenefits] = useState(false);

  // Email Magic Link State
  const [magicEmail, setMagicEmail] = useState(initialEmail);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [magicCountdown, setMagicCountdown] = useState(0);

  // Email/Password State
  const [isSignUp, setIsSignUp] = useState(false);
  const [passwordEmail, setPasswordEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  // Check if current page is returning from email magic link
  const [isPendingEmailConfirmation, setIsPendingEmailConfirmation] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");

  const emailInputRef = useRef<HTMLInputElement | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);

  const signInDomain = firebaseAuthDomain.replace(/^www\./, "");
  const usesProjectAuthHelper = signInDomain.endsWith(".firebaseapp.com");

  const benefits = useMemo(
    () => [
      {
        label: "Save Posts & Insights",
        detail: "Keep important knowledge accessible on all devices.",
        icon: Bookmark,
      },
      {
        label: "Highlight Reading Notes",
        detail: "Save key quotes into your personal Notebook.",
        icon: Highlighter,
      },
      {
        label: "Join SmartTalk & Discussions",
        detail: "Ask questions, give trusted answers, and reply.",
        icon: MessageCircle,
      },
      {
        label: "Build Trust Reputation",
        detail: "Earn badges and reputation for helpful contributions.",
        icon: Award,
      },
      {
        label: "Follow Trusted Voices",
        detail: "Stay connected with your favorite knowledge curators.",
        icon: UserRound,
      },
    ],
    [],
  );

  // Check on mount if this URL is an email sign-in link
  useEffect(() => {
    if (typeof window !== "undefined" && isEmailSignInLink(window.location.href)) {
      const savedEmail = getSavedEmailForSignIn();
      if (savedEmail) {
        setMagicEmail(savedEmail);
        setIsSigningIn(true);
        setSigningInProvider("magic-link");
        completeSignInWithEmailLink(savedEmail, window.location.href)
          .then((identity) => {
            clearEmailSignInUrl();
            void handleFinishSuccess(identity);
          })
          .catch((error) => {
            setIsSigningIn(false);
            setSigningInProvider(null);
            setErrorMessage(
              error instanceof Error ? error.message : "Could not complete sign in with this link.",
            );
          });
      } else {
        setIsPendingEmailConfirmation(true);
      }
    }
  }, []);

  // Handle ESC key press
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSigningIn) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSigningIn, onClose]);

  // Resend Countdown Timer
  useEffect(() => {
    if (magicCountdown > 0) {
      countdownIntervalRef.current = window.setInterval(() => {
        setMagicCountdown((prev) => {
          if (prev <= 1) {
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, [magicCountdown]);

  const handleFinishSuccess = async (identity?: KnowledgeIdentity) => {
    try {
      if (identity) {
        await onSuccess?.(identity);
      } else if (onConfirm) {
        await onConfirm();
      }
      onClose();
    } catch (error) {
      console.error("Post-sign-in handler error:", error);
      onClose();
    }
  };

  // 1. Google Sign-In
  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    setSigningInProvider("google");
    setErrorMessage(null);

    try {
      if (onConfirm) {
        await onConfirm();
        onClose();
      } else {
        const identity = await signInWithGoogleAccount();
        await handleFinishSuccess(identity);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Google sign-in could not finish right now.",
      );
      setIsSigningIn(false);
      setSigningInProvider(null);
    }
  };

  // 2. GitHub Sign-In
  const handleGithubSignIn = async () => {
    setIsSigningIn(true);
    setSigningInProvider("github");
    setErrorMessage(null);

    try {
      const identity = await signInWithGithubAccount();
      await handleFinishSuccess(identity);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "GitHub sign-in could not finish right now.",
      );
      setIsSigningIn(false);
      setSigningInProvider(null);
    }
  };

  // 3. Email Magic Link - Send Link
  const handleSendMagicLink = async (event: React.FormEvent) => {
    event.preventDefault();
    const email = magicEmail.trim();
    if (!email || !email.includes("@")) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    setIsSigningIn(true);
    setSigningInProvider("magic-link");
    setErrorMessage(null);

    try {
      await sendSignInEmailLink(email);
      setMagicLinkSent(true);
      setMagicCountdown(RESEND_COOLDOWN_SECONDS);
      setIsSigningIn(false);
      setSigningInProvider(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not send sign-in link. Please try again.",
      );
      setIsSigningIn(false);
      setSigningInProvider(null);
    }
  };

  // Complete Email Magic Link (different device confirmation)
  const handleConfirmMagicEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    const email = confirmEmail.trim();
    if (!email) {
      setErrorMessage("Please enter the email address where you received the sign-in link.");
      return;
    }

    setIsSigningIn(true);
    setSigningInProvider("magic-link");
    setErrorMessage(null);

    try {
      const identity = await completeSignInWithEmailLink(email, window.location.href);
      clearEmailSignInUrl();
      setIsPendingEmailConfirmation(false);
      await handleFinishSuccess(identity);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not complete sign-in. Please try again.",
      );
      setIsSigningIn(false);
      setSigningInProvider(null);
    }
  };

  // 4. Email + Password Sign In / Sign Up
  const handlePasswordAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    const email = passwordEmail.trim();
    if (!email || !email.includes("@")) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }
    if (!password) {
      setErrorMessage("Please enter your password.");
      return;
    }
    if (isSignUp && password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }

    setIsSigningIn(true);
    setSigningInProvider("password");
    setErrorMessage(null);

    try {
      let identity: KnowledgeIdentity;
      if (isSignUp) {
        identity = await signUpWithEmailPassword(email, password, displayName);
      } else {
        identity = await signInWithEmailPassword(email, password);
      }
      await handleFinishSuccess(identity);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Sign-in failed. Please check your credentials.",
      );
      setIsSigningIn(false);
      setSigningInProvider(null);
    }
  };

  // 5. Forgot Password Reset
  const handlePasswordReset = async (event: React.FormEvent) => {
    event.preventDefault();
    const email = passwordEmail.trim();
    if (!email || !email.includes("@")) {
      setErrorMessage("Please enter the email address linked to your account.");
      return;
    }

    setIsSigningIn(true);
    setErrorMessage(null);

    try {
      await sendPasswordReset(email);
      setResetSent(true);
      setResetMessage(`Password reset link sent to ${email}. Check your inbox.`);
      setIsSigningIn(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not send password reset email.",
      );
      setIsSigningIn(false);
    }
  };

  // Password strength helper
  const passwordStrength = useMemo(() => {
    if (!password) return 0;
    let score = 0;
    if (password.length >= 6) score += 1;
    if (password.length >= 10) score += 1;
    if (/[A-Z]/.test(password) && /[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    return score;
  }, [password]);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto overflow-x-hidden bg-slate-950/45 p-2 backdrop-blur-sm sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${dialogId}-title`}
        className="readative-dialog-surface relative flex max-h-[calc(100dvh-1rem)] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl transition-all sm:max-h-[calc(100dvh-2rem)]"
      >
        {/* Modal Header */}
        <div className="shrink-0 border-b border-slate-100 bg-slate-950 px-6 py-5 text-white">
          <button
            type="button"
            onClick={onClose}
            disabled={isSigningIn}
            className="absolute right-4 top-4 rounded-full p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
            aria-label="Close sign in dialog"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-2xl bg-emerald-500/15 p-2.5 text-emerald-400 ring-1 ring-emerald-500/30">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h2 id={`${dialogId}-title`} className="text-xl font-black tracking-tight sm:text-2xl">
                {title}
              </h2>
              <p className="mt-0.5 text-xs text-emerald-400 font-bold uppercase tracking-wider">
                Readative Secure Authentication
              </p>
            </div>
          </div>
          <p className="mt-2.5 text-xs leading-relaxed text-slate-300 sm:text-sm">
            {description}
          </p>
        </div>

        {/* Modal Body */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 sm:p-6">
          {/* Error Banner */}
          {errorMessage && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50/90 p-3.5 text-xs font-semibold leading-relaxed text-amber-900 shadow-sm sm:text-sm"
            >
              <span className="mt-0.5 text-amber-600">⚠️</span>
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          {/* Reset Sent Success Notice */}
          {resetSent && resetMessage && (
            <div
              role="status"
              className="mb-4 flex items-start gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-900 shadow-sm sm:text-sm"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <div className="flex-1">{resetMessage}</div>
            </div>
          )}

          {/* Pending Email Confirmation for Magic Link from another device */}
          {isPendingEmailConfirmation ? (
            <form onSubmit={handleConfirmMagicEmail} className="space-y-4">
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 text-center">
                <Mail className="mx-auto h-8 w-8 text-indigo-600" />
                <h3 className="mt-2 text-base font-bold text-slate-900">
                  Confirm your email to complete sign in
                </h3>
                <p className="mt-1 text-xs text-slate-600">
                  You opened a sign-in link in a new browser. Please enter your email address to confirm your identity.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Your Email
                </label>
                <div className="relative mt-1">
                  <Mail className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={confirmEmail}
                    onChange={(e) => setConfirmEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50/50 py-3 pl-10 pr-4 text-sm font-medium text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSigningIn}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white shadow-md transition hover:bg-emerald-800 disabled:opacity-50"
              >
                {isSigningIn ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Confirming Sign In...
                  </>
                ) : (
                  "Complete Sign In"
                )}
              </button>
            </form>
          ) : (
            <>
              {/* 1-Click Social Sign In Options */}
              <div className="space-y-2.5">
                {/* Google Sign In Button */}
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isSigningIn}
                  className="flex min-h-12 w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50/80 active:scale-[0.99] disabled:opacity-50"
                >
                  {signingInProvider === "google" ? (
                    <RefreshCw className="h-4 w-4 animate-spin text-emerald-600" />
                  ) : (
                    <GoogleLogoSvg className="h-5 w-5 shrink-0" />
                  )}
                  <span>
                    {signingInProvider === "google" ? "Connecting to Google..." : submitLabel}
                  </span>
                </button>

                {/* GitHub Developer Sign In Button */}
                <button
                  type="button"
                  onClick={handleGithubSignIn}
                  disabled={isSigningIn}
                  className="flex min-h-11 w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-slate-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-slate-800 active:scale-[0.99] disabled:opacity-50"
                >
                  {signingInProvider === "github" ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <GithubLogoSvg className="h-4 w-4 shrink-0 text-white" />
                  )}
                  <span>
                    {signingInProvider === "github" ? "Connecting to GitHub..." : "Continue with GitHub"}
                  </span>
                </button>
              </div>

              {/* Visual Divider */}
              <div className="relative my-5 flex items-center justify-center">
                <div className="w-full border-t border-slate-200" />
                <span className="absolute bg-white px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  or continue with email
                </span>
              </div>

              {/* Tab Switcher */}
              <div className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("magic-link");
                    setErrorMessage(null);
                  }}
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-all ${
                    activeTab === "magic-link"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Mail className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Passwordless Link</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("password");
                    setErrorMessage(null);
                  }}
                  className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-all ${
                    activeTab === "password"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Lock className="h-3.5 w-3.5 text-slate-600" />
                  <span>Password</span>
                </button>
              </div>

              {/* Tab 1: Magic Link (Passwordless OTP / Link) */}
              {activeTab === "magic-link" && (
                <div>
                  {magicLinkSent ? (
                    <div className="space-y-4 rounded-2xl border border-emerald-100 bg-emerald-50/50 p-5 text-center">
                      <div className="mx-auto inline-flex rounded-full bg-emerald-100 p-3 text-emerald-700">
                        <Mail className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="text-base font-black text-slate-900">Check your inbox!</h3>
                        <p className="mt-1 text-xs text-slate-600">
                          We sent a secure 1-click sign-in link to:
                        </p>
                        <p className="mt-0.5 font-bold text-emerald-800 break-all text-sm">{magicEmail}</p>
                      </div>

                      {/* Quick email app links */}
                      <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                        <a
                          href="https://mail.google.com"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
                        >
                          <GoogleLogoSvg className="h-3.5 w-3.5" />
                          Open Gmail
                        </a>
                        <a
                          href="https://outlook.live.com"
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
                        >
                          <Mail className="h-3.5 w-3.5 text-sky-600" />
                          Open Outlook
                        </a>
                      </div>

                      <div className="border-t border-emerald-100 pt-3">
                        {magicCountdown > 0 ? (
                          <p className="text-xs text-slate-500 font-medium">
                            Resend link in <span className="font-bold text-emerald-700">{magicCountdown}s</span>
                          </p>
                        ) : (
                          <div className="flex items-center justify-center gap-3">
                            <button
                              type="button"
                              onClick={handleSendMagicLink}
                              disabled={isSigningIn}
                              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:underline"
                            >
                              Resend Sign-in Link
                            </button>
                            <span className="text-slate-300">•</span>
                            <button
                              type="button"
                              onClick={() => {
                                setMagicLinkSent(false);
                                setErrorMessage(null);
                              }}
                              className="text-xs font-bold text-slate-500 hover:text-slate-800 hover:underline"
                            >
                              Use another email
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleSendMagicLink} className="space-y-3.5">
                      <div>
                        <label className="block text-xs font-bold text-slate-700">
                          Email Address
                        </label>
                        <div className="relative mt-1">
                          <Mail className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                          <input
                            ref={emailInputRef}
                            type="email"
                            required
                            value={magicEmail}
                            onChange={(e) => setMagicEmail(e.target.value)}
                            placeholder="name@example.com"
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-3 pl-10 pr-4 text-sm font-medium text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
                          />
                        </div>
                        <p className="mt-1.5 text-[11px] text-slate-500">
                          We will email you a password-free sign-in link. No password required.
                        </p>
                      </div>

                      <button
                        type="submit"
                        disabled={isSigningIn || !magicEmail}
                        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-50"
                      >
                        {signingInProvider === "magic-link" ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            Sending Sign-in Link...
                          </>
                        ) : (
                          <>
                            <Mail className="h-4 w-4" />
                            Send Sign-in Link
                          </>
                        )}
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* Tab 2: Email & Password */}
              {activeTab === "password" && (
                <div>
                  {isResetMode ? (
                    <form onSubmit={handlePasswordReset} className="space-y-3.5">
                      <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                          <KeyRound className="h-4 w-4 text-emerald-600" />
                          <span>Reset your password</span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">
                          Enter your account email to receive a password reset link.
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-700">
                          Account Email
                        </label>
                        <div className="relative mt-1">
                          <Mail className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                          <input
                            type="email"
                            required
                            value={passwordEmail}
                            onChange={(e) => setPasswordEmail(e.target.value)}
                            placeholder="name@example.com"
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-3 pl-10 pr-4 text-sm font-medium text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setIsResetMode(false);
                            setResetSent(false);
                            setResetMessage(null);
                            setErrorMessage(null);
                          }}
                          className="w-1/3 rounded-2xl border border-slate-200 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
                        >
                          Back
                        </button>
                        <button
                          type="submit"
                          disabled={isSigningIn || !passwordEmail}
                          className="flex-1 rounded-2xl bg-emerald-700 py-3 text-xs font-bold text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50"
                        >
                          {isSigningIn ? "Sending Reset Link..." : "Send Reset Link"}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <form onSubmit={handlePasswordAuth} className="space-y-3">
                      {isSignUp && (
                        <div>
                          <label className="block text-xs font-bold text-slate-700">
                            Your Name <span className="font-normal text-slate-400">(optional)</span>
                          </label>
                          <div className="relative mt-1">
                            <User className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                            <input
                              type="text"
                              value={displayName}
                              onChange={(e) => setDisplayName(e.target.value)}
                              placeholder="Alex Doe"
                              maxLength={50}
                              className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-2.5 pl-10 pr-4 text-sm font-medium text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
                            />
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-bold text-slate-700">
                          Email Address
                        </label>
                        <div className="relative mt-1">
                          <Mail className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                          <input
                            type="email"
                            required
                            value={passwordEmail}
                            onChange={(e) => setPasswordEmail(e.target.value)}
                            placeholder="name@example.com"
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-2.5 pl-10 pr-4 text-sm font-medium text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between">
                          <label className="block text-xs font-bold text-slate-700">
                            Password
                          </label>
                          {!isSignUp && (
                            <button
                              type="button"
                              onClick={() => {
                                setIsResetMode(true);
                                setErrorMessage(null);
                              }}
                              className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline"
                            >
                              Forgot password?
                            </button>
                          )}
                        </div>
                        <div className="relative mt-1">
                          <Lock className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                          <input
                            type={showPassword ? "text" : "password"}
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder={isSignUp ? "At least 6 characters" : "Enter your password"}
                            className="w-full rounded-2xl border border-slate-200 bg-slate-50/60 py-2.5 pl-10 pr-10 text-sm font-medium text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-3 rounded p-0.5 text-slate-400 hover:text-slate-600"
                            aria-label={showPassword ? "Hide password" : "Show password"}
                          >
                            {showPassword ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </button>
                        </div>

                        {/* Password strength meter on registration */}
                        {isSignUp && password && (
                          <div className="mt-2 flex items-center gap-1.5">
                            <div className="flex flex-1 gap-1">
                              {[1, 2, 3, 4].map((level) => (
                                <div
                                  key={level}
                                  className={`h-1 flex-1 rounded-full transition-all ${
                                    passwordStrength >= level
                                      ? passwordStrength <= 2
                                        ? "bg-amber-500"
                                        : "bg-emerald-500"
                                      : "bg-slate-200"
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="text-[10px] font-bold text-slate-400">
                              {passwordStrength <= 1
                                ? "Too short"
                                : passwordStrength === 2
                                ? "Fair"
                                : passwordStrength === 3
                                ? "Good"
                                : "Strong"}
                            </span>
                          </div>
                        )}
                      </div>

                      <button
                        type="submit"
                        disabled={isSigningIn || !passwordEmail || !password}
                        className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {signingInProvider === "password" ? (
                          <>
                            <RefreshCw className="h-4 w-4 animate-spin" />
                            {isSignUp ? "Creating Account..." : "Signing in..."}
                          </>
                        ) : (
                          <>
                            {isSignUp ? <UserPlus className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
                            {isSignUp ? "Create Readative Account" : "Sign In with Password"}
                          </>
                        )}
                      </button>

                      {/* Toggle Sign in vs Create Account */}
                      <div className="pt-2 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setIsSignUp(!isSignUp);
                            setErrorMessage(null);
                          }}
                          className="text-xs font-semibold text-slate-600 hover:text-emerald-700"
                        >
                          {isSignUp ? (
                            <>
                              Already have an account?{" "}
                              <span className="font-bold text-emerald-700 underline">Sign In</span>
                            </>
                          ) : (
                            <>
                              Don't have an account?{" "}
                              <span className="font-bold text-emerald-700 underline">Create one</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </>
          )}

          {/* Collapsible Benefits Drawer */}
          <div className="mt-5 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => setShowBenefits(!showBenefits)}
              className="flex w-full items-center justify-between py-1 text-xs font-bold text-slate-600 transition hover:text-emerald-700"
            >
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                Why create a Readative account?
              </span>
              {showBenefits ? (
                <ChevronUp className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              )}
            </button>

            {showBenefits && (
              <div className="mt-2.5 grid gap-2">
                {benefits.map((benefit) => {
                  const BenefitIcon = benefit.icon;
                  return (
                    <div
                      key={benefit.label}
                      className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs"
                    >
                      <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-emerald-700 shadow-xs">
                        <BenefitIcon className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0">
                        <span className="block font-bold text-slate-900">{benefit.label}</span>
                        <span className="block text-[11px] text-slate-500">{benefit.detail}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer / Legal & Security Notice */}
        <div className="shrink-0 border-t border-slate-100 bg-slate-50/90 px-6 py-3.5 text-center text-[11px] leading-relaxed text-slate-400">
          <span>
            {usesProjectAuthHelper
              ? "Protected by Firebase Auth."
              : `Secure authentication via ${signInDomain}.`}
          </span>{" "}
          <span>
            By continuing, you agree to Readative's{" "}
            <a href="/terms" className="font-bold text-slate-600 underline hover:text-emerald-700">
              Terms
            </a>{" "}
            and{" "}
            <a href="/privacy" className="font-bold text-slate-600 underline hover:text-emerald-700">
              Privacy Policy
            </a>
            .
          </span>
        </div>
      </div>
    </div>
  );
}

// Backwards-compatible alias for existing components
export const GoogleSignInPrompt = AuthModal;
