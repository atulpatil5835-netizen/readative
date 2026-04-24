import { useState } from "react";
import { motion } from "motion/react";
import { AtSign, CheckCircle, Mail, PenSquare, X } from "lucide-react";

interface EmailAccessPromptProps {
  initialEmail?: string;
  initialDisplayName?: string;
  onConfirm: (email: string, displayName: string) => void;
  onClose: () => void;
}

export function EmailAccessPrompt({
  initialEmail = "",
  initialDisplayName = "",
  onConfirm,
  onClose,
}: EmailAccessPromptProps) {
  const [email, setEmail] = useState(initialEmail);
  const [displayName, setDisplayName] = useState(initialDisplayName);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !displayName.trim()) return;
    onConfirm(email.trim(), displayName.trim());
  };

  const inputClass =
    "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition-all focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-200";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 backdrop-blur-sm p-4">
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
            <PenSquare className="h-6 w-6" />
          </div>
          <h2 className="text-2xl font-black tracking-tight">
            Sign In To Share Knowledge
          </h2>
          <p className="mt-2 text-sm text-emerald-50">
            No password. No OTP. Just your name and email to start publishing.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">
              Username
            </label>
            <div className="relative">
              <AtSign className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className={`${inputClass} pl-11`}
                placeholder="your_username"
                autoFocus
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-[0.24em] text-slate-400">
              Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={`${inputClass} pl-11`}
                placeholder="you@example.com"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={!email.trim() || !displayName.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-emerald-700 disabled:opacity-50"
          >
            <CheckCircle className="h-4 w-4" />
            Continue
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
  onConfirm: (username: string) => void;
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

  const resolvedTitle =
    title || (action === "like" ? "Like this knowledge?" : "Add a comment?");
  const resolvedDescription = description || "Share your name before joining in";
  const resolvedSubmitLabel =
    submitLabel || (action === "like" ? "Like" : "Continue");
  const emoji = action === "like" ? "❤️" : "💬";

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!username.trim()) return;
    onConfirm(username.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 backdrop-blur-sm p-4">
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
            <div className="mb-2 text-2xl">{emoji}</div>
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
              onChange={(event) => setUsername(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-800 outline-none transition-all focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-200"
              placeholder={placeholder}
              autoFocus
              required
            />
          </div>

          <button
            type="submit"
            disabled={!username.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-emerald-700 disabled:opacity-50"
          >
            <CheckCircle className="h-4 w-4" />
            {resolvedSubmitLabel}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
