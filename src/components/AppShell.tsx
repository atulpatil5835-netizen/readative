import { TriangleAlert } from "lucide-react";
import type { InfoSection } from "./AppPanels";
import {
  KnowledgeFeedSkeleton,
  ProfileSkeleton,
  SmartTalkSkeleton,
} from "./Skeletons";

export function SectionSkeleton({ label }: { label: string }) {
  const normalizedLabel = label.toLowerCase();

  if (normalizedLabel.includes("smarttalk")) {
    return <SmartTalkSkeleton />;
  }

  if (normalizedLabel.includes("profile")) {
    return <ProfileSkeleton />;
  }

  if (normalizedLabel.includes("feed") || normalizedLabel.includes("home")) {
    return <KnowledgeFeedSkeleton showControls={false} />;
  }

  return (
    <div
      className="rounded-[32px] border border-slate-200 bg-white px-6 py-10 shadow-sm"
      aria-label={label}
      aria-busy="true"
    >
      <KnowledgeFeedSkeleton count={2} />
    </div>
  );
}

export function BannerNotice({
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

const FOOTER_LINKS: Array<{ label: string; section: InfoSection }> = [
  { label: "About", section: "about" },
  { label: "Contact", section: "contact" },
  { label: "Privacy", section: "privacy" },
  { label: "Terms", section: "terms" },
  { label: "Community", section: "guidelines" },
  { label: "Disclaimer", section: "disclaimer" },
];

export function AppFooter({
  onOpenInfo,
}: {
  onOpenInfo: (section: InfoSection) => void;
}) {
  return (
    <footer className="mx-auto max-w-5xl px-4 pb-28 pt-2 text-slate-500 md:px-6 md:pb-10">
      <div className="border-t border-slate-200/80 pt-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-black tracking-tight text-slate-800">
              Readative
            </p>
            <p className="mt-1 text-xs leading-5">
              Practical knowledge, creator posts, and SmartTalk discussions.
            </p>
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {FOOTER_LINKS.map((link) => (
              <button
                key={link.section}
                type="button"
                onClick={() => onOpenInfo(link.section)}
                className="text-xs font-semibold text-slate-500 transition-colors hover:text-emerald-700"
              >
                {link.label}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-4 text-xs">
          Copyright {new Date().getFullYear()} Readative. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

export function NotFoundRoute({
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

export function FirebaseSetupRoute({ missingKeys }: { missingKeys: string[] }) {
  return (
    <div className="rounded-[32px] border border-amber-200 bg-white px-6 py-14 text-center shadow-sm">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-700">
        <TriangleAlert className="h-8 w-8" />
      </div>
      <p className="mt-5 text-xs font-bold uppercase tracking-[0.22em] text-amber-600">
        Setup needed
      </p>
      <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
        Readative is missing Firebase access
      </h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-slate-500">
        Add a valid {missingKeys.join(", ")} value in the hosting environment
        and redeploy. The app is paused here so posts, likes, comments, and
        profiles do not load with a broken connection.
      </p>
    </div>
  );
}

export function HomeIcon() {
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

export function UserIcon() {
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
