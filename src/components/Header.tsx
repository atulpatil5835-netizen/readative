import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  Bell,
  Bookmark,
  Info,
  LogIn,
  LogOut,
  MoreVertical,
  Palette,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Logo } from "./Logo";
import { buildPublicPath, navigateToRoute, type AppTab } from "../utils/routes";
import { type KnowledgeIdentity } from "../utils/knowledgeIdentity";
import { type InfoSection } from "./AppPanels";

interface HeaderProps {
  activeTab: AppTab | "notFound";
  setActiveTab: (tab: AppTab) => void;
  identity: KnowledgeIdentity | null;
  onHomeAction: () => void;
  unreadNotificationCount: number;
  onOpenComposer: () => void;
  onOpenNotifications: () => void;
  onOpenInfo: (section?: InfoSection) => void;
  onOpenSignIn: () => void;
  onSignOut: () => void;
}

const HEADER_TABS: AppTab[] = ["knowledge", "smarttalk", "explore", "profile"];

export const Header = memo(function Header({
  activeTab,
  setActiveTab,
  identity,
  onHomeAction,
  unreadNotificationCount,
  onOpenComposer,
  onOpenNotifications,
  onOpenInfo,
  onOpenSignIn,
  onSignOut,
}: HeaderProps) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);
  const hasSignedInAccount = Boolean(identity?.email);
  const accountLabel = identity?.displayName || "Guest reader";
  const accountDetail = identity?.email || "Read freely. Sign in to save and contribute.";

  useEffect(() => {
    if (!actionsOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (
        actionsMenuRef.current &&
        !actionsMenuRef.current.contains(event.target as Node)
      ) {
        setActionsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActionsOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [actionsOpen]);

  const handleMenuAction = useCallback((action: () => void) => {
    setActionsOpen(false);
    action();
  }, []);

  return (
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-black/5 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-[68px] max-w-5xl items-center justify-between gap-4 px-4 md:px-6">
        <div className="flex items-center gap-3">
          <a
            href="/"
            onClick={(event) => {
              event.preventDefault();
              onHomeAction();
            }}
            className="relative flex h-9 w-9 shrink-0 items-center justify-center transition-transform hover:scale-[1.02] md:h-10 md:w-10"
            aria-label="Open homepage"
          >
            <Logo className="h-full w-full" loading="eager" />
          </a>
          <div className="flex flex-col justify-center">
            <a
              href="/"
              onClick={(event) => {
                event.preventDefault();
                onHomeAction();
              }}
              className="leading-none text-left text-[18px] font-black tracking-tight text-emerald-800 md:text-[20px]"
            >
              Readative
            </a>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-500">
              Knowledge Feed
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <nav className="hidden items-center gap-6 md:flex">
            {HEADER_TABS.map((tab) => {
              const label =
                tab === "smarttalk"
                  ? "SmartTalk"
                  : tab === "explore"
                  ? "Explore"
                  : tab === "knowledge"
                  ? "Home"
                  : "Profile";

              return (
                <a
                  key={tab}
                  href={buildPublicPath(tab)}
                  onClick={(event) => {
                    event.preventDefault();
                    if (tab === "knowledge") {
                      onHomeAction();
                      return;
                    }

                    setActiveTab(tab);
                  }}
                  className={`relative text-sm font-medium transition-colors ${
                    activeTab === tab
                      ? "text-emerald-600"
                      : "text-gray-500 hover:text-emerald-600"
                  }`}
                >
                  {label}
                </a>
              );
            })}
          </nav>

          <button
            onClick={onOpenNotifications}
            className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:border-emerald-200 hover:text-emerald-700"
            aria-label="Open notifications"
            title="Realtime notifications"
          >
            <Bell className="h-4 w-4" />
            {unreadNotificationCount > 0 && (
              <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
              </span>
            )}
          </button>

          <div ref={actionsMenuRef} className="relative">
            <button
              onClick={() => setActionsOpen((current) => !current)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:border-emerald-200 hover:text-emerald-700"
              aria-label="Open actions menu"
              aria-expanded={actionsOpen}
              aria-haspopup="menu"
              title="Actions"
            >
              <MoreVertical className="h-4 w-4" />
            </button>

            {actionsOpen && (
              <div
                role="menu"
                className="absolute right-0 top-12 z-50 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white py-2 text-sm shadow-xl shadow-slate-900/10"
              >
                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="truncate text-sm font-black text-slate-950">
                    {accountLabel}
                  </p>
                  <p className="mt-1 truncate text-xs font-semibold text-slate-400">
                    {accountDetail}
                  </p>
                </div>
                <button
                  onClick={() => handleMenuAction(() => setActiveTab("profile"))}
                  role="menuitem"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left font-bold text-slate-800 transition-colors hover:bg-slate-50 hover:text-emerald-700"
                >
                  <UserRound className="h-4 w-4" />
                  Profile
                </button>
                <button
                  type="button"
                  onClick={() => handleMenuAction(() => navigateToRoute("profile", { section: "saved" }))}
                  role="menuitem"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left font-bold text-slate-800 transition-colors hover:bg-slate-50 hover:text-emerald-700"
                >
                  <Bookmark className="h-4 w-4" />
                  <span className="flex-1">Saved Posts</span>
                </button>
                <button
                  onClick={() => handleMenuAction(onOpenNotifications)}
                  role="menuitem"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left font-bold text-slate-800 transition-colors hover:bg-slate-50 hover:text-emerald-700"
                >
                  <Bell className="h-4 w-4" />
                  <span className="flex-1">Notifications</span>
                  {unreadNotificationCount > 0 && (
                    <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-black text-white">
                      {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => handleMenuAction(() => onOpenInfo("appearance"))}
                  role="menuitem"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left font-bold text-slate-800 transition-colors hover:bg-slate-50 hover:text-emerald-700"
                >
                  <Palette className="h-4 w-4" />
                  Appearance
                </button>
                <button
                  onClick={() => handleMenuAction(() => onOpenInfo("privacy"))}
                  role="menuitem"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left font-bold text-slate-800 transition-colors hover:bg-slate-50 hover:text-emerald-700"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Privacy
                </button>
                <button
                  onClick={() => handleMenuAction(() => onOpenInfo("about"))}
                  role="menuitem"
                  className="flex w-full items-center gap-3 px-4 py-3 text-left font-bold text-slate-800 transition-colors hover:bg-slate-50 hover:text-emerald-700"
                >
                  <Info className="h-4 w-4" />
                  About Readative
                </button>
                {hasSignedInAccount ? (
                  <button
                    onClick={() => handleMenuAction(onSignOut)}
                    role="menuitem"
                    className="flex w-full items-center gap-3 border-t border-slate-100 px-4 py-3 text-left font-bold text-rose-600 transition-colors hover:bg-rose-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                ) : (
                  <button
                    onClick={() => handleMenuAction(onOpenSignIn)}
                    role="menuitem"
                    className="flex w-full items-center gap-3 border-t border-slate-100 px-4 py-3 text-left font-bold text-emerald-700 transition-colors hover:bg-emerald-50"
                  >
                    <LogIn className="h-4 w-4" />
                    Sign in
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
});
