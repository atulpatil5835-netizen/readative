import { HelmetProvider } from "react-helmet-async";
import { useEffect, useMemo, useState } from "react";
import { MessageSquareMore } from "lucide-react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./firebase/firebase";
import { Header } from "./components/Header";
import { KnowledgeFeed } from "./components/KnowledgeFeed";
import { SmartTalk } from "./components/SmartTalk";
import { Profile } from "./components/Profile";
import {
  getKnowledgeIdentity,
  KNOWLEDGE_IDENTITY_EVENT,
  type KnowledgeIdentity,
} from "./utils/knowledgeIdentity";
import { UserNotification } from "./types";

type Tab = "knowledge" | "smarttalk" | "profile";

interface ParsedHash {
  tab: Tab;
  profileAuthorId: string | null;
}

function parseHash(): ParsedHash {
  const hash = window.location.hash.replace(/^#/, "");

  if (hash.startsWith("profile/")) {
    return {
      tab: "profile",
      profileAuthorId: decodeURIComponent(hash.slice("profile/".length)),
    };
  }

  if (hash === "profile") {
    return {
      tab: "profile",
      profileAuthorId: null,
    };
  }

  if (hash === "smarttalk") {
    return {
      tab: "smarttalk",
      profileAuthorId: null,
    };
  }

  return {
    tab: "knowledge",
    profileAuthorId: null,
  };
}

function buildHash(tab: Tab, profileAuthorId: string | null = null) {
  if (tab === "profile" && profileAuthorId) {
    return `profile/${encodeURIComponent(profileAuthorId)}`;
  }

  return tab;
}

export default function App() {
  const initialRoute = useMemo(parseHash, []);
  const [activeTab, setActiveTab] = useState<Tab>(initialRoute.tab);
  const [profileAuthorId, setProfileAuthorId] = useState<string | null>(
    initialRoute.profileAuthorId
  );
  const [identity, setIdentity] = useState<KnowledgeIdentity | null>(() =>
    getKnowledgeIdentity()
  );
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);

  const handleTabChange = (tab: Tab, nextProfileAuthorId: string | null = null) => {
    setActiveTab(tab);
    setProfileAuthorId(tab === "profile" ? nextProfileAuthorId : null);
    window.location.hash = buildHash(tab, nextProfileAuthorId);
  };

  const handleOpenProfile = (authorId: string) => {
    handleTabChange("profile", authorId);
  };

  useEffect(() => {
    const onHashChange = () => {
      const route = parseHash();
      setActiveTab(route.tab);
      setProfileAuthorId(route.profileAuthorId);
    };

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    const syncIdentity = () => setIdentity(getKnowledgeIdentity());
    const handler = () => syncIdentity();

    window.addEventListener(KNOWLEDGE_IDENTITY_EVENT, handler);
    window.addEventListener("storage", syncIdentity);

    return () => {
      window.removeEventListener(KNOWLEDGE_IDENTITY_EVENT, handler);
      window.removeEventListener("storage", syncIdentity);
    };
  }, []);

  useEffect(() => {
    if (!identity?.authorId) {
      setUnreadNotificationCount(0);
      return;
    }

    const notificationsQuery = query(
      collection(db, "notifications"),
      where("targetAuthorId", "==", identity.authorId)
    );

    const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
      const unread = snapshot.docs
        .map((item) => item.data() as UserNotification)
        .filter((notification) => !notification.read).length;

      setUnreadNotificationCount(unread);
    });

    return () => unsubscribe();
  }, [identity?.authorId]);

  return (
    <HelmetProvider>
      <div className="min-h-screen bg-[#F5F5F0] font-sans text-[#1A1A1A]">
        <Header
          activeTab={activeTab}
          setActiveTab={handleTabChange}
          unreadNotificationCount={unreadNotificationCount}
        />

        <main className="mx-auto max-w-2xl px-4 pb-24 pt-20">
          {activeTab === "knowledge" && (
            <KnowledgeFeed
              identity={identity}
              onIdentityChange={setIdentity}
              onOpenProfile={handleOpenProfile}
            />
          )}
          {activeTab === "smarttalk" && <SmartTalk />}
          {activeTab === "profile" && (
            <Profile
              currentIdentity={identity}
              viewedAuthorId={profileAuthorId}
              onIdentityChange={setIdentity}
              onOpenProfile={handleOpenProfile}
            />
          )}
        </main>

        <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between border-t border-black/5 bg-white px-6 py-3 md:hidden">
          <button
            onClick={() => handleTabChange("knowledge")}
            className={`p-2 ${
              activeTab === "knowledge" ? "text-emerald-600" : "text-gray-400"
            }`}
          >
            <HomeIcon />
          </button>
          <button
            onClick={() => handleTabChange("smarttalk")}
            className={`p-2 ${
              activeTab === "smarttalk" ? "text-emerald-600" : "text-gray-400"
            }`}
          >
            <MessageSquareMore className="h-6 w-6" />
          </button>
          <button
            onClick={() => handleTabChange("profile")}
            className={`relative p-2 ${
              activeTab === "profile" ? "text-emerald-600" : "text-gray-400"
            }`}
          >
            <UserIcon />
            {unreadNotificationCount > 0 && (
              <span className="absolute right-0 top-0 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
              </span>
            )}
          </button>
        </nav>
      </div>
    </HelmetProvider>
  );
}

function HomeIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
