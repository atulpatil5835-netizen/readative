import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  Bell,
  Bookmark,
  FileText,
  Info,
  LogIn,
  LogOut,
  MoreVertical,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Logo } from "./Logo";
import { buildPublicPath, navigateToRoute, type AppTab } from "../utils/routes";
import { type KnowledgeIdentity } from "../utils/knowledgeIdentity";

interface HeaderProps {
  activeTab: AppTab | "notFound";
  setActiveTab: (tab: AppTab) => void;
  identity: KnowledgeIdentity | null;
  onHomeAction: () => void;
  unreadNotificationCount: number;
  onOpenNotifications: () => void;
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
  onOpenNotifications,
  onOpenSignIn,
  onSignOut,
}: HeaderProps) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);
  const actionsButtonRef = useRef<HTMLButtonElement | null>(null);
  const hasSignedInAccount = Boolean(identity?.email);
  const accountLabel = identity?.displayName || "Guest reader";
  const accountDetail = identity?.email || "Read freely. Sign in to save and contribute.";

  useEffect(() => {
    if (!actionsOpen) return;

    const focusFrame = window.requestAnimationFrame(() => {
      actionsMenuRef.current
        ?.querySelector<HTMLElement>('[role="menuitem"]')
        ?.focus();
    });

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
        actionsButtonRef.current?.focus();
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
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
      <div className="mx-auto flex h-[68px] max-w-5xl items-center justify-between gap-4 px-4 md:px-6 min-[1400px]:max-w-[1400px]">
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
                  aria-current={activeTab === tab ? "page" : undefined}
                >
                  {label}
                </a>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={onOpenNotifications}
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:border-emerald-200 hover:text-emerald-700 md:h-10 md:w-10"
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
              ref={actionsButtonRef}
              type="button"
              onClick={() => setActionsOpen((current) => !current)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:border-emerald-200 hover:text-emerald-700 md:h-10 md:w-10"
              aria-label={actionsOpen ? "Close account menu" : "Open account menu"}
              aria-expanded={actionsOpen}
              aria-haspopup="menu"
              aria-controls="readative-account-menu"
              title="Account"
            >
              <MoreVertical className="h-4 w-4" />
            </button>

            {actionsOpen && (
              <div
                id="readative-account-menu"
                role="menu"
                className="readative-menu-surface absolute right-0 top-12 z-50 max-h-[calc(100dvh-5rem)] w-64 overflow-y-auto overscroll-contain py-2 text-sm"
              >
                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="truncate text-sm font-black text-slate-950">
                    {accountLabel}
                  </p>
                  <p className="mt-1 truncate text-xs font-semibold text-slate-400">
                    {accountDetail}
                  </p>
                </div>
                {!hasSignedInAccount && (
                  <button
                    type="button"
                    onClick={() => handleMenuAction(onOpenSignIn)}
                    role="menuitem"
                    className="flex min-h-11 w-full items-center gap-3 border-b border-emerald-100 bg-emerald-50 px-4 py-3 text-left font-bold text-emerald-800 transition-colors hover:bg-emerald-100"
                  >
                    <LogIn className="h-4 w-4" />
                    Sign in
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleMenuAction(() => setActiveTab("profile"))}
                  role="menuitem"
                  className="flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left font-bold text-slate-800 transition-colors hover:bg-slate-50 hover:text-emerald-700"
                >
                  <UserRound className="h-4 w-4" />
                  Profile
                </button>
                <button
                  type="button"
                  onClick={() => handleMenuAction(() => navigateToRoute("profile", { section: "saved" }))}
                  role="menuitem"
                  className="flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left font-bold text-slate-800 transition-colors hover:bg-slate-50 hover:text-emerald-700"
                >
                  <Bookmark className="h-4 w-4" />
                  <span className="flex-1">Saved Posts</span>
                </button>
                <a
                  href="/about"
                  onClick={() => setActionsOpen(false)}
                  role="menuitem"
                  className="flex min-h-11 w-full items-center gap-3 border-t border-slate-100 px-4 py-3 text-left font-bold text-slate-800 transition-colors hover:bg-slate-50 hover:text-emerald-700"
                >
                  <Info className="h-4 w-4" />
                  About Readative
                </a>
                <a
                  href="/privacy"
                  onClick={() => setActionsOpen(false)}
                  role="menuitem"
                  className="flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left font-bold text-slate-800 transition-colors hover:bg-slate-50 hover:text-emerald-700"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Privacy
                </a>
                <a
                  href="/terms"
                  onClick={() => setActionsOpen(false)}
                  role="menuitem"
                  className="flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left font-bold text-slate-800 transition-colors hover:bg-slate-50 hover:text-emerald-700"
                >
                  <FileText className="h-4 w-4" />
                  Terms
                </a>
                {hasSignedInAccount && (
                  <button
                    type="button"
                    onClick={() => handleMenuAction(onSignOut)}
                    role="menuitem"
                    className="flex min-h-11 w-full items-center gap-3 border-t border-slate-100 px-4 py-3 text-left font-bold text-rose-600 transition-colors hover:bg-rose-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
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
