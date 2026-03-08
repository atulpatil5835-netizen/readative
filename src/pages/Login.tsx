import { useState } from "react"
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup } from "firebase/auth"
import { auth } from "../firebase/firebase"

export default function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const handleLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password)
      alert("Login successful")
    } catch (error) {
      console.error(error)
      alert("Invalid email or password")
    }
  }

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider()
    try {
      await signInWithPopup(auth, provider)
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-20 space-y-4">

      <h2 className="text-2xl font-bold">Login</h2>

      <input
        type="email"
        placeholder="Email"
        className="border p-2 w-full"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        type="password"
        placeholder="Password"
        className="border p-2 w-full"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <button
        onClick={handleLogin}
        className="bg-emerald-600 text-white px-4 py-2 rounded w-full"
      >
        Login
      </button>

      <button
        onClick={handleGoogleLogin}
        className="bg-white border px-4 py-2 rounded w-full"
      >
        Login with Google
      </button>

    </div>
  )
}