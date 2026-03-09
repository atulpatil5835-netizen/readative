import { useState, useEffect } from "react";
import { HelmetProvider } from "react-helmet-async";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase/firebase";
import { Header } from "./components/Header";
import { Feed } from "./components/Feed";
import { SmartTalk } from "./components/SmartTalk";
import { Exam } from "./components/Exam";
import { Profile } from "./components/Profile";
import { Auth } from "./components/Auth";
import { UserProfile } from "./types";
import { MessageSquarePlus } from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState<"home" | "smarttalk" | "exam" | "profile">("home");
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  // ✅ Listen to Firebase auth state — survives minimize/tab switch
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        const profile: UserProfile = {
          id: firebaseUser.uid,
          name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "Reader",
          photo: firebaseUser.photoURL ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(firebaseUser.displayName || "User")}&background=10b981&color=fff`,
          email: firebaseUser.email || "",
          readingScore: 0,
          examScore: 0,
          readPosts: [],
          following: [],
        };
        setUser(profile);
        setIsGuest(false);
      } else {
        // Only reset if not guest
        setUser(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const refreshProfile = () => {
    // Profile data is now from Firebase — no API call needed
    // If you store extra data in Firestore, fetch it here
  };

  const toggleFollow = (authorName: string) => {
    if (!user) return;
    const isFollowing = user.following.includes(authorName);
    const newFollowing = isFollowing
      ? user.following.filter(n => n !== authorName)
      : [...user.following, authorName];
    setUser({ ...user, following: newFollowing });
  };

  const handleLogin = (loggedInUser: UserProfile) => {
    setUser(loggedInUser);
    setIsGuest(false);
  };

  const handleLogout = async () => {
    await auth.signOut();
    setUser(null);
    setIsGuest(false);
    setActiveTab("home");
  };

  const handleGuest = () => {
    setIsGuest(true);
    setAuthLoading(false);
  };

  // Show loading spinner while Firebase checks auth state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#F5F5F0] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400 font-medium">Loading Readative...</p>
        </div>
      </div>
    );
  }

  if (!user && !isGuest) {
    return <Auth onLogin={handleLogin} onGuest={handleGuest} />;
  }

  return (
    <HelmetProvider>
      <div className="min-h-screen bg-[#F5F5F0] text-[#1A1A1A] font-sans">
        <Header activeTab={activeTab} setActiveTab={setActiveTab} user={user} onLogout={handleLogout} />

        <main className="max-w-2xl mx-auto pt-20 pb-24 px-4">
          {activeTab === "home"      && <Feed user={user} refreshProfile={refreshProfile} />}
          {activeTab === "smarttalk" && <SmartTalk user={user} toggleFollow={toggleFollow} />}
          {activeTab === "exam"      && <Exam user={user} refreshProfile={refreshProfile} />}
          {activeTab === "profile"   && <Profile user={user} />}
        </main>

        {/* Mobile Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-black/5 px-6 py-3 flex justify-between items-center md:hidden z-50">
          <button onClick={() => setActiveTab("home")} className={`p-2 ${activeTab === "home" ? "text-emerald-600" : "text-gray-400"}`}>
            <HomeIcon />
          </button>
          <button onClick={() => setActiveTab("smarttalk")} className={`p-2 ${activeTab === "smarttalk" ? "text-emerald-600" : "text-gray-400"}`}>
            <MessageSquarePlus className="w-6 h-6" />
          </button>
          <button onClick={() => setActiveTab("exam")} className={`p-2 ${activeTab === "exam" ? "text-emerald-600" : "text-gray-400"}`}>
            <ExamIcon />
          </button>
          <button onClick={() => setActiveTab("profile")} className={`p-2 ${activeTab === "profile" ? "text-emerald-600" : "text-gray-400"}`}>
            <UserIcon />
          </button>
        </nav>
      </div>
    </HelmetProvider>
  );
}

function HomeIcon() { return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>; }
function ExamIcon() { return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="m9 15 2 2 4-4"/></svg>; }
function UserIcon() { return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>; }