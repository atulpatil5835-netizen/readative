import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mail, Key, CheckCircle, ArrowRight, X } from "lucide-react";

interface PostAuthProps {
  onVerified: (email: string, displayName: string) => void;
  onClose: () => void;
}

type AuthView = "email" | "otp";

export function PostAuth({ onVerified, onClose }: PostAuthProps) {
  const [view, setView] = useState<AuthView>("email");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [otp, setOtp] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !displayName.trim()) return;
    setIsLoading(true);
    setError("");

    // Generate a 6-digit OTP (in production, send via backend/email service)
    const mockOtp = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(mockOtp);

    // Simulate sending delay
    await new Promise((r) => setTimeout(r, 800));

    // In dev, log OTP to console — replace with real email service
    console.log(`[DEV] OTP for ${email}: ${mockOtp}`);

    setIsLoading(false);
    setView("otp");
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp === generatedOtp) {
      onVerified(email, displayName);
    } else {
      setError("Incorrect OTP. Please try again.");
    }
  };

  const inputClass =
    "w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-gray-800";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 relative"
      >
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <AnimatePresence mode="wait">
          {/* ── STEP 1: Email + Name ── */}
          {view === "email" && (
            <motion.form
              key="email"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={handleSendOtp}
              className="space-y-5"
            >
              <div className="text-center mb-2">
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Mail className="w-6 h-6 text-emerald-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-800">Verify to Post</h2>
                <p className="text-gray-500 text-sm mt-1">
                  No account needed — just verify your email once.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Display Name
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-base">@</span>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className={inputClass}
                    placeholder="your_name"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </div>

              {error && <p className="text-red-500 text-sm font-medium">{error}</p>}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {isLoading ? (
                  "Sending OTP..."
                ) : (
                  <>
                    <span>Send OTP</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </motion.form>
          )}

          {/* ── STEP 2: OTP Verify ── */}
          {view === "otp" && (
            <motion.form
              key="otp"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={handleVerifyOtp}
              className="space-y-5"
            >
              <div className="text-center mb-2">
                <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Key className="w-6 h-6 text-emerald-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-800">Enter OTP</h2>
                <p className="text-gray-500 text-sm mt-1">
                  We sent a 6-digit code to{" "}
                  <span className="font-semibold text-gray-700">{email}</span>
                </p>
                {/* Dev helper — remove in production */}
                <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-1.5 mt-2">
                  <strong>Dev mode:</strong> Check browser console for OTP
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  OTP Code
                </label>
                <div className="relative">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className={`${inputClass} tracking-widest font-mono text-xl text-center`}
                    placeholder="000000"
                    maxLength={6}
                    autoFocus
                  />
                </div>
              </div>

              {error && (
                <p className="text-red-500 text-sm font-medium text-center">{error}</p>
              )}

              <button
                type="submit"
                disabled={otp.length < 6}
                className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                Verify & Post
              </button>

              <button
                type="button"
                onClick={() => {
                  setView("email");
                  setOtp("");
                  setError("");
                }}
                className="w-full text-center text-gray-400 text-sm hover:text-gray-600"
              >
                ← Change email
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Username prompt modal — used for Like & Comment
// ─────────────────────────────────────────────

interface UsernamePromptProps {
  action: "like" | "comment";
  onConfirm: (username: string) => void;
  onClose: () => void;
}

export function UsernamePrompt({ action, onConfirm, onClose }: UsernamePromptProps) {
  const [username, setUsername] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    onConfirm(username.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="w-full max-w-xs bg-white rounded-2xl shadow-2xl p-6 relative"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X className="w-4 h-4" />
        </button>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-center">
            <div className="text-2xl mb-2">{action === "like" ? "❤️" : "💬"}</div>
            <h2 className="text-lg font-bold text-gray-800">
              {action === "like" ? "Like this post?" : "Leave a comment?"}
            </h2>
            <p className="text-gray-500 text-sm mt-1">Just tell us who you are</p>
          </div>

          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-base">@</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-gray-800"
              placeholder="your_name"
              autoFocus
              required
            />
          </div>

          <button
            type="submit"
            disabled={!username.trim()}
            className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            {action === "like" ? "Like" : "Continue"}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
