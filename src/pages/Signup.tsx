import { useState } from "react"
import { createUserWithEmailAndPassword } from "firebase/auth"
import { auth } from "../firebase/firebase"

export default function Signup() {

  const [email,setEmail] = useState("")
  const [password,setPassword] = useState("")

  const handleSignup = async () => {

    const strongPassword = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*]).{8,}$/

    if(!strongPassword.test(password)){
      alert("Password must contain:\n• 8 characters\n• 1 uppercase\n• 1 number\n• 1 symbol")
      return
    }

    try{
      await createUserWithEmailAndPassword(auth,email,password)
      alert("Account created successfully")
    }catch(error){
      console.error(error)
      alert("Signup failed")
    }
  }

  return (
    <div className="max-w-md mx-auto mt-20 space-y-4">

      <h2 className="text-2xl font-bold">Signup</h2>

      <input
        type="email"
        placeholder="Email"
        className="border p-2 w-full"
        value={email}
        onChange={(e)=>setEmail(e.target.value)}
      />

      <input
        type="password"
        placeholder="Password"
        className="border p-2 w-full"
        value={password}
        onChange={(e)=>setPassword(e.target.value)}
      />

      <button
        onClick={handleSignup}
        className="bg-emerald-600 text-white px-4 py-2 rounded w-full"
      >
        Create Account
      </button>

    </div>
  )
}