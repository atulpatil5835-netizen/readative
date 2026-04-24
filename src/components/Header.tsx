import { Logo } from "./Logo";

interface HeaderProps {
  activeTab: "knowledge" | "smarttalk" | "profile";
  setActiveTab: (tab: "knowledge" | "smarttalk" | "profile") => void;
  unreadNotificationCount: number;
}

export function Header({
  activeTab,
  setActiveTab,
  unreadNotificationCount,
}: HeaderProps) {
  const tabs = ["knowledge", "smarttalk", "profile"] as const;

  return (
    <header className="fixed left-0 right-0 top-0 z-50 border-b border-black/5 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center">
            <Logo className="h-full w-full" />
          </div>
          <div>
            <h1 className="leading-none text-xl font-black tracking-tight text-emerald-900">
              Readative
            </h1>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-600/60">
              Learn In Public
            </p>
          </div>
        </div>

        <nav className="hidden items-center gap-8 md:flex">
          {tabs.map((tab) => {
            const label =
              tab === "smarttalk"
                ? "SmartTalk"
                : tab === "knowledge"
                ? "Knowledge"
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
      </div>
    </header>
  );
}
