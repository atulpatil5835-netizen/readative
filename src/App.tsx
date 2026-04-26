import { HelmetProvider } from "react-helmet-async";
import { type ReactNode, Suspense, lazy, useEffect, useMemo, useState } from "react";
import { ExternalLink, Mail, MessageSquareMore, X } from "lucide-react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./firebase/firebase";
import { Header } from "./components/Header";
import { KnowledgeFeed } from "./components/KnowledgeFeed";
import {
  getKnowledgeIdentity,
  KNOWLEDGE_IDENTITY_EVENT,
  type KnowledgeIdentity,
} from "./utils/knowledgeIdentity";
import { UserNotification } from "./types";
import { ensureGuestProfile } from "./utils/userProfiles";

type Tab = "knowledge" | "smarttalk" | "profile";

const SmartTalk = lazy(() =>
  import("./components/SmartTalk").then((module) => ({
    default: module.SmartTalk,
  }))
);

const Profile = lazy(() =>
  import("./components/Profile").then((module) => ({
    default: module.Profile,
  }))
);

interface ParsedHash {
  tab: Tab;
  profileAuthorId: string | null;
  focusedEntryId: string | null;
}

function parseHash(): ParsedHash {
  const hash = window.location.hash.replace(/^#/, "");

  if (hash.startsWith("knowledge/")) {
    return {
      tab: "knowledge",
      profileAuthorId: null,
      focusedEntryId: decodeURIComponent(hash.slice("knowledge/".length)),
    };
  }

  if (hash.startsWith("profile/")) {
    return {
      tab: "profile",
      profileAuthorId: decodeURIComponent(hash.slice("profile/".length)),
      focusedEntryId: null,
    };
  }

  if (hash === "profile") {
    return {
      tab: "profile",
      profileAuthorId: null,
      focusedEntryId: null,
    };
  }

  if (hash === "smarttalk") {
    return {
      tab: "smarttalk",
      profileAuthorId: null,
      focusedEntryId: null,
    };
  }

  return {
    tab: "knowledge",
    profileAuthorId: null,
    focusedEntryId: null,
  };
}

function buildHash(
  tab: Tab,
  profileAuthorId: string | null = null,
  focusedEntryId: string | null = null
) {
  if (tab === "knowledge" && focusedEntryId) {
    return `knowledge/${encodeURIComponent(focusedEntryId)}`;
  }

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
  const [focusedEntryId, setFocusedEntryId] = useState<string | null>(
    initialRoute.focusedEntryId
  );
  const [identity, setIdentity] = useState<KnowledgeIdentity | null>(() =>
    getKnowledgeIdentity()
  );
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [composerOpenSignal, setComposerOpenSignal] = useState(0);
  const [showInfoPanel, setShowInfoPanel] = useState(false);

  const handleTabChange = (
    tab: Tab,
    nextProfileAuthorId: string | null = null,
    nextFocusedEntryId: string | null = null
  ) => {
    setActiveTab(tab);
    setProfileAuthorId(tab === "profile" ? nextProfileAuthorId : null);
    setFocusedEntryId(tab === "knowledge" ? nextFocusedEntryId : null);
    setShowInfoPanel(false);
    window.location.hash = buildHash(tab, nextProfileAuthorId, nextFocusedEntryId);
  };

  const handleOpenProfile = (authorId: string) => {
    handleTabChange("profile", authorId);
  };

  const handleOpenEntry = (entryId: string) => {
    handleTabChange("knowledge", null, entryId);
  };

  const handleOpenComposer = () => {
    if (activeTab !== "knowledge") {
      handleTabChange("knowledge");
    }

    setShowInfoPanel(false);
    setComposerOpenSignal((current) => current + 1);
  };

  useEffect(() => {
    const onHashChange = () => {
      const route = parseHash();
      setActiveTab(route.tab);
      setProfileAuthorId(route.profileAuthorId);
      setFocusedEntryId(route.focusedEntryId);
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
    if (!identity?.authorId || !identity.displayName) return;

    void ensureGuestProfile(identity.displayName, identity.authorId).catch((error) => {
      console.error("Failed to sync local profile:", error);
    });
  }, [identity?.authorId, identity?.displayName]);

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
          setActiveTab={(tab) => handleTabChange(tab)}
          unreadNotificationCount={unreadNotificationCount}
          onOpenComposer={handleOpenComposer}
          onOpenInfo={() => setShowInfoPanel((current) => !current)}
        />

        <main className="mx-auto max-w-2xl px-4 pb-24 pt-20">
          {activeTab === "knowledge" && (
            <KnowledgeFeed
              identity={identity}
              onIdentityChange={setIdentity}
              onOpenProfile={handleOpenProfile}
              focusedEntryId={focusedEntryId}
              onOpenEntry={handleOpenEntry}
              composerOpenSignal={composerOpenSignal}
            />
          )}
          {activeTab === "smarttalk" && (
            <Suspense fallback={<SectionSkeleton label="Loading SmartTalk..." />}>
              <SmartTalk />
            </Suspense>
          )}
          {activeTab === "profile" && (
            <Suspense fallback={<SectionSkeleton label="Loading profile..." />}>
              <Profile
                currentIdentity={identity}
                viewedAuthorId={profileAuthorId}
                onIdentityChange={setIdentity}
                onOpenProfile={handleOpenProfile}
                onOpenEntry={handleOpenEntry}
              />
            </Suspense>
          )}
        </main>

        {showInfoPanel && <InfoPanel onClose={() => setShowInfoPanel(false)} />}

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

function InfoPanel({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[60] bg-slate-950/20 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <aside
        onClick={(event) => event.stopPropagation()}
        className="absolute right-4 top-20 w-[min(92vw,360px)] rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_20px_70px_rgba(15,23,42,0.16)]"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-500">
              Contact Info
            </p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
              Readative details
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <InfoRow
            icon={<ExternalLink className="h-4 w-4" />}
            label="LinkedIn Page"
            value="Innovation InfoHub"
            href="https://www.linkedin.com/company/innovation-infohub/"
          />
          <InfoRow
            icon={<Mail className="h-4 w-4" />}
            label="Support Email"
            value="reader@readative.com"
            href="mailto:reader@readative.com"
          />
          <InfoRow
            icon={<ExternalLink className="h-4 w-4" />}
            label="Creator"
            value="Atul Hinge"
            href="https://www.linkedin.com/in/atul-hinge-304aab155/"
          />
        </div>
      </aside>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
  href,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  href: string;
}) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noreferrer" : undefined}
      className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 transition-colors hover:border-emerald-200 hover:bg-emerald-50/60"
    >
      <div className="mt-0.5 rounded-full bg-white p-2 text-emerald-700 shadow-sm">
        {icon}
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
          {label}
        </p>
        <p className="mt-1 text-sm font-semibold text-slate-900">{value}</p>
      </div>
    </a>
  );
}

function SectionSkeleton({ label }: { label: string }) {
  return (
    <div className="rounded-[32px] border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
      <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
      <p className="mt-4 text-sm text-slate-400">{label}</p>
    </div>
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
