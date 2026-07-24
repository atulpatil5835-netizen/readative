import { TriangleAlert } from "lucide-react";
import {
  KnowledgeFeedSkeleton,
  ProfileSkeleton,
  SmartTalkSkeleton,
} from "./Skeletons";
import { Logo } from "./Logo";
import { SEO } from "./SEO";

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
      className="readative-panel-surface px-6 py-10"
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

const FOOTER_LINK_GROUPS = [
  {
    title: "ABOUT",
    links: [
      { label: "About", href: "/about" },
      { label: "Mission", href: "/mission" },
      { label: "Projects", href: "/projects" },
      { label: "Contact Readative", href: "/contact" },
      { label: "Support Independent Innovation", href: "/support" },
    ],
  },
  {
    title: "COMMUNITY",
    links: [
      { label: "Community Guidelines", href: "/community" },
      { label: "Editorial Policy", href: "/editorial-policy" },
      { label: "Content Policy", href: "/content-policy" },
      { label: "Corrections Policy", href: "/corrections-policy" },
    ],
  },
  {
    title: "LEGAL",
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Use", href: "/terms" },
      { label: "Cookie Policy", href: "/cookies" },
      { label: "Copyright Policy", href: "/copyright" },
      { label: "DMCA Policy", href: "/dmca" },
      { label: "Disclaimer", href: "/disclaimer" },
    ],
  },
  {
    title: "SUPPORT",
    links: [{ label: "Support", href: "/support" }],
  },
];

export function AppFooter() {
  return (
    <footer className="mx-auto max-w-5xl px-4 pb-28 pt-8 text-slate-600 md:px-6 md:pb-10 min-[1280px]:max-w-[1328px]">
      <div className="border-t border-slate-200/80 py-10 md:py-12">
        <div className="grid gap-10 xl:grid-cols-[15rem_minmax(0,1fr)] xl:gap-10 min-[1440px]:grid-cols-[18rem_minmax(0,1fr)] min-[1440px]:gap-14">
          <div className="max-w-sm xl:max-w-[15rem] min-[1440px]:max-w-sm">
            <a
              href="/"
              className="group inline-flex items-center gap-3 rounded-2xl transition-colors duration-200 hover:text-emerald-700"
              aria-label="Readative home"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-emerald-200 group-hover:shadow-md">
                <Logo className="h-9 w-9" loading="lazy" />
              </span>
              <span className="text-lg font-black tracking-tight text-slate-950 transition-colors duration-200 group-hover:text-emerald-700">
                Readative
              </span>
            </a>
            <p className="mt-5 text-sm leading-6 text-slate-600">
              Practical knowledge, creator posts, visual explainers, and
              SmartTalk discussions for readers who want useful context.
            </p>
            <p className="mt-6 text-xs font-medium text-slate-500">
              © 2026 Readative. All rights reserved.
            </p>
          </div>

          <nav
            aria-label="Footer navigation"
            className="grid min-w-0 grid-cols-1 items-start gap-y-8 md:grid-cols-2 md:gap-x-12 lg:grid-cols-4 lg:gap-x-6 min-[1440px]:gap-x-8"
          >
            {FOOTER_LINK_GROUPS.map((group) => (
              <section
                key={group.title}
                aria-labelledby={`footer-${group.title.toLowerCase()}`}
                className="min-w-0"
              >
                <h2
                  id={`footer-${group.title.toLowerCase()}`}
                  className="text-[0.68rem] font-black uppercase tracking-[0.16em] text-slate-900"
                >
                  {group.title}
                </h2>
                <ul className="mt-4 space-y-2">
                  {group.links.map((link) => (
                    <li key={`${group.title}-${link.label}`}>
                      <a
                        href={link.href}
                        className="readative-footer-link text-sm font-semibold text-slate-600 hover:text-emerald-700"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </nav>
        </div>
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
    <>
      <SEO
        title="Page Not Found | Readative"
        description="The requested Readative page could not be found."
        robots="noindex"
      />
      <div className="readative-panel-surface border-dashed border-slate-300 px-6 py-14 text-center">
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
          <a
            href="/"
            onClick={(event) => {
              event.preventDefault();
              onGoHome();
            }}
            className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-700"
          >
            Go to home feed
          </a>
          <a
            href="/smarttalks"
            onClick={(event) => {
              event.preventDefault();
              onOpenSmartTalk();
            }}
            className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition-colors hover:border-emerald-200 hover:text-emerald-700"
          >
            Open SmartTalk
          </a>
        </div>
      </div>
    </>
  );
}

export function FirebaseSetupRoute({ missingKeys }: { missingKeys: string[] }) {
  return (
    <div className="readative-panel-surface border-amber-200 px-6 py-14 text-center">
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
        and redeploy. The app is paused here so posts, helpful feedback, comments, and
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
