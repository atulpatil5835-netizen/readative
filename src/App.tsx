import { HelmetProvider } from "react-helmet-async";
import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { NotebookProvider } from "./context/NotebookContext";
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
  firebaseConfigMissingKeys,
  firebaseConfigReady,
} from "./firebase/firebaseConfig";
import type { UserNotification } from "./types";
import {
  navigateToRoute,
  parseRouteFromLocation,
  ROUTE_CHANGE_EVENT,
  type AppRouteTab,
  type AppTab,
} from "./utils/routes";
import type { LegalSlug } from "./content/legalRoutes";
import { trackPageView, trackLogin, trackLogout, setAnalyticsUser } from "./utils/analytics";
import { scheduleThirdPartyScripts } from "./utils/loadThirdPartyScripts";

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

const NotificationsPanel = lazy(() =>
  import("./components/NotificationsPanel").then((module) => ({
    default: module.NotificationsPanel,
  }))
);

const LegalPageRoute = lazy(() =>
  import("./components/LegalPageRoute").then((module) => ({
    default: module.LegalPageRoute,
  }))
);

const TrustConsent = lazy(() =>
  import("./components/TrustConsent").then((module) => ({
    default: module.TrustConsent,
  }))
);

const NOTIFICATION_REALTIME_LIMIT = 20;
const NOTIFICATION_FALLBACK_LIMIT = 60;
const COOKIE_CONSENT_STORAGE_KEY = "readativeCookieConsentVersion";
const COOKIE_CONSENT_VERSION = "2026-07-05.t1";
const NOTIFICATION_READ_POST_THRESHOLD = 3;

function hasAcceptedCookieConsent() {
  if (typeof window === "undefined") return true;

  try {
    return window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY) === COOKIE_CONSENT_VERSION;
  } catch {
    return false;
  }
}

export default function App() {
  const initialRoute = useMemo(parseRouteFromLocation, []);
  const [activeTab, setActiveTab] = useState<AppRouteTab>(initialRoute.tab);
  const [legalSlug, setLegalSlug] = useState<LegalSlug | null>(initialRoute.legalSlug);
  const [profileAuthorId, setProfileAuthorId] = useState<string | null>(
    initialRoute.profileAuthorId
  );
  const [profileUsername, setProfileUsername] = useState<string | null>(
    initialRoute.profileUsername
  );
  const [focusedEntryId, setFocusedEntryId] = useState<string | null>(
    initialRoute.focusedEntryId
  );
  const [exploreTopic, setExploreTopic] = useState<string | null>(
    initialRoute.tab === "explore" ? initialRoute.selectedTopic : null,
  );
  const [smartTalkCategory, setSmartTalkCategory] = useState<string | null>(
    initialRoute.tab === "smarttalk" ? initialRoute.selectedTopic : null
  );
  const [focusedQuestionId, setFocusedQuestionId] = useState<string | null>(
    initialRoute.tab === "smarttalk" ? initialRoute.focusedEntryId : null
  );
  const [routeErrorPath, setRouteErrorPath] = useState<string | null>(
    initialRoute.tab === "notFound" ? initialRoute.attemptedLocation : null
  );
  const [identity, setIdentity] = useState<KnowledgeIdentity | null>(() =>
    getKnowledgeIdentity()
  );
  const [isIdentityHydrated, setIsIdentityHydrated] = useState(
    !firebaseConfigReady,
  );
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [composerOpenSignal, setComposerOpenSignal] = useState(0);
  const [showNotificationsPanel, setShowNotificationsPanel] = useState(false);
  const [homeRefreshSignal, setHomeRefreshSignal] = useState(0);
  const [showGoogleSignInPrompt, setShowGoogleSignInPrompt] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [authStatusMessage, setAuthStatusMessage] = useState<string | null>(null);
  const [cookieConsentAccepted, setCookieConsentAccepted] = useState(
    hasAcceptedCookieConsent,
  );
  const [notificationEngagementPostIds, setNotificationEngagementPostIds] =
    useState<string[]>([]);

  const syncRouteState = useCallback(() => {
    const route = parseRouteFromLocation();
    setActiveTab(route.tab);
    setProfileAuthorId(route.tab === "profile" ? route.profileAuthorId : null);
    setProfileUsername(route.tab === "profile" ? route.profileUsername : null);
    setFocusedEntryId(route.tab === "knowledge" ? route.focusedEntryId : null);
    setExploreTopic(route.tab === "explore" ? route.selectedTopic : null);
    setSmartTalkCategory(route.tab === "smarttalk" ? route.selectedTopic : null);
    setFocusedQuestionId(route.tab === "smarttalk" ? route.focusedEntryId : null);
    setLegalSlug(route.tab === "legal" ? route.legalSlug : null);
    setRouteErrorPath(route.tab === "notFound" ? route.attemptedLocation : null);
  }, []);

  const handleTabChange = useCallback((
    tab: AppTab,
    nextProfileAuthorId: string | null = null,
    nextFocusedEntryId: string | null = null,
    nextProfileUsername: string | null = null,
  ) => {
    setShowNotificationsPanel(false);
    navigateToRoute(tab, {
      profileAuthorId: nextProfileAuthorId,
      profileUsername: nextProfileUsername,
      focusedEntryId: nextFocusedEntryId,
    });
  }, []);

  const handleOpenProfile = useCallback((authorId: string, username?: string) => {
    handleTabChange("profile", authorId, null, username || null);
  }, [handleTabChange]);

  const handleOpenEntry = useCallback((entryId: string) => {
    setNotificationEngagementPostIds((currentIds) => {
      if (currentIds.includes(entryId)) return currentIds;
      return [...currentIds, entryId].slice(-NOTIFICATION_READ_POST_THRESHOLD);
    });
    handleTabChange("knowledge", null, entryId);
  }, [handleTabChange]);

  const handleOpenTopic = useCallback((topicId: string | null) => {
    setShowNotificationsPanel(false);
    navigateToRoute("explore", { selectedTopic: topicId });
  }, []);

  const handleHomeAction = useCallback(() => {
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

    setShowNotificationsPanel(false);
    setComposerOpenSignal((current) => current + 1);
  }, [activeTab, handleTabChange]);

  const handleOpenNotifications = useCallback(() => {
    setShowNotificationsPanel((current) => !current);
  }, []);
  const handleOpenSignInPrompt = useCallback(() => {
    setShowGoogleSignInPrompt(true);
  }, []);

  const handleGoogleSignIn = useCallback(async () => {
    const nextIdentity = await signInWithGoogleAccount();
    setIdentity(nextIdentity);
    setAuthStatusMessage(null);
    setShowGoogleSignInPrompt(false);
    if (nextIdentity) {
      trackLogin("Google");
    }
  }, []);

  const handleGoogleSignOut = useCallback(async () => {
    await signOutGoogleAccount();
    setIdentity(null);
    setShowNotificationsPanel(false);
    setUnreadNotificationCount(0);
    setNotifications([]);
    trackLogout();
  }, []);
  const handleHeaderSignOut = useCallback(() => {
    setShowSignOutConfirm(true);
  }, []);
  const handleConfirmSignOut = useCallback(async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    setAuthStatusMessage(null);
    try {
      await handleGoogleSignOut();
      setShowSignOutConfirm(false);
    } catch (error) {
      console.error("Google sign-out failed:", error);
      setAuthStatusMessage("Could not sign out right now. Please try again.");
    } finally {
      setIsSigningOut(false);
    }
  }, [handleGoogleSignOut, isSigningOut]);

  useEffect(() => {
    const syncAndNormalizeRoute = () => {
      const route = parseRouteFromLocation();

      if (
        route.source === "hash" &&
        route.tab !== "notFound" &&
        route.tab !== "legal"
      ) {
        navigateToRoute(
          route.tab,
          {
            profileAuthorId: route.profileAuthorId,
            profileUsername: route.profileUsername,
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
    trackPageView(cookieConsentAccepted);
  }, [activeTab, profileAuthorId, profileUsername, focusedEntryId, exploreTopic, legalSlug, routeErrorPath, cookieConsentAccepted]);

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

  const hydratedIdentity = isIdentityHydrated ? identity : null;
  const hasNotificationEngagement =
    Boolean(hydratedIdentity?.email) ||
    notificationEngagementPostIds.length >= NOTIFICATION_READ_POST_THRESHOLD;
  const notificationPromptEligible =
    cookieConsentAccepted && isIdentityHydrated && hasNotificationEngagement;
  const shouldRenderTrustConsent = !cookieConsentAccepted || notificationPromptEligible;

  useEffect(() => {
    if (cookieConsentAccepted) {
      scheduleThirdPartyScripts();
    }
  }, [cookieConsentAccepted]);

  useEffect(() => {
    if (cookieConsentAccepted) {
      if (hydratedIdentity?.authorId) {
        setAnalyticsUser(hydratedIdentity.authorId);
      } else {
        setAnalyticsUser(null);
      }
    }
  }, [cookieConsentAccepted, hydratedIdentity?.authorId]);

  useEffect(() => {
    if (!firebaseConfigReady || !hydratedIdentity?.authorId) {
      setNotifications([]);
      setUnreadNotificationCount(0);
      setNotificationsError(null);
      return;
    }

    let unsubscribe: (() => void) | null = null;
    let cancelled = false;

    void Promise.all([import("firebase/firestore"), import("./firebase/firebaseDb")])
      .then(([firestore, firebaseDb]) => {
        if (cancelled) {
          return;
        }

        const { db } = firebaseDb;

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
            firestore.where("targetAuthorId", "==", hydratedIdentity.authorId),
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
          firestore.where("targetAuthorId", "==", hydratedIdentity.authorId),
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
  }, [hydratedIdentity?.authorId]);

  useEffect(() => {
    return subscribeToGoogleIdentity(
      (nextIdentity) => {
        setIdentity(nextIdentity);
        setIsIdentityHydrated(true);
        setAuthStatusMessage(null);
      },
      (message) => {
        setIsIdentityHydrated(true);
        setAuthStatusMessage(message);
      },
    );
  }, []);

  return (
    <HelmetProvider>
      <NotebookProvider
        identity={hydratedIdentity}
        isKnowledgeActive={activeTab === "knowledge"}
        focusedPostId={activeTab === "knowledge" ? focusedEntryId : null}
      >
        <div className="min-h-screen bg-[#f7f8fb] font-sans text-slate-950">
        <Header
          activeTab={activeTab}
          setActiveTab={handleTabChange}
          identity={hydratedIdentity}
          onHomeAction={handleHomeAction}
          unreadNotificationCount={unreadNotificationCount}
          onOpenNotifications={handleOpenNotifications}
          onOpenSignIn={handleOpenSignInPrompt}
          onSignOut={handleHeaderSignOut}
        />

        <main
          className={`mx-auto px-3 pb-28 pt-20 sm:px-4 ${
            activeTab === "knowledge"
              ? "max-w-3xl min-[1280px]:max-w-[1328px] min-[1280px]:px-4"
              : "max-w-3xl"
          }`}
        >
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

          {activeTab === "legal" && legalSlug ? (
            <Suspense fallback={<SectionSkeleton label="Loading information page..." />}>
              <LegalPageRoute slug={legalSlug} />
            </Suspense>
          ) : !firebaseConfigReady ? (
            <FirebaseSetupRoute missingKeys={firebaseConfigMissingKeys} />
          ) : activeTab === "notFound" ? (
            <NotFoundRoute
              attemptedPath={routeErrorPath}
              onGoHome={() => handleTabChange("knowledge")}
              onOpenSmartTalk={() => handleTabChange("smarttalk")}
            />
          ) : !isIdentityHydrated ? (
            <SectionSkeleton
              label={
                activeTab === "smarttalk"
                  ? "Loading SmartTalk..."
                  : activeTab === "profile"
                    ? "Loading profile..."
                    : activeTab === "explore"
                      ? "Loading Explore..."
                      : "Loading home feed..."
              }
            />
          ) : (
            <div
              className={activeTab === "knowledge" ? undefined : "hidden"}
              aria-hidden={activeTab !== "knowledge"}
            >
              <Suspense fallback={<SectionSkeleton label="Loading home feed..." />}>
                <KnowledgeFeed
                  identity={hydratedIdentity}
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
          {firebaseConfigReady && isIdentityHydrated && activeTab === "smarttalk" && (
            <Suspense fallback={<SectionSkeleton label="Loading SmartTalk..." />}>
              <SmartTalk
                currentIdentity={hydratedIdentity}
                onIdentityChange={setIdentity}
                selectedCategory={smartTalkCategory}
                focusedQuestionId={focusedQuestionId}
              />
            </Suspense>
          )}
          {firebaseConfigReady && isIdentityHydrated && activeTab === "profile" && (
            <Suspense fallback={<SectionSkeleton label="Loading profile..." />}>
              <Profile
                currentIdentity={hydratedIdentity}
                viewedAuthorId={profileAuthorId}
                viewedUsername={profileUsername}
                onIdentityChange={setIdentity}
                onOpenProfile={handleOpenProfile}
                onOpenEntry={handleOpenEntry}
              />
            </Suspense>
          )}
          {firebaseConfigReady && isIdentityHydrated && activeTab === "explore" && (
            <Suspense fallback={<SectionSkeleton label="Loading Explore..." />}>
              <Explore
                currentIdentity={hydratedIdentity}
                selectedTopic={exploreTopic}
                onOpenProfile={handleOpenProfile}
                onOpenEntry={handleOpenEntry}
                onOpenTopic={handleOpenTopic}
                onOpenSmartTalk={(questionId, selectedCategory) =>
                  navigateToRoute("smarttalk", {
                    focusedEntryId: questionId ?? null,
                    selectedTopic: selectedCategory ?? null,
                  })
                }
              />
            </Suspense>
          )}
        </main>

        <AppFooter />
        {showNotificationsPanel && (
          <Suspense fallback={null}>
            <NotificationsPanel
              identity={hydratedIdentity}
              notifications={notifications}
              unreadNotificationCount={unreadNotificationCount}
              notificationsError={notificationsError}
              onClose={() => setShowNotificationsPanel(false)}
              onOpenProfile={(authorId, username) => {
                setShowNotificationsPanel(false);
                handleOpenProfile(authorId, username);
              }}
              onOpenEntry={(entryId) => {
                setShowNotificationsPanel(false);
                handleOpenEntry(entryId);
              }}
              onOpenSmartTalk={(questionId, selectedCategory) => {
                setShowNotificationsPanel(false);
                navigateToRoute("smarttalk", {
                  focusedEntryId: questionId ?? null,
                  selectedTopic: selectedCategory ?? null,
                });
              }}
              onOpenSignIn={() => {
                setShowNotificationsPanel(false);
                handleOpenSignInPrompt();
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
              className="readative-dialog-surface relative w-full max-w-sm p-5"
            >
              <button
                type="button"
                onClick={() => setShowSignOutConfirm(false)}
                disabled={isSigningOut}
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
                  disabled={isSigningOut}
                  className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleConfirmSignOut();
                  }}
                  disabled={isSigningOut}
                  className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-rose-700"
                >
                  {isSigningOut ? "Signing Out..." : "Sign Out"}
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

        {shouldRenderTrustConsent && (
          <Suspense fallback={null}>
            <TrustConsent
              cookieConsentAccepted={cookieConsentAccepted}
              consentStorageKey={COOKIE_CONSENT_STORAGE_KEY}
              consentVersion={COOKIE_CONSENT_VERSION}
              notificationPromptEligible={notificationPromptEligible}
              onCookieAccepted={() => setCookieConsentAccepted(true)}
            />
          </Suspense>
        )}

        <nav
          className="fixed bottom-0 left-0 right-0 z-50 grid grid-cols-5 border-t border-slate-200 bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-[0_-12px_36px_rgba(15,23,42,0.08)] backdrop-blur md:hidden"
          aria-label="Primary mobile navigation"
        >
          <button
            type="button"
            onClick={handleHomeAction}
            aria-current={activeTab === "knowledge" ? "page" : undefined}
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
            type="button"
            onClick={() => handleTabChange("smarttalk")}
            aria-current={activeTab === "smarttalk" ? "page" : undefined}
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
            type="button"
            onClick={handleOpenComposer}
            className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-lg bg-slate-950 text-[11px] font-black text-white shadow-[0_10px_24px_rgba(15,23,42,0.2)] transition-colors hover:bg-emerald-700"
            aria-label="Create"
          >
            <CirclePlus className="h-5 w-5" />
            <span>Create</span>
          </button>
          <button
            type="button"
            onClick={() => handleTabChange("explore")}
            aria-current={activeTab === "explore" ? "page" : undefined}
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
            type="button"
            onClick={() => handleTabChange("profile")}
            aria-current={activeTab === "profile" ? "page" : undefined}
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
      </NotebookProvider>
    </HelmetProvider>
  );
}

