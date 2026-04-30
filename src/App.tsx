import { HelmetProvider } from "react-helmet-async";
import { type ReactNode, Suspense, lazy, useEffect, useMemo, useState } from "react";
import {
  AtSign,
  Bell,
  Heart,
  Linkedin,
  Mail,
  MessageCircle,
  MessageSquareMore,
  ShieldCheck,
  TriangleAlert,
  X,
} from "lucide-react";
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
import {
  markNotificationAsRead,
  markNotificationsAsRead,
} from "./utils/notifications";
import {
  navigateToRoute,
  parseRouteFromLocation,
  ROUTE_CHANGE_EVENT,
  type AppTab,
} from "./utils/routes";
import { ensureGuestProfile } from "./utils/userProfiles";
import { trackPageView } from "./utils/analytics";

type InfoSection = "about" | "contact" | "privacy";

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

export default function App() {
  const initialRoute = useMemo(parseRouteFromLocation, []);
  const [activeTab, setActiveTab] = useState<AppTab | "notFound">(initialRoute.tab);
  const [profileAuthorId, setProfileAuthorId] = useState<string | null>(
    initialRoute.profileAuthorId
  );
  const [focusedEntryId, setFocusedEntryId] = useState<string | null>(
    initialRoute.focusedEntryId
  );
  const [routeErrorPath, setRouteErrorPath] = useState<string | null>(
    initialRoute.tab === "notFound" ? initialRoute.attemptedLocation : null
  );
  const [identity, setIdentity] = useState<KnowledgeIdentity | null>(() =>
    getKnowledgeIdentity()
  );
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [composerOpenSignal, setComposerOpenSignal] = useState(0);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [showNotificationsPanel, setShowNotificationsPanel] = useState(false);

  const syncRouteState = () => {
    const route = parseRouteFromLocation();
    setActiveTab(route.tab);
    setProfileAuthorId(route.tab === "profile" ? route.profileAuthorId : null);
    setFocusedEntryId(route.tab === "knowledge" ? route.focusedEntryId : null);
    setRouteErrorPath(route.tab === "notFound" ? route.attemptedLocation : null);
  };

  const handleTabChange = (
    tab: AppTab,
    nextProfileAuthorId: string | null = null,
    nextFocusedEntryId: string | null = null
  ) => {
    setShowInfoPanel(false);
    setShowNotificationsPanel(false);
    navigateToRoute(tab, {
      profileAuthorId: nextProfileAuthorId,
      focusedEntryId: nextFocusedEntryId,
    });
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
    setShowNotificationsPanel(false);
    setComposerOpenSignal((current) => current + 1);
  };

  const handleOpenNotifications = () => {
    setShowInfoPanel(false);
    setShowNotificationsPanel((current) => !current);
  };

  useEffect(() => {
    const syncAndNormalizeRoute = () => {
      const route = parseRouteFromLocation();

      if (route.source === "hash" && route.tab !== "notFound") {
        navigateToRoute(
          route.tab,
          {
            profileAuthorId: route.profileAuthorId,
            focusedEntryId: route.focusedEntryId,
            selectedHashtag: route.selectedHashtag,
          },
          "replace"
        );
        return;
      }

      syncRouteState();
    };

    syncAndNormalizeRoute();
    window.addEventListener("hashchange", syncAndNormalizeRoute);
    window.addEventListener("popstate", syncAndNormalizeRoute);
    window.addEventListener(ROUTE_CHANGE_EVENT, syncAndNormalizeRoute);

    return () => {
      window.removeEventListener("hashchange", syncAndNormalizeRoute);
      window.removeEventListener("popstate", syncAndNormalizeRoute);
      window.removeEventListener(ROUTE_CHANGE_EVENT, syncAndNormalizeRoute);
    };
  }, []);

  useEffect(() => {
    trackPageView();
  }, [activeTab, profileAuthorId, focusedEntryId, routeErrorPath]);

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
      setNotifications([]);
      setUnreadNotificationCount(0);
      setNotificationsError(null);
      return;
    }

    const notificationsQuery = query(
      collection(db, "notifications"),
      where("targetAuthorId", "==", identity.authorId)
    );

    const unsubscribe = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        const nextNotifications = snapshot.docs
          .map((item) => ({
            id: item.id,
            ...(item.data() as UserNotification),
            createdAt: (item.data() as UserNotification).createdAt || Date.now(),
          }))
          .sort((left, right) => right.createdAt - left.createdAt);

        const unread = nextNotifications.filter((notification) => !notification.read).length;

        setNotifications(nextNotifications);
        setUnreadNotificationCount(unread);
        setNotificationsError(null);
      },
      (error) => {
        console.error("Notifications listener error:", error);
        setNotifications([]);
        setUnreadNotificationCount(0);
        setNotificationsError(
          "Realtime notifications are temporarily unavailable. Please refresh in a moment."
        );
      }
    );

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
          onOpenNotifications={handleOpenNotifications}
          onOpenInfo={() => {
            setShowNotificationsPanel(false);
            setShowInfoPanel((current) => !current);
          }}
        />

        <main className="mx-auto max-w-2xl px-4 pb-24 pt-20">
          {notificationsError && (
            <BannerNotice
              title="Notifications unavailable"
              body={notificationsError}
              tone="warning"
            />
          )}

          {activeTab === "notFound" ? (
            <NotFoundRoute
              attemptedPath={routeErrorPath}
              onGoHome={() => handleTabChange("knowledge")}
              onOpenSmartTalk={() => handleTabChange("smarttalk")}
            />
          ) : activeTab === "knowledge" ? (
            <KnowledgeFeed
              identity={identity}
              onIdentityChange={setIdentity}
              onOpenProfile={handleOpenProfile}
              focusedEntryId={focusedEntryId}
              onOpenEntry={handleOpenEntry}
              composerOpenSignal={composerOpenSignal}
            />
          ) : null}
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
        {showNotificationsPanel && (
          <NotificationsPanel
            identity={identity}
            notifications={notifications}
            unreadNotificationCount={unreadNotificationCount}
            notificationsError={notificationsError}
            onClose={() => setShowNotificationsPanel(false)}
            onOpenProfile={(authorId) => {
              setShowNotificationsPanel(false);
              handleOpenProfile(authorId);
            }}
            onOpenEntry={(entryId) => {
              setShowNotificationsPanel(false);
              handleOpenEntry(entryId);
            }}
          />
        )}

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
  const [activeSection, setActiveSection] = useState<InfoSection>("about");

  return (
    <div
      className="fixed inset-0 z-[60] bg-slate-950/20 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <aside
        onClick={(event) => event.stopPropagation()}
        className="absolute right-4 top-20 flex w-[min(92vw,390px)] max-h-[min(78vh,720px)] flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_70px_rgba(15,23,42,0.16)]"
      >
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-950 via-emerald-900 to-teal-700 px-6 py-6 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-200">
                Readative Info
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-tight">
                About, contact, and privacy
              </h2>
              <p className="mt-2 text-sm text-emerald-50">
                Open the section you need from the buttons below.
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-full bg-white/10 p-2 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <InfoSectionButton
              active={activeSection === "about"}
              label="About Us"
              onClick={() => setActiveSection("about")}
            />
            <InfoSectionButton
              active={activeSection === "contact"}
              label="Contact Us"
              onClick={() => setActiveSection("contact")}
            />
            <InfoSectionButton
              active={activeSection === "privacy"}
              label="Privacy Policy"
              onClick={() => setActiveSection("privacy")}
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          {activeSection === "about" && (
            <div className="space-y-6">
              <div className="rounded-[24px] border border-emerald-200 bg-emerald-50/70 px-5 py-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                  About Us
                </p>
                <p className="mt-3 text-sm leading-6 text-slate-700">
                  Readative is a knowledge-first community designed for useful
                  ideas, thoughtful learning posts, and SmartTalk discussions that
                  stay educational and practical.
                </p>
                <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/80 bg-white px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Company LinkedIn
                    </p>
                    <p className="text-xs text-slate-500">
                      Innovation InfoHub
                    </p>
                  </div>
                  <IconOnlyLink
                    href="https://www.linkedin.com/company/innovation-infohub/"
                    label="Open company LinkedIn page"
                    icon={<Linkedin className="h-4 w-4" />}
                  />
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                  Creator
                </p>
                <p className="mt-3 text-2xl font-black tracking-tight text-slate-950">
                  Atul Hinge
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Founder and creator of Readative.
                </p>
                <div className="mt-4">
                  <IconOnlyLink
                    href="https://www.linkedin.com/in/atul-hinge-304aab155/"
                    label="Open creator LinkedIn profile"
                    icon={<Linkedin className="h-4 w-4" />}
                  />
                </div>
              </div>
            </div>
          )}

          {activeSection === "contact" && (
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                Contact Us
              </p>
              <a
                href="mailto:reader@readative.com"
                className="mt-4 flex items-center gap-3 rounded-2xl border border-white bg-white px-4 py-4 text-slate-900 transition-colors hover:border-emerald-200 hover:bg-emerald-50/70"
              >
                <span className="rounded-full bg-emerald-100 p-2 text-emerald-700">
                  <Mail className="h-4 w-4" />
                </span>
                <span className="text-sm font-semibold">reader@readative.com</span>
              </a>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                Use this email for support, business questions, creator contact,
                or privacy requests.
              </p>
            </div>
          )}

          {activeSection === "privacy" && (
            <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5">
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-emerald-100 p-2 text-emerald-700">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                    Privacy Policy
                  </p>
                  <p className="text-sm text-slate-600">
                    Key platform and advertising policies
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-4 text-sm leading-6 text-slate-700">
                <PolicyBlock
                  title="Information we store"
                  body="Readative may store usernames, posts, comments, likes, notifications, and basic usage information needed to run the community experience."
                />
                <PolicyBlock
                  title="Google cookies for ads"
                  body="Readative uses Google cookies and related advertising technology for ads and monetization. Google and its partners may use cookies to serve and personalize ads based on your visits to this site and other websites."
                />
                <PolicyBlock
                  title="No copyrighted content without permission"
                  body="Users should only upload or publish content they own or have permission to share. Copyrighted material, spam, abusive content, and sexual content are not allowed on the platform."
                />
                <PolicyBlock
                  title="Third-party services"
                  body="When you open LinkedIn, Google, or other outside services from Readative, those services apply their own privacy practices and terms."
                />
                <PolicyBlock
                  title="Updates and contact"
                  body="These policies may be updated as Readative grows. For privacy or policy questions, contact reader@readative.com."
                />
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function NotificationsPanel({
  identity,
  notifications,
  unreadNotificationCount,
  notificationsError,
  onClose,
  onOpenProfile,
  onOpenEntry,
}: {
  identity: KnowledgeIdentity | null;
  notifications: UserNotification[];
  unreadNotificationCount: number;
  notificationsError: string | null;
  onClose: () => void;
  onOpenProfile: (authorId: string) => void;
  onOpenEntry: (entryId: string) => void;
}) {
  const [panelError, setPanelError] = useState<string | null>(null);

  const openNotification = async (notification: UserNotification) => {
    setPanelError(null);

    try {
      if (!notification.read) {
        await markNotificationAsRead(notification.id);
      }

      onOpenEntry(notification.entryId);
    } catch (error) {
      console.error("Failed to open notification:", error);
      setPanelError("Could not open that notification right now. Please try again.");
    }
  };

  const markAllRead = async () => {
    setPanelError(null);

    try {
      await markNotificationsAsRead(notifications.map((notification) => notification.id));
    } catch (error) {
      console.error("Failed to mark notifications as read:", error);
      setPanelError("Could not mark notifications as read right now.");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-slate-950/20 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <aside
        onClick={(event) => event.stopPropagation()}
        className="absolute right-4 top-20 w-[min(92vw,390px)] overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_70px_rgba(15,23,42,0.16)]"
      >
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-950 via-emerald-900 to-teal-700 px-6 py-6 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-emerald-200">
                Realtime Alerts
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-tight">
                Notifications
              </h2>
              <p className="mt-2 text-sm text-emerald-50">
                {identity
                  ? unreadNotificationCount === 0
                    ? `@${identity.displayName}, you are all caught up.`
                    : `@${identity.displayName}, ${unreadNotificationCount} unread updates are waiting.`
                  : "Choose a username once to start receiving alerts."}
              </p>
            </div>
            <button
              onClick={onClose}
              className="rounded-full bg-white/10 p-2 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {identity && notifications.length > 0 && (
            <button
              onClick={() => void markAllRead()}
              disabled={unreadNotificationCount === 0}
              className="mt-4 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-white transition-colors hover:bg-white/15 disabled:opacity-40"
            >
              Mark all read
            </button>
          )}
        </div>

        <div className="max-h-[65vh] overflow-y-auto">
          {(notificationsError || panelError) && (
            <div className="border-b border-amber-100 bg-amber-50 px-6 py-4 text-sm text-amber-700">
              {panelError || notificationsError}
            </div>
          )}

          {!identity ? (
            <div className="px-6 py-8 text-sm text-slate-500">
              Post, like, or comment once with your username and your realtime
              notifications will appear here.
            </div>
          ) : notifications.length === 0 ? (
            <div className="px-6 py-8 text-sm text-slate-500">
              No notifications yet. Likes, comments, and tags will appear here in realtime.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="flex items-start justify-between gap-4 px-6 py-4 transition-colors hover:bg-slate-50"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-1 rounded-2xl p-2 ${
                        notification.type === "like"
                          ? "bg-rose-100 text-rose-600"
                          : notification.type === "comment"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-cyan-100 text-cyan-700"
                      }`}
                    >
                      {notification.type === "like" ? (
                        <Heart className="h-4 w-4" />
                      ) : notification.type === "comment" ? (
                        <MessageCircle className="h-4 w-4" />
                      ) : (
                        <AtSign className="h-4 w-4" />
                      )}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => onOpenProfile(notification.actorAuthorId)}
                          className="text-sm font-bold text-slate-900 transition-colors hover:text-emerald-700"
                        >
                          @{notification.actorUsername}
                        </button>
                        {!notification.read && (
                          <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white">
                            New
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        {notification.preview}
                      </p>
                      <p className="mt-2 text-xs text-slate-400">
                        {new Date(notification.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => void openNotification(notification)}
                    className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700 transition-colors hover:bg-emerald-50"
                  >
                    Open
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function InfoSectionButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl px-3 py-3 text-xs font-bold uppercase tracking-[0.14em] transition-colors ${
        active
          ? "bg-white text-emerald-800"
          : "bg-white/10 text-white/85 hover:bg-white/20"
      }`}
    >
      {label}
    </button>
  );
}

function IconOnlyLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      title={label}
      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 transition-colors hover:bg-emerald-100"
    >
      {icon}
    </a>
  );
}

function PolicyBlock({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-white bg-white px-4 py-4">
      <p className="text-sm font-bold text-slate-900">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{body}</p>
    </div>
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

function BannerNotice({
  title,
  body,
  tone = "warning",
}: {
  title: string;
  body: string;
  tone?: "warning" | "neutral";
}) {
  return (
    <div
      className={`mb-6 rounded-[24px] border px-5 py-4 text-sm shadow-sm ${
        tone === "warning"
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : "border-slate-200 bg-white text-slate-700"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 rounded-full p-2 ${
            tone === "warning"
              ? "bg-amber-100 text-amber-700"
              : "bg-slate-100 text-slate-500"
          }`}
        >
          <TriangleAlert className="h-4 w-4" />
        </span>
        <div>
          <p className="font-bold">{title}</p>
          <p className="mt-1 leading-6">{body}</p>
        </div>
      </div>
    </div>
  );
}

function NotFoundRoute({
  attemptedPath,
  onGoHome,
  onOpenSmartTalk,
}: {
  attemptedPath: string | null;
  onGoHome: () => void;
  onOpenSmartTalk: () => void;
}) {
  return (
    <div className="rounded-[32px] border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-sm">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-700">
        <TriangleAlert className="h-8 w-8" />
      </div>
      <p className="mt-5 text-xs font-bold uppercase tracking-[0.22em] text-amber-600">
        Error 404
      </p>
      <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
        This page does not exist in Readative
      </h2>
      <p className="mt-3 text-sm leading-6 text-slate-500">
        {attemptedPath
          ? `We could not match ${attemptedPath} to a valid route.`
          : "We could not match that URL to a valid route."}
      </p>

      <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <button
          onClick={onGoHome}
          className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-700"
        >
          Go to home feed
        </button>
        <button
          onClick={onOpenSmartTalk}
          className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition-colors hover:border-emerald-200 hover:text-emerald-700"
        >
          Open SmartTalk
        </button>
      </div>
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
