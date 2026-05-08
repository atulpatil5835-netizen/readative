import { type KnowledgeImageAsset } from "../types";

function cn(...inputs: Array<string | false | null | undefined>) {
  return inputs.filter(Boolean).join(" ");
}

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

interface ProfileAvatarProps {
  authorId?: string | null;
  image?: KnowledgeImageAsset | null;
  photoUrl?: string | null;
  username?: string | null;
  size?: AvatarSize;
  className?: string;
}

const AVATAR_SIZE_CLASSNAMES: Record<AvatarSize, string> = {
  xs: "h-8 w-8 rounded-xl text-[10px]",
  sm: "h-12 w-12 rounded-2xl text-sm",
  md: "h-16 w-16 rounded-[20px] text-lg",
  lg: "h-20 w-20 rounded-[22px] text-xl",
  xl: "h-24 w-24 rounded-[26px] text-2xl",
  "2xl": "h-40 w-40 rounded-[36px] text-4xl",
};

const PLACEHOLDER_THEMES = [
  {
    gradient: "from-emerald-100 via-teal-100 to-cyan-100",
    accent: "bg-emerald-500/20",
    text: "text-emerald-950",
  },
  {
    gradient: "from-sky-100 via-indigo-100 to-blue-100",
    accent: "bg-blue-500/20",
    text: "text-slate-950",
  },
  {
    gradient: "from-amber-100 via-orange-100 to-rose-100",
    accent: "bg-orange-500/20",
    text: "text-rose-950",
  },
  {
    gradient: "from-fuchsia-100 via-pink-100 to-purple-100",
    accent: "bg-fuchsia-500/20",
    text: "text-purple-950",
  },
] as const;

function hashSeed(value: string) {
  let hash = 0;

  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return hash;
}

function getInitials(username?: string | null) {
  const cleaned = (username || "")
    .trim()
    .replace(/^@+/, "")
    .split(/[\s_]+/)
    .filter(Boolean);

  if (cleaned.length >= 2) {
    return `${cleaned[0][0] || ""}${cleaned[1][0] || ""}`.toUpperCase();
  }

  const compact = cleaned[0] || "readative";
  return compact.slice(0, 2).toUpperCase();
}

export function ProfileAvatar({
  authorId,
  image,
  photoUrl,
  username,
  size = "md",
  className,
}: ProfileAvatarProps) {
  const seed = authorId || username || "readative-guest";
  const theme = PLACEHOLDER_THEMES[hashSeed(seed) % PLACEHOLDER_THEMES.length];
  const imageSource = image?.dataUrl || photoUrl || null;

  return (
    <div
      className={cn(
        "relative aspect-square overflow-hidden border border-white/55 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.12)]",
        AVATAR_SIZE_CLASSNAMES[size],
        className,
      )}
      role="img"
      aria-label={`${username ? `@${username}` : "Readative member"} profile picture`}
    >
      {imageSource ? (
        <img
          src={imageSource}
          alt=""
          aria-hidden="true"
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div
          className={cn(
            "flex h-full w-full items-center justify-center bg-gradient-to-br font-black tracking-[0.12em]",
            theme.gradient,
            theme.text,
          )}
        >
          <div className={cn("absolute right-2 top-2 h-5 w-5 rounded-full", theme.accent)} />
          <div className="absolute bottom-0 left-0 h-10 w-10 rounded-tr-[28px] bg-white/30" />
          <span className="relative">{getInitials(username)}</span>
        </div>
      )}
    </div>
  );
}
