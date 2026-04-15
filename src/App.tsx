import { HelmetProvider } from "react-helmet-async";
import { useState, useEffect } from "react";
import { Header } from "./components/Header";
import { Feed } from "./components/Feed";
import { SmartTalk } from "./components/SmartTalk";
import { Exam } from "./components/Exam";
import { Profile } from "./components/Profile";
import { MessageSquareMore } from "lucide-react";

type Tab = "home" | "smarttalk" | "exam" | "profile";

function getTabFromHash(): Tab {
  const hash = window.location.hash.replace("#", "") as Tab;
  const valid: Tab[] = ["home", "smarttalk", "exam", "profile"];
  return valid.includes(hash) ? hash : "home";
}

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>(getTabFromHash);

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    window.location.hash = tab;
  };

  useEffect(() => {
    const onHashChange = () => setActiveTab(getTabFromHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return (
    <HelmetProvider>
      <div className="min-h-screen bg-[#F5F5F0] text-[#1A1A1A] font-sans">
        <Header activeTab={activeTab} setActiveTab={handleTabChange} />

        <main className="max-w-2xl mx-auto pt-20 pb-24 px-4">
          {activeTab === "home"      && <Feed />}
          {activeTab === "smarttalk" && <SmartTalk />}
          {activeTab === "exam"      && <Exam user={null} refreshProfile={() => {}} />}
          {activeTab === "profile"   && <Profile />}
        </main>

        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-black/5 px-6 py-3 flex justify-between items-center md:hidden z-50">
          <button onClick={() => handleTabChange("home")} className={`p-2 ${activeTab === "home" ? "text-emerald-600" : "text-gray-400"}`}>
            <HomeIcon />
          </button>
          <button onClick={() => handleTabChange("smarttalk")} className={`p-2 ${activeTab === "smarttalk" ? "text-emerald-600" : "text-gray-400"}`}>
            <MessageSquareMore className="w-6 h-6" />
          </button>
          <button onClick={() => handleTabChange("exam")} className={`p-2 ${activeTab === "exam" ? "text-emerald-600" : "text-gray-400"}`}>
            <ExamIcon />
          </button>
          <button onClick={() => handleTabChange("profile")} className={`p-2 ${activeTab === "profile" ? "text-emerald-600" : "text-gray-400"}`}>
            <UserIcon />
          </button>
        </nav>
      </div>
    </HelmetProvider>
  );
}

function HomeIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>;
}
function ExamIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="m9 15 2 2 4-4"/></svg>;
}
function UserIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
}
