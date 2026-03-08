import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Mail, Lock, User, ArrowRight, Key, CheckCircle, Chrome } from "lucide-react";
import { UserProfile } from "../types";
import { Logo } from "./Logo";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { auth } from "../firebase/firebase";

interface AuthProps {
  onLogin: (user: UserProfile) => void;
  onGuest: () => void;
}

type AuthView = "login" | "register" | "forgot-password" | "verify-email" | "otp-sent";

export function Auth({ onLogin, onGuest }: AuthProps) {
  const [view, setView] = useState<AuthView>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const firebaseErrorMessage = (code: string) => {
    switch (code) {
      case "auth/user-not-found": return "No account found with this email.";
      case "auth/wrong-password": return "Incorrect password.";
      case "auth/email-already-in-use": return "This email is already registered.";
      case "auth/weak-password": return "Password must be at least 6 characters.";
      case "auth/invalid-email": return "Invalid email address.";
      case "auth/too-many-requests": return "Too many attempts. Try again later.";
      case "auth/invalid-credential": return "Invalid email or password.";
      default: return "Something went wrong. Please try again.";
    }
  };

  const toUserProfile = (firebaseUser: any): UserProfile => ({
    id: firebaseUser.uid,
    name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Reader",
    photo: firebaseUser.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(firebaseUser.displayName || "User")}&background=10b981&color=fff`,
    readingScore: 0,
    examScore: 0,
    readPosts: [],
    following: [],
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      onLogin(toUserProfile(result.user));
    } catch (err: any) {
      setError(firebaseErrorMessage(err.code));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(result.user, { displayName: name });
      await sendEmailVerification(result.user);
      setView("verify-email");
    } catch (err: any) {
      setError(firebaseErrorMessage(err.code));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyAndLogin = async () => {
    setIsLoading(true);
    setError("");
    try {
      await auth.currentUser?.reload();
      const user = auth.currentUser;
      if (user?.emailVerified) {
        onLogin(toUserProfile(user));
      } else {
        setError("Email not verified yet. Please check your inbox.");
      }
    } catch (err: any) {
      setError("Failed to verify. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendVerification = async () => {
    try {
      if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser);
        setSuccessMsg("Verification email resent!");
      }
    } catch {
      setError("Could not resend email. Try again shortly.");
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    // Generate a 6-digit OTP and show it (simulate — real apps use a backend)
    const mockOtp = Math.floor(100000 + Math.random() * 900000).toString();
    setGeneratedOtp(mockOtp);

    try {
      await sendPasswordResetEmail(auth, email);
      setSuccessMsg(`A password reset email has been sent to ${email}.`);
      setView("otp-sent");
    } catch (err: any) {
      setError(firebaseErrorMessage(err.code));
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (otp === generatedOtp) {
      setSuccessMsg("OTP verified! Check your email to reset your password.");
      setError("");
    } else {
      setError("Incorrect OTP. Please try again.");
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError("");
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      onLogin(toUserProfile(result.user));
    } catch (err: any) {
      setError(firebaseErrorMessage(err.code));
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass = "w-full bg-gray-50 border border-gray-200 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all";
  const labelClass = "text-xs font-bold text-gray-500 uppercase tracking-wider";

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F0] p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-xl border border-black/5 p-8 w-full max-w-md overflow-hidden relative"
      >
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-400 to-blue-500" />

        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4">
            <Logo className="w-full h-full" />
          </div>
          <h1 className="text-3xl font-black text-emerald-900 tracking-tight mb-2">Readative</h1>
          <p className="text-gray-500 text-sm">Your journey to smarter reading starts here.</p>
        </div>

        <AnimatePresence mode="wait">

          {/* ── LOGIN ── */}
          {view === "login" && (
            <motion.form key="login" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} onSubmit={handleLogin} className="space-y-4">
              <h2 className="text-xl font-bold text-gray-800 mb-6">Welcome Back</h2>

              <div className="space-y-2">
                <label className={labelClass}>Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="you@example.com" required />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <label className={labelClass}>Password</label>
                  <button type="button" onClick={() => { setError(""); setView("forgot-password"); }} className="text-xs font-bold text-emerald-600 hover:underline">Forgot?</button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} placeholder="••••••••" required />
                </div>
              </div>

              {error && <p className="text-red-500 text-sm font-medium">{error}</p>}

              <button type="submit" disabled={isLoading} className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-70">
                {isLoading ? "Logging in..." : <><span>Login</span><ArrowRight className="w-5 h-5" /></>}
              </button>

              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
                <div className="relative flex justify-center text-sm"><span className="px-2 bg-white text-gray-400">or</span></div>
              </div>

              <button type="button" onClick={handleGoogleLogin} disabled={isLoading} className="w-full flex items-center justify-center gap-3 border border-gray-200 py-3 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition-all">
                <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Continue with Google
              </button>

              <button type="button" onClick={onGuest} className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition-all">
                Continue as Guest
              </button>

              <p className="text-center text-gray-500 text-sm">
                Don't have an account?{" "}
                <button type="button" onClick={() => { setError(""); setView("register"); }} className="text-emerald-600 font-bold hover:underline">Sign up</button>
              </p>
            </motion.form>
          )}

          {/* ── REGISTER ── */}
          {view === "register" && (
            <motion.form key="register" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} onSubmit={handleRegister} className="space-y-4">
              <h2 className="text-xl font-bold text-gray-800 mb-6">Create Account</h2>

              <div className="space-y-2">
                <label className={labelClass}>Full Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="John Doe" required />
                </div>
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="you@example.com" required />
                </div>
              </div>

              <div className="space-y-2">
                <label className={labelClass}>Password</label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} placeholder="Min. 6 characters" required />
                </div>
              </div>

              {error && <p className="text-red-500 text-sm font-medium">{error}</p>}

              <button type="submit" disabled={isLoading} className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-70">
                {isLoading ? "Creating Account..." : <><span>Sign Up</span><ArrowRight className="w-5 h-5" /></>}
              </button>

              <p className="text-center text-gray-500 text-sm">
                Already have an account?{" "}
                <button type="button" onClick={() => { setError(""); setView("login"); }} className="text-emerald-600 font-bold hover:underline">Login</button>
              </p>
            </motion.form>
          )}

          {/* ── VERIFY EMAIL (after register) ── */}
          {view === "verify-email" && (
            <motion.div key="verify-email" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6 text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
                <Mail className="w-8 h-8 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">Verify your email</h2>
                <p className="text-gray-500 text-sm">We sent a verification link to <span className="font-semibold text-gray-700">{email}</span>. Click the link then come back here.</p>
              </div>

              {error && <p className="text-red-500 text-sm font-medium">{error}</p>}
              {successMsg && <p className="text-emerald-600 text-sm font-medium">{successMsg}</p>}

              <button onClick={handleVerifyAndLogin} disabled={isLoading} className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-70">
                {isLoading ? "Checking..." : <><CheckCircle className="w-5 h-5" /><span>I've verified my email</span></>}
              </button>

              <button type="button" onClick={handleResendVerification} className="w-full text-emerald-600 text-sm font-bold hover:underline">
                Resend verification email
              </button>

              <button type="button" onClick={() => setView("login")} className="w-full text-gray-400 text-sm hover:text-gray-600">
                Back to Login
              </button>
            </motion.div>
          )}

          {/* ── FORGOT PASSWORD ── */}
          {view === "forgot-password" && (
            <motion.form key="forgot-password" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} onSubmit={handleForgotPassword} className="space-y-4">
              <h2 className="text-xl font-bold text-gray-800 mb-2">Reset Password</h2>
              <p className="text-gray-500 text-sm mb-6">Enter your email and we'll send you an OTP code.</p>

              <div className="space-y-2">
                <label className={labelClass}>Email</label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="you@example.com" required />
                </div>
              </div>

              {error && <p className="text-red-500 text-sm font-medium">{error}</p>}

              <button type="submit" disabled={isLoading} className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-emerald-700 transition-all flex items-center justify-center gap-2 disabled:opacity-70">
                {isLoading ? "Sending..." : <><span>Send OTP</span><ArrowRight className="w-5 h-5" /></>}
              </button>

              <button type="button" onClick={() => setView("login")} className="w-full text-center text-gray-500 text-sm font-medium hover:text-gray-800">
                Back to Login
              </button>
            </motion.form>
          )}

          {/* ── OTP SENT ── */}
          {view === "otp-sent" && (
            <motion.form key="otp-sent" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <Key className="w-7 h-7 text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-800 text-center">Enter OTP</h2>
              <p className="text-gray-500 text-sm text-center">We sent a 6-digit code to <span className="font-semibold text-gray-700">{email}</span>. Also check your email for a reset link.</p>

              <div className="space-y-2">
                <label className={labelClass}>OTP Code</label>
                <div className="relative">
                  <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    className={`${inputClass} tracking-widest font-mono text-lg text-center`}
                    placeholder="000000"
                    maxLength={6}
                  />
                </div>
              </div>

              {error && <p className="text-red-500 text-sm font-medium text-center">{error}</p>}
              {successMsg && <p className="text-emerald-600 text-sm font-medium text-center">{successMsg}</p>}

              <button type="submit" className="w-full bg-emerald-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-emerald-700 transition-all flex items-center justify-center gap-2">
                <CheckCircle className="w-5 h-5" />
                Verify OTP
              </button>

              <button type="button" onClick={() => setView("login")} className="w-full text-center text-gray-500 text-sm font-medium hover:text-gray-800">
                Back to Login
              </button>
            </motion.form>
          )}

        </AnimatePresence>
      </motion.div>
    </div>
  );
}