import { useState } from "react";
import { formatGoogleAuthError, signInWithGoogleProfile } from "../utils/googleAuth";

export default function Login() {
  const [isStarting, setIsStarting] = useState(false);

  const handleLogin = async () => {
    try {
      setIsStarting(true);
      await signInWithGoogleProfile();
      alert("Signed in successfully");
    } catch (error) {
      alert(formatGoogleAuthError(error));
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="mx-auto mt-20 max-w-md space-y-4">
      <h2 className="text-2xl font-bold">Sign In</h2>
      <p className="text-sm text-slate-500">
        Continue directly with your Gmail account.
      </p>

      <button
        onClick={() => void handleLogin()}
        disabled={isStarting}
        className="w-full rounded bg-emerald-600 px-4 py-2 text-white disabled:opacity-50"
      >
        {isStarting ? "Starting Google sign-in..." : "Continue with Google"}
      </button>
    </div>
  );
}
