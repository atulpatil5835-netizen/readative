import {
  BookOpenText,
  FileText,
  Home,
  Mail,
  MessageSquareMore,
  Scale,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { type ReactNode } from "react";
import { buildPublicPath, type AppTab } from "../utils/routes";

interface FooterProps {
  activeTab: AppTab | "notFound";
  onNavigate: (tab: AppTab) => void;
}

const footerLinks: Array<{
  tab: AppTab;
  label: string;
  icon: ReactNode;
}> = [
  { tab: "knowledge", label: "Home", icon: <Home className="h-4 w-4" /> },
  {
    tab: "smarttalk",
    label: "SmartTalk",
    icon: <MessageSquareMore className="h-4 w-4" />,
  },
  { tab: "about", label: "About", icon: <BookOpenText className="h-4 w-4" /> },
  { tab: "contact", label: "Contact", icon: <Mail className="h-4 w-4" /> },
  {
    tab: "privacy",
    label: "Privacy Policy",
    icon: <ShieldCheck className="h-4 w-4" />,
  },
  {
    tab: "terms",
    label: "Terms & Conditions",
    icon: <Scale className="h-4 w-4" />,
  },
  {
    tab: "author",
    label: "Author Identity",
    icon: <UserRound className="h-4 w-4" />,
  },
];

export function Footer({ activeTab, onNavigate }: FooterProps) {
  return (
    <footer className="mt-12 border-t border-slate-200 pt-8 text-sm text-slate-500">
      <div className="flex items-start gap-3">
        <span className="mt-1 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
          <FileText className="h-5 w-5" />
        </span>
        <div>
          <p className="font-black text-slate-950">Readative</p>
          <p className="mt-1 leading-6">
            Educational posts, SmartTalk discussions, and community knowledge by
            Atul Hinge.
          </p>
        </div>
      </div>

      <nav
        aria-label="Footer navigation"
        className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2"
      >
        {footerLinks.map((link) => (
          <a
            key={link.tab}
            href={buildPublicPath(link.tab)}
            onClick={(event) => {
              event.preventDefault();
              onNavigate(link.tab);
            }}
            className={`flex items-center gap-3 rounded-2xl border px-4 py-3 font-bold transition-colors ${
              activeTab === link.tab
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:text-emerald-700"
            }`}
          >
            {link.icon}
            {link.label}
          </a>
        ))}
      </nav>

      <div className="mt-6 space-y-2 border-t border-slate-200 pt-5 text-xs leading-6">
        <p>(c) 2026 Readative. Created and maintained by Atul Hinge.</p>
        <p>
          Contact:{" "}
          <a
            href="mailto:reader@readative.com"
            className="font-bold text-emerald-700 hover:text-emerald-800"
          >
            reader@readative.com
          </a>
        </p>
      </div>
    </footer>
  );
}
