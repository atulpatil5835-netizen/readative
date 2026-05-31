import { type UserSocialLinks } from "../types";
import { memo, useMemo } from "react";

import { cn } from "../utils/classNames";

type ProfileSocialPlatform =
  | "linkedin"
  | "instagram"
  | "github"
  | "twitter"
  | "website"
  | "youtube";

interface ProfileSocialLinksProps {
  socialLinks: UserSocialLinks;
  className?: string;
  compact?: boolean;
  iconOnly?: boolean;
}

export const ProfileSocialLinks = memo(function ProfileSocialLinks({
  socialLinks,
  className,
  compact = false,
  iconOnly = false,
}: ProfileSocialLinksProps) {
  const links = useMemo(
    () =>
      [
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
          key: "github",
          label: "GitHub",
          href: socialLinks.github,
          platform: "github" as const,
        },
        {
          key: "twitter",
          label: "X / Twitter",
          href: socialLinks.twitter,
          platform: "twitter" as const,
        },
        {
          key: "website",
          label: "Website",
          href: socialLinks.website,
          platform: "website" as const,
        },
        {
          key: "youtube",
          label: "YouTube",
          href: socialLinks.youtube,
          platform: "youtube" as const,
        },
      ].filter((link) => Boolean(link.href)),
    [
      socialLinks.github,
      socialLinks.instagram,
      socialLinks.linkedin,
      socialLinks.twitter,
      socialLinks.website,
      socialLinks.youtube,
    ],
  );

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
            "relative inline-flex items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_18px_rgba(15,23,42,0.08)] transition-all duration-200 before:absolute before:inset-x-1 before:top-0 before:h-1/2 before:rounded-full before:bg-white/55 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_12px_26px_rgba(15,23,42,0.12)] active:translate-y-0 active:scale-95",
            compact ? "h-9 w-9" : "h-10 w-10",
            iconOnly && (compact ? "h-8 w-8" : "h-9 w-9"),
          )}
        >
          <SocialBrandIcon platform={link.platform} compact={compact} />
        </a>
      ))}
    </div>
  );
});

function SocialBrandIcon({
  platform,
  compact,
}: {
  platform: ProfileSocialPlatform;
  compact: boolean;
}) {
  const iconClassName = compact ? "h-4 w-4" : "h-5 w-5";

  if (platform === "linkedin") {
    return (
      <span className="relative z-10 inline-flex text-[#0A66C2]">
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
      <span className="relative z-10 inline-flex text-[#d62976]">
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

  if (platform === "github") {
    return (
      <span className="relative z-10 inline-flex text-slate-950">
        <svg viewBox="0 0 24 24" className={iconClassName} aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 2.4a9.7 9.7 0 0 0-3.1 18.9c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.2-3.4-1.2-.5-1.1-1.1-1.4-1.1-1.4-.9-.6.1-.6.1-.6 1 .1 1.6 1 1.6 1 .9 1.5 2.4 1.1 2.9.8.1-.6.3-1.1.6-1.3-2.2-.3-4.6-1.1-4.6-4.8 0-1.1.4-1.9 1-2.6-.1-.3-.4-1.3.1-2.6 0 0 .9-.3 2.7 1a9.4 9.4 0 0 1 5 0c1.9-1.3 2.7-1 2.7-1 .5 1.3.2 2.3.1 2.6.7.7 1 1.5 1 2.6 0 3.8-2.3 4.6-4.6 4.8.4.3.7.9.7 1.9v2.7c0 .3.2.6.7.5A9.7 9.7 0 0 0 12 2.4Z"
          />
        </svg>
      </span>
    );
  }

  if (platform === "twitter") {
    return (
      <span className="relative z-10 inline-flex text-slate-950">
        <svg viewBox="0 0 24 24" className={iconClassName} aria-hidden="true">
          <path
            fill="currentColor"
            d="M13.8 10.6 20.7 3h-1.6l-6 6.6L8.3 3H2.8l7.3 10.1L2.8 21h1.6l6.4-7 5.1 7h5.5l-7.6-10.4Zm-2.3 2.5-.7-1L4.9 4.2h2.6l4.7 6.4.7 1 6.2 8.4h-2.6l-5-6.9Z"
          />
        </svg>
      </span>
    );
  }

  if (platform === "website") {
    return (
      <span className="relative z-10 inline-flex text-emerald-700">
        <svg viewBox="0 0 24 24" className={iconClassName} aria-hidden="true">
          <path
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0 0c2.2-2.5 3.3-5.5 3.3-9S14.2 5.5 12 3m0 18c-2.2-2.5-3.3-5.5-3.3-9S9.8 5.5 12 3M3.6 9h16.8M3.6 15h16.8"
          />
        </svg>
      </span>
    );
  }

  return (
    <span className="relative z-10 inline-flex text-[#FF0000]">
      <svg viewBox="0 0 24 24" className={iconClassName} aria-hidden="true">
        <path fill="currentColor" d="M10 8.4v7.2l6.1-3.6L10 8.4Z" />
      </svg>
    </span>
  );
}
