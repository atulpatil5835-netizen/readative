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
  requestEmailOtp,
  resetPasswordWithEmailOtp,
  signInWithEmailPassword,
  signInWithGithubAccount,
  signInWithGoogleAccount,
  signUpWithEmailPasswordOtp,
} from "../utils/auth";
import { firebaseAuthDomain } from "../firebase/firebaseConfig";
import type { KnowledgeIdentity } from "../utils/knowledgeIdentity";

export type AuthModalTab = "signin" | "signup";

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

type SigningProvider =
  | "google"
  | "github"
  | "password"
  | "signup-code"
  | "reset-code"
  | "reset-password"
  | null;

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

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;
const MIN_PASSWORD_LENGTH = 8;

function normalizeCodeInput(value: string) {
  return value.replace(/\D/g, "").slice(0, OTP_LENGTH);
}

function getPasswordChecklist(password: string) {
  return {
    hasLength: password.length >= MIN_PASSWORD_LENGTH,
    hasLetter: /[A-Za-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[^A-Za-z0-9]/.test(password),
  };
}

function passwordMeetsMinimum(password: string) {
  const checklist = getPasswordChecklist(password);
  return checklist.hasLength && checklist.hasLetter && checklist.hasNumber;
}

type OtpInputBoxesProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  helperText?: string;
  autoFocus?: boolean;
  className?: string;
};

function OtpInputBoxes({
  id,
  label,
  value,
  onChange,
  disabled = false,
  helperText,
  autoFocus = false,
  className = "",
}: OtpInputBoxesProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const digits = Array.from({ length: OTP_LENGTH }, (_, index) => value[index] || "");
  const activeIndex = Math.min(value.length, OTP_LENGTH - 1);

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-xs font-black uppercase tracking-[0.12em] text-slate-600">
          {label}
        </label>
        <span className="text-[10px] font-black text-slate-400">
          {value.length}/{OTP_LENGTH}
        </span>
      </div>
      <div
        className="relative mt-2"
        onClick={() => inputRef.current?.focus()}
      >
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="one-time-code"
          value={value}
          onChange={(event) => onChange(normalizeCodeInput(event.target.value))}
          onPaste={(event) => {
            event.preventDefault();
            onChange(normalizeCodeInput(event.clipboardData.getData("text")));
          }}
          maxLength={OTP_LENGTH}
          disabled={disabled}
          autoFocus={autoFocus}
          aria-label={label}
          className="absolute inset-0 z-10 h-full w-full cursor-text rounded-2xl bg-transparent text-transparent caret-transparent outline-none disabled:cursor-not-allowed"
        />
        <div className="grid grid-cols-6 gap-2" aria-hidden="true">
          {digits.map((digit, index) => {
            const isActive = index === activeIndex && !disabled;
            return (
              <span
                key={`${id}-${index}`}
                className={`flex h-11 items-center justify-center rounded-2xl border text-lg font-black tabular-nums transition-all sm:h-12 ${
                  digit
                    ? "border-emerald-500 bg-white text-slate-950 shadow-sm"
                    : "border-slate-200 bg-slate-50 text-slate-300"
                } ${isActive ? "ring-2 ring-emerald-500/25" : ""} ${
                  disabled ? "opacity-60" : ""
                }`}
              >
                {digit || <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />}
              </span>
            );
          })}
        </div>
      </div>
      {helperText && (
        <p className="mt-2 text-[11px] font-semibold leading-relaxed text-slate-500">
          {helperText}
        </p>
      )}
    </div>
  );
}

export function AuthModal({
  title = "Welcome to Readative",
  description = "Join trusted readers and writers to share knowledge, save posts, and join conversations.",
  submitLabel = "Continue with Google",
  defaultTab = "signin",
  initialEmail = "",
  onConfirm,
  onSuccess,
  onClose,
}: AuthModalProps) {
  const dialogId = useId();
  const [activeTab, setActiveTab] = useState<AuthModalTab>(defaultTab);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [signingInProvider, setSigningInProvider] = useState<SigningProvider>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showBenefits, setShowBenefits] = useState(false);

  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [signUpCodeSent, setSignUpCodeSent] = useState(false);
  const [signUpCode, setSignUpCode] = useState("");
  const [signUpMaskedEmail, setSignUpMaskedEmail] = useState("");
  const [signUpCountdown, setSignUpCountdown] = useState(0);

  const [isResetMode, setIsResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState(initialEmail);
  const [resetCodeSent, setResetCodeSent] = useState(false);
  const [resetCode, setResetCode] = useState("");
  const [resetMaskedEmail, setResetMaskedEmail] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetCountdown, setResetCountdown] = useState(0);

  const signInDomain = firebaseAuthDomain.replace(/^www\./, "");
  const usesProjectAuthHelper = signInDomain.endsWith(".firebaseapp.com");
  const passwordChecklist = useMemo(() => getPasswordChecklist(password), [password]);
  const resetPasswordChecklist = useMemo(
    () => getPasswordChecklist(resetPassword),
    [resetPassword],
  );
  const isSignupPasswordReady = passwordMeetsMinimum(password);
  const isResetPasswordReady = passwordMeetsMinimum(resetPassword);
  const passwordStrength = useMemo(() => {
    if (!password) return 0;
    return [
      passwordChecklist.hasLength,
      password.length >= 12,
      passwordChecklist.hasLetter && passwordChecklist.hasNumber,
      passwordChecklist.hasSpecial,
    ].filter(Boolean).length;
  }, [password, passwordChecklist]);
  const resetPasswordStrength = useMemo(() => {
    if (!resetPassword) return 0;
    return [
      resetPasswordChecklist.hasLength,
      resetPassword.length >= 12,
      resetPasswordChecklist.hasLetter && resetPasswordChecklist.hasNumber,
      resetPasswordChecklist.hasSpecial,
    ].filter(Boolean).length;
  }, [resetPassword, resetPasswordChecklist]);

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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSigningIn) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSigningIn, onClose]);

  useEffect(() => {
    if (signUpCountdown <= 0 && resetCountdown <= 0) return;

    const intervalId = window.setInterval(() => {
      setSignUpCountdown((current) => Math.max(0, current - 1));
      setResetCountdown((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [signUpCountdown, resetCountdown]);

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

  const clearMessages = () => {
    setErrorMessage(null);
    setStatusMessage(null);
  };

  const resetSignUpVerification = () => {
    setSignUpCodeSent(false);
    setSignUpCode("");
    setSignUpMaskedEmail("");
    setSignUpCountdown(0);
  };

  const resetPasswordVerification = () => {
    setResetCodeSent(false);
    setResetCode("");
    setResetMaskedEmail("");
    setResetPassword("");
    setResetPasswordConfirm("");
    setResetCountdown(0);
  };

  const switchTab = (tab: AuthModalTab) => {
    setActiveTab(tab);
    setIsResetMode(false);
    clearMessages();
  };

  const handleEmailChange = (nextEmail: string) => {
    setEmail(nextEmail);
    if (signUpCodeSent) resetSignUpVerification();
  };

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    setSigningInProvider("google");
    clearMessages();

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

  const handleGithubSignIn = async () => {
    setIsSigningIn(true);
    setSigningInProvider("github");
    clearMessages();

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

  const requestSignUpCode = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }
    if (!isSignupPasswordReady) {
      setErrorMessage("Use at least 8 characters with a letter and a number.");
      return;
    }

    setIsSigningIn(true);
    setSigningInProvider("signup-code");
    clearMessages();

    try {
      const result = await requestEmailOtp(cleanEmail, "signup");
      setSignUpCode("");
      setSignUpCodeSent(true);
      setSignUpMaskedEmail(result.email);
      setSignUpCountdown(result.resendCooldownSeconds || RESEND_COOLDOWN_SECONDS);
      setStatusMessage("Verification code sent. Enter it below to create your account.");
      setIsSigningIn(false);
      setSigningInProvider(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not send the verification code.",
      );
      setIsSigningIn(false);
      setSigningInProvider(null);
    }
  };

  const handleSignIn = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanEmail = email.trim();

    if (!cleanEmail || !cleanEmail.includes("@")) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }
    if (!password) {
      setErrorMessage("Please enter your password.");
      return;
    }

    setIsSigningIn(true);
    setSigningInProvider("password");
    clearMessages();

    try {
      const identity = await signInWithEmailPassword(cleanEmail, password);
      await handleFinishSuccess(identity);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Sign-in failed. Please check your credentials.",
      );
      setIsSigningIn(false);
      setSigningInProvider(null);
    }
  };

  const handleCreateAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanEmail = email.trim();
    const cleanCode = normalizeCodeInput(signUpCode);

    if (!cleanEmail || !cleanEmail.includes("@")) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }
    if (!isSignupPasswordReady) {
      setErrorMessage("Use at least 8 characters with a letter and a number.");
      return;
    }
    if (!signUpCodeSent) {
      await requestSignUpCode();
      return;
    }
    if (cleanCode.length !== OTP_LENGTH) {
      setErrorMessage("Enter the 6-digit verification code sent to your email.");
      return;
    }

    setIsSigningIn(true);
    setSigningInProvider("password");
    clearMessages();

    try {
      const identity = await signUpWithEmailPasswordOtp(
        cleanEmail,
        password,
        displayName,
        cleanCode,
      );
      await handleFinishSuccess(identity);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not create account with this email.",
      );
      setIsSigningIn(false);
      setSigningInProvider(null);
    }
  };

  const handleStartReset = () => {
    setResetEmail(email.trim());
    setIsResetMode(true);
    setActiveTab("signin");
    clearMessages();
  };

  const handleRequestResetCode = async (event: React.SyntheticEvent) => {
    event.preventDefault();
    const cleanEmail = resetEmail.trim();

    if (!cleanEmail || !cleanEmail.includes("@")) {
      setErrorMessage("Please enter the email address linked to your account.");
      return;
    }

    setIsSigningIn(true);
    setSigningInProvider("reset-code");
    clearMessages();

    try {
      const result = await requestEmailOtp(cleanEmail, "reset");
      setResetCode("");
      setResetCodeSent(true);
      setResetMaskedEmail(result.email);
      setResetCountdown(result.resendCooldownSeconds || RESEND_COOLDOWN_SECONDS);
      setStatusMessage(
        "If this email has a Readative account, a verification code has been sent.",
      );
      setIsSigningIn(false);
      setSigningInProvider(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not send the verification code.",
      );
      setIsSigningIn(false);
      setSigningInProvider(null);
    }
  };

  const handleVerifyPasswordReset = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleanEmail = resetEmail.trim();
    const cleanCode = normalizeCodeInput(resetCode);

    if (!cleanEmail || !cleanEmail.includes("@")) {
      setErrorMessage("Please enter the email address linked to your account.");
      return;
    }
    if (cleanCode.length !== OTP_LENGTH) {
      setErrorMessage("Enter the 6-digit reset code sent to your email.");
      return;
    }
    if (!isResetPasswordReady) {
      setErrorMessage("Use at least 8 characters with a letter and a number.");
      return;
    }
    if (resetPassword !== resetPasswordConfirm) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsSigningIn(true);
    setSigningInProvider("reset-password");
    clearMessages();

    try {
      const identity = await resetPasswordWithEmailOtp(
        cleanEmail,
        cleanCode,
        resetPassword,
      );
      await handleFinishSuccess(identity);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not reset this password.",
      );
      setIsSigningIn(false);
      setSigningInProvider(null);
    }
  };

  const renderPasswordStrength = (score: number) => {
    if (score <= 1) return "Weak";
    if (score === 2) return "Fair";
    if (score === 3) return "Good";
    return "Strong";
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto overflow-x-hidden bg-slate-950/55 p-2 backdrop-blur-sm sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${dialogId}-title`}
        className="readative-dialog-surface relative flex max-h-[calc(100dvh-1rem)] w-full max-w-[540px] flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-2xl transition-all sm:max-h-[calc(100dvh-2rem)]"
      >
        <div className="shrink-0 border-b border-emerald-400/20 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-900 px-6 py-5 text-white">
          <button
            type="button"
            onClick={onClose}
            disabled={isSigningIn}
            className="absolute right-4 top-4 rounded-full p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
            aria-label="Close sign in dialog"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-3 pr-9">
            <div className="inline-flex rounded-2xl bg-emerald-400/15 p-2.5 text-emerald-300 ring-1 ring-emerald-300/30">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <h2 id={`${dialogId}-title`} className="text-xl font-black tracking-tight sm:text-2xl">
                {title}
              </h2>
              <p className="mt-0.5 text-xs font-bold uppercase tracking-wider text-emerald-300">
                Secure Readative access
              </p>
            </div>
          </div>
          <p className="mt-2.5 text-xs leading-relaxed text-slate-300 sm:text-sm">
            {description}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-gradient-to-b from-white to-slate-50/70 p-5 sm:p-6">
          {errorMessage && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50/95 p-3.5 text-xs font-semibold leading-relaxed text-amber-900 shadow-sm sm:text-sm"
            >
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div className="flex-1">{errorMessage}</div>
            </div>
          )}

          {statusMessage && (
            <div
              role="status"
              className="mb-4 flex items-start gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-semibold leading-relaxed text-emerald-900 shadow-sm sm:text-sm"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <div className="flex-1">{statusMessage}</div>
            </div>
          )}

          {!isResetMode && (
            <>
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isSigningIn}
                  className="flex min-h-12 w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 shadow-sm transition hover:border-emerald-200 hover:bg-emerald-50/40 active:scale-[0.99] disabled:opacity-50"
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

                <button
                  type="button"
                  onClick={handleGithubSignIn}
                  disabled={isSigningIn}
                  className="flex min-h-11 w-full items-center justify-center gap-3 rounded-2xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-900 active:scale-[0.99] disabled:opacity-50"
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

              <div className="relative my-5 flex items-center justify-center">
                <div className="w-full border-t border-slate-200" />
                <span className="absolute bg-white px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  or use email and password
                </span>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-1 rounded-2xl border border-slate-200 bg-slate-100/90 p-1 shadow-inner">
                <button
                  type="button"
                  onClick={() => switchTab("signin")}
                  className={`flex min-h-10 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-black transition-all ${
                    activeTab === "signin"
                      ? "bg-white text-slate-950 shadow-sm ring-1 ring-slate-200"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <LogIn className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Sign In</span>
                </button>
                <button
                  type="button"
                  onClick={() => switchTab("signup")}
                  className={`flex min-h-10 items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-black transition-all ${
                    activeTab === "signup"
                      ? "bg-white text-slate-950 shadow-sm ring-1 ring-slate-200"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <UserPlus className="h-3.5 w-3.5 text-slate-600" />
                  <span>Create Account</span>
                </button>
              </div>
            </>
          )}

          {isResetMode ? (
            resetCodeSent ? (
              <form onSubmit={handleVerifyPasswordReset} className="space-y-4">
                <div className="rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                      <KeyRound className="h-4 w-4" />
                    </span>
                    <span>Verify reset code</span>
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                    Enter the 6-digit code sent to{" "}
                    <span className="font-bold text-emerald-800">
                      {resetMaskedEmail || resetEmail}
                    </span>{" "}
                    and set a new password.
                  </p>
                </div>

                <OtpInputBoxes
                  id={`${dialogId}-reset-code`}
                  label="Verification Code"
                  value={resetCode}
                  onChange={setResetCode}
                  disabled={isSigningIn}
                  autoFocus
                  helperText="This code is required before a password change."
                />

                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    New Password
                  </label>
                  <div className="relative mt-1">
                    <Lock className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                    <input
                      type={showResetPassword ? "text" : "password"}
                      required
                      value={resetPassword}
                      onChange={(event) => setResetPassword(event.target.value)}
                      placeholder="8+ characters with a number"
                      className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetPassword(!showResetPassword)}
                      className="absolute right-3 top-3 rounded p-0.5 text-slate-400 hover:text-slate-600"
                      aria-label={showResetPassword ? "Hide password" : "Show password"}
                    >
                      {showResetPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>

                  {resetPassword && (
                    <div className="mt-2 space-y-2">
                      <div className="flex items-center gap-1.5">
                        <div className="flex flex-1 gap-1">
                          {[1, 2, 3, 4].map((level) => (
                            <div
                              key={level}
                              className={`h-1 flex-1 rounded-full transition-all ${
                                resetPasswordStrength >= level
                                  ? resetPasswordStrength <= 2
                                    ? "bg-amber-500"
                                    : "bg-emerald-500"
                                  : "bg-slate-200"
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-[10px] font-bold text-slate-400">
                          {renderPasswordStrength(resetPasswordStrength)}
                        </span>
                      </div>
                      <p className="text-[11px] font-medium text-slate-500">
                        Use at least 8 characters with a letter and a number.
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700">
                    Confirm New Password
                  </label>
                  <div className="relative mt-1">
                    <Lock className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                    <input
                      type={showResetPassword ? "text" : "password"}
                      required
                      value={resetPasswordConfirm}
                      onChange={(event) => setResetPasswordConfirm(event.target.value)}
                      placeholder="Re-enter password"
                      className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={
                    isSigningIn ||
                    resetCode.length !== OTP_LENGTH ||
                    !isResetPasswordReady ||
                    !resetPasswordConfirm ||
                    resetPassword !== resetPasswordConfirm
                  }
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-black text-white shadow-lg shadow-emerald-900/10 transition hover:bg-emerald-800 disabled:opacity-50"
                >
                  {signingInProvider === "reset-password" ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Resetting Password...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4" />
                      Verify & Reset Password
                    </>
                  )}
                </button>

                <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 pt-1 text-xs font-bold">
                  {resetCountdown > 0 ? (
                    <span className="text-slate-500">
                      Resend code in <span className="text-emerald-700">{resetCountdown}s</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={(event) => void handleRequestResetCode(event)}
                      disabled={isSigningIn}
                      className="text-emerald-700 hover:text-emerald-800 hover:underline"
                    >
                      Resend code
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      resetPasswordVerification();
                      clearMessages();
                    }}
                    className="text-slate-500 hover:text-slate-800 hover:underline"
                  >
                    Use another email
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleRequestResetCode} className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                      <KeyRound className="h-4 w-4" />
                    </span>
                    <span>Reset with email verification</span>
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                    We will send a 6-digit code before allowing a password change.
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
                      value={resetEmail}
                      onChange={(event) => setResetEmail(event.target.value)}
                      placeholder="name@example.com"
                      className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsResetMode(false);
                      resetPasswordVerification();
                      clearMessages();
                    }}
                    className="w-1/3 rounded-2xl border border-slate-200 bg-white py-3 text-xs font-black text-slate-700 shadow-sm hover:bg-slate-50"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={isSigningIn || !resetEmail}
                    className="flex-1 rounded-2xl bg-emerald-700 py-3 text-xs font-black text-white shadow-lg shadow-emerald-900/10 hover:bg-emerald-800 disabled:opacity-50"
                  >
                    {signingInProvider === "reset-code" ? "Sending Code..." : "Send Reset Code"}
                  </button>
                </div>
              </form>
            )
          ) : activeTab === "signin" ? (
            <form
              onSubmit={handleSignIn}
              className="space-y-3.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Email Address
                </label>
                <div className="relative mt-1">
                  <Mail className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="name@example.com"
                    className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-700">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={handleStartReset}
                    className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative mt-1">
                  <Lock className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
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
              </div>

              <button
                type="submit"
                disabled={isSigningIn || !email || !password}
                className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-lg shadow-slate-950/10 transition hover:bg-emerald-700 disabled:opacity-50"
              >
                {signingInProvider === "password" ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  <>
                    <LogIn className="h-4 w-4" />
                    Sign In with Password
                  </>
                )}
              </button>
            </form>
          ) : (
            <form
              onSubmit={handleCreateAccount}
              className="space-y-3.5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Your Name <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <div className="relative mt-1">
                  <User className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="Alex Doe"
                    maxLength={50}
                    disabled={signUpCodeSent}
                    className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:bg-slate-50 disabled:opacity-70"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Email Address
                </label>
                <div className="relative mt-1">
                  <Mail className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(event) => handleEmailChange(event.target.value)}
                    placeholder="name@example.com"
                    disabled={signUpCodeSent}
                    className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:bg-slate-50 disabled:opacity-70"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700">
                  Password
                </label>
                <div className="relative mt-1">
                  <Lock className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="8+ characters with a number"
                    disabled={signUpCodeSent}
                    className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm font-semibold text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:bg-slate-50 disabled:opacity-70"
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

                {password && (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center gap-1.5">
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
                        {renderPasswordStrength(passwordStrength)}
                      </span>
                    </div>
                    <p className="text-[11px] font-medium text-slate-500">
                      Use at least 8 characters with a letter and a number.
                    </p>
                  </div>
                )}
              </div>

              {signUpCodeSent && (
                <div className="rounded-2xl border border-emerald-200 bg-gradient-to-b from-emerald-50/80 to-white p-4 shadow-sm">
                  <div className="flex items-start gap-2 text-xs text-slate-600">
                    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-white text-emerald-700 shadow-sm">
                      <CheckCircle2 className="h-4 w-4" />
                    </span>
                    <p className="leading-relaxed">
                      Code sent to{" "}
                      <span className="font-bold text-emerald-800">
                        {signUpMaskedEmail || email}
                      </span>
                      .
                    </p>
                  </div>
                  <OtpInputBoxes
                    id={`${dialogId}-signup-code`}
                    label="Verification Code"
                    value={signUpCode}
                    onChange={setSignUpCode}
                    disabled={isSigningIn}
                    autoFocus
                    className="mt-4"
                    helperText="This code confirms the email before the account is created."
                  />
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
                    {signUpCountdown > 0 ? (
                      <span className="text-slate-500">
                        Resend code in <span className="text-emerald-700">{signUpCountdown}s</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void requestSignUpCode()}
                        disabled={isSigningIn}
                        className="text-emerald-700 hover:text-emerald-800 hover:underline"
                      >
                        Resend code
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        resetSignUpVerification();
                        clearMessages();
                      }}
                      className="text-slate-500 hover:text-slate-800 hover:underline"
                    >
                      Edit details
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={
                  isSigningIn ||
                  !email ||
                  !password ||
                  !isSignupPasswordReady ||
                  (signUpCodeSent && signUpCode.length !== OTP_LENGTH)
                }
                className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-black text-white shadow-lg shadow-emerald-900/10 transition hover:bg-emerald-800 disabled:opacity-50"
              >
                {signingInProvider === "password" || signingInProvider === "signup-code" ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    {signUpCodeSent ? "Creating Account..." : "Sending Code..."}
                  </>
                ) : (
                  <>
                    <UserPlus className="h-4 w-4" />
                    {signUpCodeSent ? "Verify & Create Account" : "Send Code to Create Account"}
                  </>
                )}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => switchTab("signin")}
                  className="text-xs font-semibold text-slate-600 hover:text-emerald-700"
                >
                  Already have an account?{" "}
                  <span className="font-bold text-emerald-700 underline">Sign In</span>
                </button>
              </div>
            </form>
          )}

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

        <div className="shrink-0 border-t border-slate-100 bg-slate-50/90 px-6 py-3.5 text-center text-[11px] leading-relaxed text-slate-400">
          <span>
            {usesProjectAuthHelper
              ? "Protected by Firebase Auth and email verification."
              : `Secure authentication via ${signInDomain} with email verification.`}
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

export const GoogleSignInPrompt = AuthModal;
