import { useState } from "react";
import { motion } from "motion/react";
import {
  AtSign,
  CheckCircle,
  Heart,
  MessageCircle,
  ShieldCheck,
  X,
} from "lucide-react";

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
  description = "You only need to do this once. We remember this username on this browser for posting, liking, commenting, tagging, and notifications.",
  submitLabel = "Save username",
  initialValue = "",
  onConfirm,
  onClose,
}: IdentityPromptProps) {
  const [username, setUsername] = useState(initialValue);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 18 }}
        className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-white/60 bg-white shadow-2xl"
      >
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 px-6 py-6 text-white">
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="mb-4 inline-flex rounded-full bg-white/15 p-3">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-black tracking-tight">{title}</h2>
          <p className="mt-2 text-sm text-emerald-50">{description}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
            <p className="font-semibold text-slate-900">What we save</p>
            <p className="mt-2 leading-6">
              Your username is remembered on this device and tied to your posts,
              likes, comments, tags, and realtime notifications.
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
              autoFocus
              required
            />
          </div>

          {errorMessage && (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
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
      </motion.div>
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
    title || (action === "like" ? "Like this knowledge?" : "Add a comment?");
  const resolvedDescription =
    description || "Share your username once before joining in";
  const resolvedSubmitLabel =
    submitLabel || (action === "like" ? "Like" : "Continue");
  const PromptIcon = action === "like" ? Heart : MessageCircle;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        className="relative w-full max-w-xs rounded-[28px] border border-white/60 bg-white p-6 shadow-2xl"
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1 text-slate-400 transition-colors hover:text-slate-600"
        >
          <X className="h-4 w-4" />
        </button>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-center">
            <div className="mb-3 inline-flex rounded-full bg-emerald-50 p-3 text-emerald-600">
              <PromptIcon className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">{resolvedTitle}</h2>
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
              autoFocus
              required
            />
          </div>

          {errorMessage && (
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
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
      </motion.div>
    </div>
  );
}
