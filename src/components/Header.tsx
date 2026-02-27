import { motion } from "motion/react";
import { LogOut } from "lucide-react";
import { UserProfile } from "../types";
import { Logo } from "./Logo";

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  user: UserProfile | null;
  onLogout: () => void;
}

export function Header({ activeTab, setActiveTab, user, onLogout }: HeaderProps) {
  return (
    <header className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md border-b border-black/5 z-50">
      <div className="max-w-5xl mx-auto px-6 h-16 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 flex items-center justify-center">
            <Logo className="w-full h-full" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight text-emerald-900 leading-none">Readative</h1>
            <p className="text-[10px] font-bold text-emerald-600/60 uppercase tracking-[0.2em] mt-1">Read. Write. Learn. Grow</p>
          </div>
        </div>
        
        <nav className="hidden md:flex items-center gap-8">
          <button 
            onClick={() => setActiveTab("home")}
            className={`text-sm font-medium transition-colors ${activeTab === "home" ? "text-emerald-600" : "text-gray-500 hover:text-emerald-600"}`}
          >
            Home
          </button>
          <button 
            onClick={() => setActiveTab("bot")}
            className={`text-sm font-medium transition-colors ${activeTab === "bot" ? "text-emerald-600" : "text-gray-500 hover:text-emerald-600"}`}
          >
            AI Bot
          </button>
          <button 
            onClick={() => setActiveTab("smarttalk")}
            className={`text-sm font-medium transition-colors ${activeTab === "smarttalk" ? "text-emerald-600" : "text-gray-500 hover:text-emerald-600"}`}
          >
            SmartTalk
          </button>
          <button 
            onClick={() => setActiveTab("exam")}
            className={`text-sm font-medium transition-colors ${activeTab === "exam" ? "text-emerald-600" : "text-gray-500 hover:text-emerald-600"}`}
          >
            Exams
          </button>
          <button 
            onClick={() => setActiveTab("profile")}
            className={`text-sm font-medium transition-colors ${activeTab === "profile" ? "text-emerald-600" : "text-gray-500 hover:text-emerald-600"}`}
          >
            Profile
          </button>
        </nav>

        <div className="flex items-center gap-4">
          <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden">
            <img src={user?.photo || "https://picsum.photos/seed/guest/100"} alt="Avatar" className="w-full h-full object-cover" />
          </div>
          <button 
            onClick={onLogout}
            className="hidden md:flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-red-600 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            {user ? "Logout" : "Login"}
          </button>
        </div>
      </div>
    </header>
  );
}
