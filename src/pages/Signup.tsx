import { useState } from "react";
import { formatGoogleAuthError, signInWithGoogleProfile } from "../utils/googleAuth";

export default function Signup() {
  const [isStarting, setIsStarting] = useState(false);

  const handleSignup = async () => {
    try {
      setIsStarting(true);
      await signInWithGoogleProfile();
      alert("Google account connected successfully");
    } catch (error) {
      alert(formatGoogleAuthError(error));
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="mx-auto mt-20 max-w-md space-y-4">
      <h2 className="text-2xl font-bold">Create Account</h2>
      <p className="text-sm text-slate-500">
        Use your Gmail account to create your secure Readative profile.
      </p>

      <button
        onClick={() => void handleSignup()}
        disabled={isStarting}
        className="w-full rounded bg-emerald-600 px-4 py-2 text-white disabled:opacity-50"
      >
        {isStarting ? "Starting Google sign-in..." : "Continue with Google"}
      </button>
    </div>
  );
}
