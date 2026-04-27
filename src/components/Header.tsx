import { Bell, CirclePlus, Info, Plus } from "lucide-react";
import { Logo } from "./Logo";

interface HeaderProps {
  activeTab: "knowledge" | "smarttalk" | "profile";
  setActiveTab: (tab: "knowledge" | "smarttalk" | "profile") => void;
  unreadNotificationCount: number;
  onOpenComposer: () => void;
  onOpenNotifications: () => void;
  onOpenInfo: () => void;
}

export function Header({
  activeTab,
  setActiveTab,
  unreadNotificationCount,
  onOpenComposer,
  onOpenNotifications,
  onOpenInfo,
}: HeaderProps) {
  const tabs = ["knowledge", "smarttalk", "profile"] as const;

  return (
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-black/5 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-[68px] max-w-5xl items-center justify-between gap-4 px-4 md:px-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveTab("knowledge")}
            className="relative flex h-9 w-9 shrink-0 items-center justify-center transition-transform hover:scale-[1.02] md:h-10 md:w-10"
            aria-label="Open homepage"
          >
            <Logo className="h-full w-full" />
          </button>
          <div className="flex flex-col justify-center">
            <button
              onClick={() => setActiveTab("knowledge")}
              className="leading-none text-left text-[18px] font-black tracking-tight text-emerald-800 md:text-[20px]"
            >
              Readative
            </button>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-500">
              Knowledge Feed
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <nav className="hidden items-center gap-6 md:flex">
            {tabs.map((tab) => {
              const label =
                tab === "smarttalk"
                  ? "SmartTalk"
                  : tab === "knowledge"
                  ? "Home"
                  : "Profile";

              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`relative text-sm font-medium transition-colors ${
                    activeTab === tab
                      ? "text-emerald-600"
                      : "text-gray-500 hover:text-emerald-600"
                  }`}
                >
                  {label}
                  {tab === "profile" && unreadNotificationCount > 0 && (
                    <span className="absolute -right-5 -top-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
                      {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <button
            onClick={onOpenComposer}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-emerald-600 px-3 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700"
            aria-label="Create post"
            title="Create post"
          >
            <Plus className="h-4 w-4 md:hidden" />
            <CirclePlus className="hidden h-4 w-4 md:block" />
            <span className="hidden md:inline">Post</span>
          </button>

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

          <button
            onClick={onOpenInfo}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:border-emerald-200 hover:text-emerald-700"
            aria-label="Open info"
            title="Contact and creator info"
          >
            <Info className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
