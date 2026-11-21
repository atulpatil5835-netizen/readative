import { ArrowUpRight, X } from "lucide-react";

interface ProductSpotlightProps {
  onDismiss: () => void;
}

export function ProductSpotlight({ onDismiss }: ProductSpotlightProps) {
  return (
    <aside
      aria-label="Featured product"
      className="fixed bottom-[calc(env(safe-area-inset-bottom)+9rem)] right-3 z-40 aspect-square w-[min(48vw,184px)] sm:bottom-20 sm:right-5 sm:w-52 lg:w-56"
    >
      <div className="relative flex h-full flex-col overflow-hidden rounded-[1.4rem] border border-emerald-200/80 bg-white/95 p-2.5 shadow-[0_20px_55px_rgba(15,23,42,0.2)] backdrop-blur-xl sm:rounded-[1.6rem] sm:p-4">
        <button
          type="button"
          onClick={onDismiss}
          className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          aria-label="Hide featured product"
          title="Hide featured product"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <p className="pr-7 text-[9px] font-black uppercase tracking-[0.14em] text-emerald-700 sm:text-[10px] sm:tracking-[0.18em]">
          From Info Hub
        </p>
        <h2 className="mt-3 pr-1 text-[13px] font-black leading-tight tracking-tight text-slate-950 sm:text-base">
          Plan your spending.
        </h2>
        <p className="mt-1.5 line-clamp-2 break-words text-[10px] leading-[1.4] text-slate-600 sm:mt-2.5 sm:line-clamp-3 sm:text-xs sm:leading-5">
          Track daily expenses and keep budgets easy to review with FBPLY.
        </p>

        <div className="mt-auto pt-2">
          <a
            href="https://fbply.com"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Explore FBPLY, opens in a new tab"
            className="inline-flex min-h-7 max-w-full items-center gap-1 rounded-lg bg-emerald-700 px-2 py-1 text-[10px] font-black text-white transition-colors hover:bg-emerald-800 sm:min-h-9 sm:px-3 sm:py-1.5 sm:text-xs"
          >
            <span className="truncate">Explore FBPLY</span>
            <ArrowUpRight className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" />
          </a>
          <a
            href="/projects"
            className="mt-1.5 hidden truncate text-[9px] font-bold text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-emerald-700 sm:block sm:text-[10px]"
          >
            View all projects
          </a>
        </div>
      </div>
    </aside>
  );
}
