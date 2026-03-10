import { LogOut } from "lucide-react"
import { Logo } from "./Logo"
import { UserProfile } from "../types"

interface HeaderProps {
  activeTab: "home" | "smarttalk" | "exam" | "profile"
  setActiveTab: (tab: "home" | "smarttalk" | "exam" | "profile") => void
  user: UserProfile | null
  onLogout: () => void
}

export function Header({ activeTab, setActiveTab, user, onLogout }: HeaderProps) {
  const displayName = user?.name || user?.email?.split("@")[0] || "Guest"
  const photoURL = user?.photo ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=10b981&color=fff`
  const tabs = ["home", "smarttalk", "exam", "profile"] as const

  return (
    <header className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md border-b border-black/5 z-50">
      <div className="max-w-5xl mx-auto px-6 h-16 flex justify-between items-center">

        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 flex items-center justify-center">
            <Logo className="w-full h-full" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-emerald-900 leading-none">Readative</h1>
            <p className="text-[10px] font-bold text-emerald-600/60 uppercase tracking-[0.2em] mt-1">
              Read. Write. Learn. Grow
            </p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="hidden md:flex items-center gap-8">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`text-sm font-medium transition-colors ${
                activeTab === tab ? "text-emerald-600" : "text-gray-500 hover:text-emerald-600"
              }`}
            >
              {tab === "smarttalk" ? "SmartTalk" : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>

        {/* Right Side */}
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden">
            <img src={photoURL} alt="Avatar" className="w-full h-full object-cover" />
          </div>
          {user ? (
            <div className="hidden md:flex items-center gap-3">
              <span className="text-xs font-semibold text-gray-600">{displayName}</span>
              <button
                onClick={onLogout}
                className="flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-red-600 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          ) : (
            <span className="text-xs font-bold text-gray-400">Guest</span>
          )}
        </div>
      </div>
    </header>
  )
}