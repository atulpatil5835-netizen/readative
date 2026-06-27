import { useEffect, useState } from "react";
import {
  AtSign,
  Award,
  Bookmark,
  CheckCircle,
  LogIn,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  ThumbsUp,
  UserRound,
  X,
} from "lucide-react";
import { firebaseAuthDomain } from "../firebase/firebase";

interface IdentityPromptProps {
  title?: string;
  description?: string;
  submitLabel?: string;
  initialValue?: string;
  onConfirm: (username: string) => void | Promise<void>;
  onClose: () => void;
}

export function IdentityPrompt({
  title = "Choose your username",
  description = "You only need to do this once. We remember this username on this browser for posting, helpful feedback, commenting, tagging, and notifications.",
  submitLabel = "Save username",
  initialValue = "",
  onConfirm,
  onClose,
}: IdentityPromptProps) {
  const [username, setUsername] = useState(initialValue);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSaving) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSaving, onClose]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!username.trim()) return;

    setIsSaving(true);
    setErrorMessage(null);

    try {
      await onConfirm(username.trim());
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not save this username right now."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto overscroll-contain bg-slate-950/45 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="identity-prompt-title"
        className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-white/60 bg-white shadow-2xl"
      >
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 px-6 py-6 text-white">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
            aria-label="Close username prompt"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="mb-4 inline-flex rounded-full bg-white/15 p-3">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h2 id="identity-prompt-title" className="text-2xl font-black tracking-tight">{title}</h2>
          <p className="mt-2 text-sm text-emerald-50">{description}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">What we save</p>
            <p className="mt-2 leading-6">
              Your username is remembered on this device and tied to your posts,
              helpful feedback, comments, tags, and realtime notifications.
            </p>
          </div>

          <div className="relative">
            <AtSign className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={username}
              onChange={(event) => {
                setUsername(event.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-800 outline-none transition-all focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-200"
              placeholder="your_name"
              aria-label="Username"
              autoFocus
              required
            />
          </div>

          {errorMessage && (
            <p role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isSaving || !username.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-emerald-700 disabled:opacity-50"
          >
            <CheckCircle className="h-4 w-4" />
            {isSaving ? "Saving..." : submitLabel}
          </button>
        </form>
      </div>
    </div>
  );
}

interface UsernamePromptProps {
  action?: "like" | "comment";
  title?: string;
  description?: string;
  submitLabel?: string;
  placeholder?: string;
  initialValue?: string;
  onConfirm: (username: string) => void | Promise<void>;
  onClose: () => void;
}

export function UsernamePrompt({
  action,
  title,
  description,
  submitLabel,
  placeholder = "your_name",
  initialValue = "",
  onConfirm,
  onClose,
}: UsernamePromptProps) {
  const [username, setUsername] = useState(initialValue);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const resolvedTitle =
    title || (action === "like" ? "Mark this helpful?" : "Add a comment?");
  const resolvedDescription =
    description || "Share your username once before joining in";
  const resolvedSubmitLabel =
    submitLabel || (action === "like" ? "Helpful" : "Continue");
  const PromptIcon = action === "like" ? ThumbsUp : MessageCircle;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSaving) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSaving, onClose]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!username.trim()) return;

    setIsSaving(true);
    setErrorMessage(null);

    try {
      await onConfirm(username.trim());
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not save this username right now."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-y-auto overscroll-contain bg-slate-950/45 p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="username-prompt-title"
        className="relative w-full max-w-xs rounded-[28px] border border-white/60 bg-white p-6 shadow-2xl"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-slate-400 transition-colors hover:text-slate-600"
          aria-label="Close username prompt"
        >
          <X className="h-4 w-4" />
        </button>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-center">
            <div className="mb-3 inline-flex rounded-full bg-emerald-50 p-3 text-emerald-600">
              <PromptIcon className="h-5 w-5" />
            </div>
            <h2 id="username-prompt-title" className="text-lg font-bold text-slate-900">{resolvedTitle}</h2>
            <p className="mt-1 text-sm text-slate-500">{resolvedDescription}</p>
          </div>

          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base text-slate-400">
              @
            </span>
            <input
              type="text"
              value={username}
              onChange={(event) => {
                setUsername(event.target.value);
                if (errorMessage) setErrorMessage(null);
              }}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-800 outline-none transition-all focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-200"
              placeholder={placeholder}
              aria-label="Username"
              autoFocus
              required
            />
          </div>

          {errorMessage && (
            <p role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {errorMessage}
            </p>
          )}

          <button
            type="submit"
            disabled={isSaving || !username.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-emerald-700 disabled:opacity-50"
          >
            <CheckCircle className="h-4 w-4" />
            {isSaving ? "Saving..." : resolvedSubmitLabel}
          </button>
        </form>
      </div>
    </div>
  );
}

interface GoogleSignInPromptProps {
  title?: string;
  description?: string;
  submitLabel?: string;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export function GoogleSignInPrompt({
  title = "Continue with Google",
  description = "Unlock a Readative profile for saved posts, discussions, reputation, and trusted contributors.",
  submitLabel = "Continue with Google",
  onConfirm,
  onClose,
}: GoogleSignInPromptProps) {
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const signInDomain = firebaseAuthDomain.replace(/^www\./, "");
  const usesProjectAuthHelper = signInDomain.endsWith(".firebaseapp.com");
  const benefits = [
    {
      label: "Save Posts",
      detail: "Keep important knowledge ready on every device.",
      icon: Bookmark,
    },
    {
      label: "Highlight Knowledge",
      detail: "Build toward richer visibility tools as they arrive.",
      icon: Sparkles,
    },
    {
      label: "Join Discussions",
      detail: "Comment, reply, and keep your activity connected.",
      icon: MessageCircle,
    },
    {
      label: "Build Reputation",
      detail: "Carry helpful feedback into a trusted profile.",
      icon: Award,
    },
    {
      label: "Follow Contributors",
      detail: "Discover trusted voices as the network grows.",
      icon: UserRound,
    },
  ];

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSigningIn) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSigningIn, onClose]);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setErrorMessage(null);

    try {
      await onConfirm();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Google sign-in could not finish right now.",
      );
      setIsSigningIn(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center overflow-hidden bg-slate-950/35 p-2 backdrop-blur-sm sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="google-sign-in-title"
        className="relative flex max-h-[calc(100dvh-1rem)] w-full max-w-md flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:rounded-[28px]"
      >
        <div className="shrink-0 border-b border-slate-100 bg-slate-950 px-5 py-4 text-white sm:py-5">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full p-2 text-white/65 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Close sign in"
            autoFocus
          >
            <X className="h-4 w-4" />
          </button>

          <div className="mb-4 inline-flex rounded-2xl bg-white/10 p-3 text-emerald-300">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h2 id="google-sign-in-title" className="pr-8 text-2xl font-black tracking-normal">
            {title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            {description}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">
          <div className="grid gap-2">
            {benefits.map((benefit) => {
              const BenefitIcon = benefit.icon;

              return (
                <div
                  key={benefit.label}
                  className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3"
                >
                  <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-emerald-700 shadow-sm">
                    <BenefitIcon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-black text-slate-950">
                      {benefit.label}
                    </span>
                    <span className="mt-0.5 block text-xs leading-5 text-slate-500">
                      {benefit.detail}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <ShieldCheck className="h-4 w-4 shrink-0" />
            <span className="min-w-0">
              {usesProjectAuthHelper ? (
                "Secure Google sign-in for Readative"
              ) : (
                <>
                  Secure sign-in opens from{" "}
                  <span className="font-black">{signInDomain}</span>
                </>
              )}
            </span>
          </div>
        </div>

        <div className="shrink-0 space-y-3 border-t border-slate-100 bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4 sm:pb-5">
          {errorMessage && (
            <p role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
              {errorMessage}
            </p>
          )}

          <button
            type="button"
            onClick={handleSignIn}
            disabled={isSigningIn}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-emerald-700 disabled:opacity-50"
          >
            <LogIn className="h-4 w-4" />
            {isSigningIn ? "Opening Google..." : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
