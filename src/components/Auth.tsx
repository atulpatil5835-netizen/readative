import { useEffect, useState } from "react";
import {
  Award,
  Bookmark,
  LogIn,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { firebaseAuthDomain } from "../firebase/firebaseConfig";

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
      label: "Highlight Reading Notes",
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
        className="readative-dialog-surface relative flex max-h-[calc(100dvh-1rem)] w-full max-w-md flex-col overflow-hidden sm:max-h-[calc(100dvh-2rem)]"
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
