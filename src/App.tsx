import { HelmetProvider } from "react-helmet-async";
import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { HighlightsProvider } from "./context/HighlightsContext";
import {
  CirclePlus,
  Compass,
  Home,
  LogOut,
  MessageSquareMore,
  UserRound,
  X,
} from "lucide-react";
import { Header } from "./components/Header";
import {
  AppFooter,
  BannerNotice,
  FirebaseSetupRoute,
  NotFoundRoute,
  SectionSkeleton,
} from "./components/AppShell";
import { GoogleSignInPrompt } from "./components/Auth";
import {
  getKnowledgeIdentity,
  KNOWLEDGE_IDENTITY_EVENT,
  type KnowledgeIdentity,
} from "./utils/knowledgeIdentity";
import {
  signInWithGoogleAccount,
  signOutGoogleAccount,
  subscribeToGoogleIdentity,
} from "./utils/googleAuth";
import {
  db,
  firebaseConfigMissingKeys,
  firebaseConfigReady,
} from "./firebase/firebase";
import type { UserNotification } from "./types";
import {
  navigateToRoute,
  parseRouteFromLocation,
  ROUTE_CHANGE_EVENT,
  type AppTab,
} from "./utils/routes";
import { trackPageView } from "./utils/analytics";
import type { InfoSection } from "./components/AppPanels";

const KnowledgeFeed = lazy(() =>
  import("./components/KnowledgeFeed").then((module) => ({
    default: module.KnowledgeFeed,
  }))
);

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

const Explore = lazy(() =>
  import("./components/Explore").then((module) => ({
    default: module.Explore,
  }))
);

const InfoPanel = lazy(() =>
  import("./components/AppPanels").then((module) => ({
    default: module.InfoPanel,
  }))
);

const NotificationsPanel = lazy(() =>
  import("./components/AppPanels").then((module) => ({
    default: module.NotificationsPanel,
  }))
);

const NOTIFICATION_REALTIME_LIMIT = 20;
const NOTIFICATION_FALLBACK_LIMIT = 60;

export default function App() {
  const initialRoute = useMemo(parseRouteFromLocation, []);
  const [activeTab, setActiveTab] = useState<AppTab | "notFound">(initialRoute.tab);
  const [profileAuthorId, setProfileAuthorId] = useState<string | null>(
    initialRoute.profileAuthorId
  );
  const [focusedEntryId, setFocusedEntryId] = useState<string | null>(
    initialRoute.focusedEntryId
  );
  const [exploreTopic, setExploreTopic] = useState<string | null>(
    initialRoute.tab === "explore" ? initialRoute.selectedTopic : null,
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
  const [infoPanelSection, setInfoPanelSection] =
    useState<InfoSection>("about");
  const [showNotificationsPanel, setShowNotificationsPanel] = useState(false);
  const [homeRefreshSignal, setHomeRefreshSignal] = useState(0);
  const [showGoogleSignInPrompt, setShowGoogleSignInPrompt] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [authStatusMessage, setAuthStatusMessage] = useState<string | null>(null);

  const syncRouteState = useCallback(() => {
    const route = parseRouteFromLocation();
    setActiveTab(route.tab);
    setProfileAuthorId(route.tab === "profile" ? route.profileAuthorId : null);
    setFocusedEntryId(route.tab === "knowledge" ? route.focusedEntryId : null);
    setExploreTopic(route.tab === "explore" ? route.selectedTopic : null);
    setRouteErrorPath(route.tab === "notFound" ? route.attemptedLocation : null);
  }, []);

  const handleTabChange = useCallback((
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
  }, []);

  const handleOpenProfile = useCallback((authorId: string) => {
    handleTabChange("profile", authorId);
  }, [handleTabChange]);

  const handleOpenEntry = useCallback((entryId: string) => {
    handleTabChange("knowledge", null, entryId);
  }, [handleTabChange]);

  const handleOpenTopic = useCallback((topicId: string | null) => {
    setShowInfoPanel(false);
    setShowNotificationsPanel(false);
    navigateToRoute("explore", { selectedTopic: topicId });
  }, []);

  const handleHomeAction = useCallback(() => {
    setShowInfoPanel(false);
    setShowNotificationsPanel(false);

    const route = parseRouteFromLocation();
    const alreadyOnBaseHome =
      route.tab === "knowledge" &&
      !route.focusedEntryId &&
      !route.selectedHashtag &&
      !route.selectedTopic;

    if (!alreadyOnBaseHome) {
      navigateToRoute("knowledge");
      return;
    }

    setHomeRefreshSignal((current) => current + 1);
  }, []);

  const handleOpenComposer = useCallback(() => {
    if (activeTab !== "knowledge") {
      handleTabChange("knowledge");
    }

    setShowInfoPanel(false);
    setShowNotificationsPanel(false);
    setComposerOpenSignal((current) => current + 1);
  }, [activeTab, handleTabChange]);

  const handleOpenNotifications = useCallback(() => {
    setShowInfoPanel(false);
    setShowNotificationsPanel((current) => !current);
  }, []);

  const handleOpenInfoPanel = useCallback((section: InfoSection = "about") => {
    setInfoPanelSection(section);
    setShowNotificationsPanel(false);
    setShowInfoPanel(true);
  }, []);
  const handleOpenAboutPanel = useCallback(() => {
    handleOpenInfoPanel("about");
  }, [handleOpenInfoPanel]);
  const handleOpenSignInPrompt = useCallback(() => {
    setShowGoogleSignInPrompt(true);
  }, []);

  const handleGoogleSignIn = useCallback(async () => {
    const nextIdentity = await signInWithGoogleAccount();
    setIdentity(nextIdentity);
    setAuthStatusMessage(null);
    setShowGoogleSignInPrompt(false);
  }, []);

  const handleGoogleSignOut = useCallback(async () => {
    await signOutGoogleAccount();
    setIdentity(null);
    setShowNotificationsPanel(false);
    setUnreadNotificationCount(0);
    setNotifications([]);
  }, []);
  const handleHeaderSignOut = useCallback(() => {
    setShowSignOutConfirm(true);
  }, []);
  const handleConfirmSignOut = useCallback(async () => {
    await handleGoogleSignOut();
    setShowSignOutConfirm(false);
  }, [handleGoogleSignOut]);

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
            selectedTopic: route.selectedTopic,
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
  }, [syncRouteState]);

  useEffect(() => {
    trackPageView();
  }, [activeTab, profileAuthorId, focusedEntryId, exploreTopic, routeErrorPath]);

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
    if (!firebaseConfigReady || !identity?.authorId) {
      setNotifications([]);
      setUnreadNotificationCount(0);
      setNotificationsError(null);
      return;
    }

    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    void import("firebase/firestore")
      .then((firestore) => {
        if (cancelled) {
          return;
        }

        const applyNotificationSnapshot = (snapshot: {
          docs: Array<{
            id: string;
            data: () => unknown;
          }>;
        }) => {
          const nextNotifications = snapshot.docs
            .map((item) => {
              const data = item.data() as UserNotification;
              return {
                id: item.id,
                ...data,
                createdAt: data.createdAt || Date.now(),
              };
            })
            .sort((left, right) => right.createdAt - left.createdAt)
            .slice(0, NOTIFICATION_REALTIME_LIMIT);

          const unread = nextNotifications.filter(
            (notification) => !notification.read
          ).length;

          setNotifications(nextNotifications);
          setUnreadNotificationCount(unread);
          setNotificationsError(null);
        };

        const startBasicNotificationListener = () => {
          const basicNotificationsQuery = firestore.query(
            firestore.collection(db, "notifications"),
            firestore.where("targetAuthorId", "==", identity.authorId),
            firestore.limit(NOTIFICATION_FALLBACK_LIMIT)
          );

          unsubscribe = firestore.onSnapshot(
            basicNotificationsQuery,
            applyNotificationSnapshot,
            (error) => {
              console.error("Notifications fallback listener error:", error);
              setNotifications([]);
              setUnreadNotificationCount(0);
              setNotificationsError(
                "Realtime notifications are temporarily unavailable. Please refresh in a moment."
              );
            }
          );
        };

        const orderedNotificationsQuery = firestore.query(
          firestore.collection(db, "notifications"),
          firestore.where("targetAuthorId", "==", identity.authorId),
          firestore.orderBy("createdAt", "desc"),
          firestore.limit(NOTIFICATION_REALTIME_LIMIT)
        );

        unsubscribe = firestore.onSnapshot(
          orderedNotificationsQuery,
          applyNotificationSnapshot,
          (error) => {
            const message =
              error instanceof Error ? error.message.toLowerCase() : "";
            const code =
              typeof error === "object" && error && "code" in error
                ? String((error as { code?: unknown }).code).toLowerCase()
                : "";
            const needsIndex =
              code === "failed-precondition" ||
              message.includes("index") ||
              message.includes("requires an index");

            if (needsIndex && !cancelled) {
              console.warn(
                "Notifications ordered listener needs an index; using limited fallback listener.",
                error
              );
              unsubscribe?.();
              startBasicNotificationListener();
              return;
            }

            console.error("Notifications listener error:", error);
            setNotifications([]);
            setUnreadNotificationCount(0);
            setNotificationsError(
              "Realtime notifications are temporarily unavailable. Please refresh in a moment."
            );
          }
        );
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        console.error("Notifications setup error:", error);
        setNotifications([]);
        setUnreadNotificationCount(0);
        setNotificationsError(
          "Realtime notifications are temporarily unavailable. Please refresh in a moment."
        );
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [identity?.authorId]);

  useEffect(() => {
    return subscribeToGoogleIdentity(
      (nextIdentity) => {
        setIdentity(nextIdentity);
        setAuthStatusMessage(null);
      },
      (message) => setAuthStatusMessage(message),
    );
  }, []);

  return (
    <HelmetProvider>
      <HighlightsProvider identity={identity}>
        <div className="min-h-screen bg-[#f7f8fb] font-sans text-slate-950">
        <Header
          activeTab={activeTab}
          setActiveTab={handleTabChange}
          identity={identity}
          onHomeAction={handleHomeAction}
          unreadNotificationCount={unreadNotificationCount}
          onOpenComposer={handleOpenComposer}
          onOpenNotifications={handleOpenNotifications}
          onOpenInfo={handleOpenInfoPanel}
          onOpenSignIn={handleOpenSignInPrompt}
          onSignOut={handleHeaderSignOut}
        />

        <main className="mx-auto max-w-3xl px-3 pb-28 pt-20 sm:px-4">
          {notificationsError && (
            <BannerNotice
              title="Notifications unavailable"
              body={notificationsError}
              tone="warning"
            />
          )}

          {authStatusMessage && (
            <BannerNotice
              title="Google sign-in issue"
              body={authStatusMessage}
              tone="warning"
            />
          )}

          {!firebaseConfigReady ? (
            <FirebaseSetupRoute missingKeys={firebaseConfigMissingKeys} />
          ) : activeTab === "notFound" ? (
            <NotFoundRoute
              attemptedPath={routeErrorPath}
              onGoHome={() => handleTabChange("knowledge")}
              onOpenSmartTalk={() => handleTabChange("smarttalk")}
            />
          ) : (
            <div
              className={activeTab === "knowledge" ? undefined : "hidden"}
              aria-hidden={activeTab !== "knowledge"}
            >
              <Suspense fallback={<SectionSkeleton label="Loading home feed..." />}>
                <KnowledgeFeed
                  identity={identity}
                  onIdentityChange={setIdentity}
                  onOpenProfile={handleOpenProfile}
                  focusedEntryId={focusedEntryId}
                  onOpenEntry={handleOpenEntry}
                  composerOpenSignal={composerOpenSignal}
                  refreshSignal={homeRefreshSignal}
                  isActive={activeTab === "knowledge"}
                />
              </Suspense>
            </div>
          )}
          {firebaseConfigReady && activeTab === "smarttalk" && (
            <Suspense fallback={<SectionSkeleton label="Loading SmartTalk..." />}>
              <SmartTalk
                currentIdentity={identity}
                onIdentityChange={setIdentity}
              />
            </Suspense>
          )}
          {firebaseConfigReady && activeTab === "profile" && (
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
          {firebaseConfigReady && activeTab === "explore" && (
            <Suspense fallback={<SectionSkeleton label="Loading Explore..." />}>
              <Explore
                currentIdentity={identity}
                selectedTopic={exploreTopic}
                onOpenProfile={handleOpenProfile}
                onOpenEntry={handleOpenEntry}
                onOpenTopic={handleOpenTopic}
                onOpenSmartTalk={() => handleTabChange("smarttalk")}
              />
            </Suspense>
          )}
        </main>

        <AppFooter onOpenInfo={handleOpenInfoPanel} />

        {showInfoPanel && (
          <Suspense fallback={null}>
            <InfoPanel
              initialSection={infoPanelSection}
              onClose={() => setShowInfoPanel(false)}
            />
          </Suspense>
        )}
        {showNotificationsPanel && (
          <Suspense fallback={null}>
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
              onOpenSmartTalk={() => {
                setShowNotificationsPanel(false);
                handleTabChange("smarttalk");
              }}
            />
          </Suspense>
        )}

        {showSignOutConfirm && (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="sign-out-title"
              className="relative w-full max-w-sm rounded-[26px] border border-slate-200 bg-white p-5 shadow-2xl"
            >
              <button
                type="button"
                onClick={() => setShowSignOutConfirm(false)}
                className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close sign out confirmation"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="mb-4 inline-flex rounded-2xl bg-rose-50 p-3 text-rose-600">
                <LogOut className="h-6 w-6" />
              </div>
              <h2
                id="sign-out-title"
                className="pr-8 text-2xl font-black tracking-normal text-slate-950"
              >
                Sign out of Readative?
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Your profile, posts and activity remain safe.
              </p>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setShowSignOutConfirm(false)}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleConfirmSignOut();
                  }}
                  className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-rose-700"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        )}

        {showGoogleSignInPrompt && (
          <GoogleSignInPrompt
            onConfirm={handleGoogleSignIn}
            onClose={() => setShowGoogleSignInPrompt(false)}
          />
        )}

        <nav
          className="fixed bottom-0 left-0 right-0 z-50 grid grid-cols-5 border-t border-slate-200 bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-[0_-12px_36px_rgba(15,23,42,0.08)] backdrop-blur md:hidden"
          aria-label="Primary mobile navigation"
        >
          <button
            onClick={handleHomeAction}
            className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-black transition-colors ${
              activeTab === "knowledge"
                ? "bg-emerald-50 text-emerald-700"
                : "text-slate-400 hover:bg-slate-50 hover:text-slate-700"
            }`}
            aria-label="Home"
          >
            <Home className="h-5 w-5" />
            <span>Home</span>
          </button>
          <button
            onClick={() => handleTabChange("smarttalk")}
            className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-black transition-colors ${
              activeTab === "smarttalk"
                ? "bg-indigo-50 text-indigo-700"
                : "text-slate-400 hover:bg-slate-50 hover:text-slate-700"
            }`}
            aria-label="SmartTalk"
          >
            <MessageSquareMore className="h-5 w-5" />
            <span>SmartTalk</span>
          </button>
          <button
            onClick={handleOpenComposer}
            className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg bg-slate-950 text-[11px] font-black text-white shadow-[0_10px_24px_rgba(15,23,42,0.2)] transition-colors hover:bg-emerald-700"
            aria-label="Create"
          >
            <CirclePlus className="h-5 w-5" />
            <span>Create</span>
          </button>
          <button
            onClick={() => handleTabChange("explore")}
            className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-black transition-colors ${
              activeTab === "explore"
                ? "bg-sky-50 text-sky-700"
                : "text-slate-400 hover:bg-slate-50 hover:text-slate-700"
            }`}
            aria-label="Explore"
          >
            <Compass className="h-5 w-5" />
            <span>Explore</span>
          </button>
          <button
            onClick={() => handleTabChange("profile")}
            className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-black transition-colors ${
              activeTab === "profile"
                ? "bg-emerald-50 text-emerald-700"
                : "text-slate-400 hover:bg-slate-50 hover:text-slate-700"
            }`}
            aria-label="Profile"
          >
            <UserRound className="h-5 w-5" />
            <span>Profile</span>
          </button>
        </nav>
      </div>
      </HighlightsProvider>
    </HelmetProvider>
  );
}

