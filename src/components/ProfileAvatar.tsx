import { resolveProfileVisualPreset } from "../utils/profileVisuals";

function cn(...inputs: Array<string | false | null | undefined>) {
  return inputs.filter(Boolean).join(" ");
}

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

interface ProfileAvatarProps {
  authorId?: string | null;
  avatarId?: string | null;
  username?: string | null;
  size?: AvatarSize;
  className?: string;
}

const AVATAR_SIZE_CLASSNAMES: Record<AvatarSize, string> = {
  xs: "h-8 w-8",
  sm: "h-12 w-12",
  md: "h-16 w-16",
  lg: "h-20 w-20",
  xl: "h-24 w-24",
};

interface ProfessionalAvatarArtProps {
  seed: string;
  bgFrom: string;
  bgTo: string;
  accent: string;
  skin: string;
  hair: string;
  shirt: string;
  desk: string;
  laptop: string;
  panel: string;
  accessory: "glasses" | "headset" | "earring" | "beanie";
  prop: "plant" | "tablet" | "notebook" | "mug";
}

interface StickerAvatarArtProps {
  seed: string;
  bgFrom: string;
  bgTo: string;
  accent: string;
  stickerFill: string;
  motif: "robot" | "pixel" | "ops" | "launch";
}

function ProfessionalAvatarArt({
  seed,
  bgFrom,
  bgTo,
  accent,
  skin,
  hair,
  shirt,
  desk,
  laptop,
  panel,
  accessory,
  prop,
}: ProfessionalAvatarArtProps) {
  const backgroundGradientId = `avatar-bg-${seed}`;
  const panelGradientId = `avatar-panel-${seed}`;

  return (
    <svg
      viewBox="0 0 160 160"
      className="h-full w-full"
      role="img"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={backgroundGradientId}
          x1="16"
          y1="16"
          x2="144"
          y2="144"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor={bgFrom} />
          <stop offset="1" stopColor={bgTo} />
        </linearGradient>
        <linearGradient
          id={panelGradientId}
          x1="28"
          y1="20"
          x2="102"
          y2="58"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="rgba(255,255,255,0.92)" />
          <stop offset="1" stopColor={panel} />
        </linearGradient>
      </defs>

      <rect width="160" height="160" rx="44" fill={`url(#${backgroundGradientId})`} />
      <circle cx="126" cy="30" r="20" fill="rgba(255,255,255,0.18)" />
      <circle cx="28" cy="134" r="18" fill="rgba(255,255,255,0.12)" />

      <rect
        x="18"
        y="20"
        width="52"
        height="30"
        rx="10"
        fill={`url(#${panelGradientId})`}
      />
      <rect x="26" y="28" width="22" height="4" rx="2" fill={accent} fillOpacity="0.9" />
      <rect x="26" y="36" width="34" height="3" rx="1.5" fill="#94A3B8" fillOpacity="0.8" />
      <rect x="26" y="42" width="28" height="3" rx="1.5" fill="#CBD5E1" fillOpacity="0.8" />

      <rect x="14" y="108" width="132" height="30" rx="14" fill={desk} fillOpacity="0.96" />
      <rect x="54" y="88" width="52" height="32" rx="8" fill={laptop} />
      <rect x="60" y="94" width="40" height="18" rx="4" fill="#E2E8F0" />
      <rect x="73" y="116" width="14" height="4" rx="2" fill="#94A3B8" />

      {prop === "plant" && (
        <>
          <rect x="24" y="101" width="12" height="16" rx="4" fill="#A16207" />
          <path d="M30 100c1-7 9-10 12-14 2 8-3 14-12 14Z" fill="#22C55E" />
          <path d="M30 100c-1-6-8-8-10-13-3 8 2 13 10 13Z" fill="#16A34A" />
        </>
      )}

      {prop === "tablet" && (
        <>
          <rect x="22" y="96" width="18" height="24" rx="5" fill="#0F172A" fillOpacity="0.72" />
          <rect x="25" y="100" width="12" height="15" rx="3" fill="#E2E8F0" />
        </>
      )}

      {prop === "notebook" && (
        <>
          <rect x="22" y="100" width="18" height="18" rx="4" fill="#FFF7ED" />
          <rect x="27" y="104" width="1.5" height="11" rx="0.75" fill="#FB923C" />
          <rect x="30" y="105" width="7" height="1.5" rx="0.75" fill="#FDBA74" />
          <rect x="30" y="109" width="6" height="1.5" rx="0.75" fill="#FDBA74" />
        </>
      )}

      {prop === "mug" && (
        <>
          <rect x="118" y="100" width="12" height="16" rx="4" fill="#FEF3C7" />
          <path d="M130 104h4c2 0 3 2 3 4s-1 4-3 4h-4" fill="none" stroke="#F59E0B" strokeWidth="2" />
        </>
      )}

      <path
        d="M54 132c2-15 11-25 26-25s24 10 26 25"
        fill={shirt}
      />
      <rect x="75" y="88" width="10" height="16" rx="5" fill={skin} />
      <ellipse cx="80" cy="69" rx="20" ry="24" fill={skin} />

      <path
        d="M58 68c0-18 10-31 22-31 12 0 24 9 24 28v8c-3-6-8-9-14-10-6-1-14 0-20 3-4 2-8 5-12 10Z"
        fill={hair}
      />
      <path
        d="M58 67c3-8 9-12 18-13 11-1 20 2 28 10v5c-8-6-18-8-28-7-7 1-13 3-18 8Z"
        fill={hair}
        fillOpacity="0.82"
      />

      {accessory === "glasses" && (
        <>
          <rect x="63" y="66" width="12" height="8" rx="3" fill="none" stroke="#1E293B" strokeWidth="2" />
          <rect x="85" y="66" width="12" height="8" rx="3" fill="none" stroke="#1E293B" strokeWidth="2" />
          <path d="M75 70h10" stroke="#1E293B" strokeWidth="2" />
        </>
      )}

      {accessory === "headset" && (
        <>
          <path d="M62 72c0-12 8-20 18-20s18 8 18 20" fill="none" stroke="#0F172A" strokeWidth="4" />
          <rect x="60" y="73" width="6" height="12" rx="3" fill="#0F172A" />
          <rect x="94" y="73" width="6" height="12" rx="3" fill="#0F172A" />
          <path d="M96 84c7 0 10 3 10 8" fill="none" stroke="#0F172A" strokeWidth="2" />
        </>
      )}

      {accessory === "earring" && (
        <>
          <circle cx="61" cy="79" r="2.6" fill="#FDE68A" />
          <circle cx="99" cy="79" r="2.6" fill="#FDE68A" />
        </>
      )}

      {accessory === "beanie" && (
        <>
          <path
            d="M60 60c4-13 12-20 20-20 9 0 17 6 21 20"
            fill="#0F172A"
          />
          <rect x="61" y="57" width="38" height="8" rx="4" fill="#1E293B" />
        </>
      )}

      <circle cx="121" cy="90" r="11" fill={accent} fillOpacity="0.18" />
      <path d="M117 90h8" stroke={accent} strokeWidth="2.4" strokeLinecap="round" />
      <path d="M121 86v8" stroke={accent} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

function StickerAvatarArt({
  seed,
  bgFrom,
  bgTo,
  accent,
  stickerFill,
  motif,
}: StickerAvatarArtProps) {
  const backgroundGradientId = `sticker-bg-${seed}`;

  return (
    <svg
      viewBox="0 0 160 160"
      className="h-full w-full"
      role="img"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={backgroundGradientId}
          x1="18"
          y1="14"
          x2="144"
          y2="146"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor={bgFrom} />
          <stop offset="1" stopColor={bgTo} />
        </linearGradient>
      </defs>

      <rect x="8" y="8" width="144" height="144" rx="40" fill="#FFFFFF" />
      <rect x="14" y="14" width="132" height="132" rx="34" fill={`url(#${backgroundGradientId})`} />
      <circle cx="80" cy="74" r="44" fill={stickerFill} fillOpacity="0.92" />
      <rect x="30" y="120" width="100" height="12" rx="6" fill="rgba(15,23,42,0.16)" />
      <rect x="42" y="124" width="44" height="4" rx="2" fill="rgba(255,255,255,0.8)" />
      <rect x="92" y="124" width="22" height="4" rx="2" fill="rgba(255,255,255,0.42)" />

      {motif === "robot" && (
        <>
          <rect x="50" y="48" width="60" height="44" rx="18" fill="#0F172A" />
          <rect x="58" y="58" width="14" height="10" rx="5" fill={accent} />
          <rect x="88" y="58" width="14" height="10" rx="5" fill={accent} />
          <rect x="68" y="76" width="24" height="6" rx="3" fill="#E2E8F0" />
          <path d="M80 48v-10" stroke="#0F172A" strokeWidth="4" strokeLinecap="round" />
          <circle cx="80" cy="36" r="5" fill={accent} />
          <rect x="58" y="96" width="44" height="18" rx="9" fill="#1D4ED8" fillOpacity="0.9" />
          <rect x="64" y="101" width="32" height="8" rx="4" fill="#DBEAFE" />
        </>
      )}

      {motif === "pixel" && (
        <>
          <rect x="44" y="46" width="52" height="38" rx="10" fill="#111827" />
          <rect x="50" y="52" width="40" height="24" rx="6" fill="#E9D5FF" />
          <rect x="58" y="64" width="6" height="6" rx="1.5" fill={accent} />
          <rect x="68" y="58" width="8" height="8" rx="1.5" fill="#0F172A" fillOpacity="0.72" />
          <rect x="78" y="64" width="6" height="6" rx="1.5" fill={accent} />
          <rect x="62" y="84" width="16" height="6" rx="3" fill="#111827" />
          <rect x="54" y="92" width="52" height="18" rx="9" fill="#0F172A" fillOpacity="0.82" />
          <rect x="60" y="97" width="40" height="8" rx="4" fill="#A7F3D0" />
        </>
      )}

      {motif === "ops" && (
        <>
          <rect x="38" y="50" width="34" height="28" rx="8" fill="#0F172A" />
          <rect x="88" y="44" width="34" height="34" rx="10" fill="#1E293B" />
          <rect x="44" y="56" width="22" height="4" rx="2" fill="#38BDF8" />
          <rect x="44" y="64" width="16" height="4" rx="2" fill="#A5F3FC" />
          <rect x="94" y="50" width="22" height="4" rx="2" fill="#F472B6" />
          <rect x="94" y="58" width="18" height="4" rx="2" fill="#FDE68A" />
          <rect x="50" y="92" width="60" height="18" rx="9" fill="#020617" fillOpacity="0.86" />
          <circle cx="46" cy="98" r="4" fill={accent} />
          <circle cx="58" cy="98" r="4" fill="#F472B6" />
          <circle cx="70" cy="98" r="4" fill="#FDE68A" />
        </>
      )}

      {motif === "launch" && (
        <>
          <rect x="46" y="92" width="68" height="16" rx="8" fill="#0F172A" fillOpacity="0.82" />
          <rect x="56" y="54" width="48" height="32" rx="10" fill="#FFF7ED" />
          <path d="M80 40c8 7 12 15 12 24-5 4-9 6-12 6s-7-2-12-6c0-9 4-17 12-24Z" fill={accent} />
          <path d="M74 66 64 80" stroke="#FB923C" strokeWidth="4" strokeLinecap="round" />
          <path d="M86 66 96 80" stroke="#FB923C" strokeWidth="4" strokeLinecap="round" />
          <circle cx="80" cy="55" r="5" fill="#F8FAFC" />
          <path d="M80 70v12" stroke="#1E293B" strokeWidth="4" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

function renderProfileAvatarArt(presetId: string) {
  switch (presetId) {
    case "pro-ana-builder":
      return (
        <ProfessionalAvatarArt
          seed={presetId}
          bgFrom="#DFF8F0"
          bgTo="#A7F3D0"
          accent="#0F766E"
          skin="#E8B58E"
          hair="#3F2A20"
          shirt="#14532D"
          desk="#F8FAFC"
          laptop="#1E293B"
          panel="#CCFBF1"
          accessory="earring"
          prop="plant"
        />
      );
    case "pro-maya-designer":
      return (
        <ProfessionalAvatarArt
          seed={presetId}
          bgFrom="#FAE8FF"
          bgTo="#F5D0FE"
          accent="#C026D3"
          skin="#D9A27B"
          hair="#111827"
          shirt="#7C3AED"
          desk="#FFF7ED"
          laptop="#334155"
          panel="#FCE7F3"
          accessory="glasses"
          prop="tablet"
        />
      );
    case "pro-liam-architect":
      return (
        <ProfessionalAvatarArt
          seed={presetId}
          bgFrom="#E0F2FE"
          bgTo="#BAE6FD"
          accent="#2563EB"
          skin="#F0C39A"
          hair="#4B5563"
          shirt="#1F2937"
          desk="#E2E8F0"
          laptop="#0F172A"
          panel="#DBEAFE"
          accessory="beanie"
          prop="notebook"
        />
      );
    case "pro-omar-analyst":
      return (
        <ProfessionalAvatarArt
          seed={presetId}
          bgFrom="#FEF3C7"
          bgTo="#FDBA74"
          accent="#B45309"
          skin="#B98063"
          hair="#231815"
          shirt="#7C2D12"
          desk="#FFF7ED"
          laptop="#1E293B"
          panel="#FDE68A"
          accessory="headset"
          prop="mug"
        />
      );
    case "sticker-retro-bot":
      return (
        <StickerAvatarArt
          seed={presetId}
          bgFrom="#BFDBFE"
          bgTo="#60A5FA"
          accent="#F8FAFC"
          stickerFill="#1D4ED8"
          motif="robot"
        />
      );
    case "sticker-pixel-coder":
      return (
        <StickerAvatarArt
          seed={presetId}
          bgFrom="#F5D0FE"
          bgTo="#C084FC"
          accent="#581C87"
          stickerFill="#F3E8FF"
          motif="pixel"
        />
      );
    case "sticker-night-ops":
      return (
        <StickerAvatarArt
          seed={presetId}
          bgFrom="#1E293B"
          bgTo="#0F172A"
          accent="#22D3EE"
          stickerFill="#111827"
          motif="ops"
        />
      );
    case "sticker-launch-lab":
      return (
        <StickerAvatarArt
          seed={presetId}
          bgFrom="#FED7AA"
          bgTo="#FB923C"
          accent="#EA580C"
          stickerFill="#FFFBEB"
          motif="launch"
        />
      );
    default:
      return (
        <StickerAvatarArt
          seed="fallback-sticker"
          bgFrom="#DCFCE7"
          bgTo="#86EFAC"
          accent="#15803D"
          stickerFill="#F0FDF4"
          motif="robot"
        />
      );
  }
}

export function ProfileAvatar({
  authorId,
  avatarId,
  username,
  size = "md",
  className,
}: ProfileAvatarProps) {
  const resolvedAuthorId = authorId || username || "readative-guest";
  const preset = resolveProfileVisualPreset(resolvedAuthorId, avatarId);

  return (
    <div
      className={cn(
        "overflow-hidden rounded-full border border-white/55 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.12)]",
        AVATAR_SIZE_CLASSNAMES[size],
        className,
      )}
      title={preset.description}
      aria-label={`${username ? `@${username}` : "Readative member"} profile picture`}
    >
      {renderProfileAvatarArt(preset.id)}
    </div>
  );
}
