import { type UserSocialLinks } from "../types";

function cn(...inputs: Array<string | false | null | undefined>) {
  return inputs.filter(Boolean).join(" ");
}

type ProfileSocialPlatform = "linkedin" | "instagram" | "youtube";

interface ProfileSocialLinksProps {
  socialLinks: UserSocialLinks;
  className?: string;
  compact?: boolean;
  iconOnly?: boolean;
}

export function ProfileSocialLinks({
  socialLinks,
  className,
  compact = false,
  iconOnly = false,
}: ProfileSocialLinksProps) {
  const links = [
    {
      key: "linkedin",
      label: "LinkedIn",
      href: socialLinks.linkedin,
      platform: "linkedin" as const,
    },
    {
      key: "instagram",
      label: "Instagram",
      href: socialLinks.instagram,
      platform: "instagram" as const,
    },
    {
      key: "youtube",
      label: "YouTube",
      href: socialLinks.youtube,
      platform: "youtube" as const,
    },
  ].filter((link) => Boolean(link.href));

  if (links.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {links.map((link) => (
        <a
          key={link.key}
          href={link.href}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${link.label} profile`}
          title={`Open ${link.label} profile`}
          className={cn(
            "inline-flex items-center justify-center gap-1.5 rounded-full border border-slate-200 bg-white font-bold text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md",
            compact ? "h-8 px-2 text-[11px]" : "h-9 px-2.5 pr-3 text-xs",
            iconOnly && (compact ? "w-8 px-0" : "w-9 px-0"),
          )}
        >
          <SocialBrandIcon platform={link.platform} compact={compact} />
          {!iconOnly && <span className="hidden sm:inline">{link.label}</span>}
        </a>
      ))}
    </div>
  );
}

function SocialBrandIcon({
  platform,
  compact,
}: {
  platform: ProfileSocialPlatform;
  compact: boolean;
}) {
  const iconClassName = compact ? "h-3 w-3" : "h-3.5 w-3.5";

  if (platform === "linkedin") {
    return (
      <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-[#0A66C2] text-white">
        <svg viewBox="0 0 24 24" className={iconClassName} aria-hidden="true">
          <path
            fill="currentColor"
            d="M6.9 8.7H3.7v11h3.2v-11Zm.2-3.4c0-1-.8-1.8-1.9-1.8S3.3 4.3 3.3 5.3s.8 1.8 1.9 1.8 1.9-.8 1.9-1.8Zm13.6 8.1c0-3.4-1.8-5-4.2-5-1.9 0-2.8 1.1-3.3 1.8V8.7h-3.1v11h3.2v-5.4c0-1.4.3-2.8 2.1-2.8 1.7 0 1.7 1.6 1.7 2.9v5.3h3.2v-6.3Z"
          />
        </svg>
      </span>
    );
  }

  if (platform === "instagram") {
    return (
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-lg bg-[radial-gradient(circle_at_30%_105%,#feda75_0%,#fa7e1e_28%,#d62976_52%,#962fbf_74%,#4f5bd5_100%)] text-white">
        <svg viewBox="0 0 24 24" className={iconClassName} aria-hidden="true">
          <rect
            x="5"
            y="5"
            width="14"
            height="14"
            rx="4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <circle
            cx="12"
            cy="12"
            r="3.3"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          />
          <circle cx="16.4" cy="7.7" r="1.1" fill="currentColor" />
        </svg>
      </span>
    );
  }

  return (
    <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-[#FF0000] text-white">
      <svg viewBox="0 0 24 24" className={iconClassName} aria-hidden="true">
        <path fill="currentColor" d="M10 8.4v7.2l6.1-3.6L10 8.4Z" />
      </svg>
    </span>
  );
}
