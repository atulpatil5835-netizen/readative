import { useState } from "react";
import { ensureSignedInProfile } from "../utils/userProfiles";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");

  const handleSignup = async () => {
    if (!email.trim() || !username.trim()) {
      alert("Please enter your username and email.");
      return;
    }

    try {
      await ensureSignedInProfile(email, username);
      alert("Account created successfully");
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "Could not create the account right now."
      );
    }
  };

  return (
    <div className="mx-auto mt-20 max-w-md space-y-4">
      <h2 className="text-2xl font-bold">Sign Up</h2>

      <input
        type="text"
        placeholder="Username"
        className="w-full border p-2"
        value={username}
        onChange={(event) => setUsername(event.target.value)}
      />

      <input
        type="email"
        placeholder="Email"
        className="w-full border p-2"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />

      <button
        onClick={() => void handleSignup()}
        className="w-full rounded bg-emerald-600 px-4 py-2 text-white"
      >
        Create Account
      </button>
    </div>
  );
}
