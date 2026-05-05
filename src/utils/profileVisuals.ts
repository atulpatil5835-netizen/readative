export type ProfileVisualCategory = "professional" | "sticker";

export interface ProfileVisualPreset {
  id: string;
  label: string;
  description: string;
  category: ProfileVisualCategory;
}

export const PROFESSIONAL_PROFILE_VISUALS: ProfileVisualPreset[] = [
  {
    id: "pro-ana-builder",
    label: "Ana Builder",
    description: "Focused builder with a laptop, plant, and clean desk setup.",
    category: "professional",
  },
  {
    id: "pro-maya-designer",
    label: "Maya Designer",
    description: "Creative designer with a laptop, tablet, and bright studio mood.",
    category: "professional",
  },
  {
    id: "pro-liam-architect",
    label: "Liam Architect",
    description: "Calm systems architect with a workspace monitor and notebook.",
    category: "professional",
  },
  {
    id: "pro-omar-analyst",
    label: "Omar Analyst",
    description: "Technical analyst with a headset, dashboard screen, and coffee.",
    category: "professional",
  },
];

export const STICKER_PROFILE_VISUALS: ProfileVisualPreset[] = [
  {
    id: "sticker-retro-bot",
    label: "Retro Bot",
    description: "Vintage robot sticker with terminal lights and a compact laptop.",
    category: "sticker",
  },
  {
    id: "sticker-pixel-coder",
    label: "Pixel Coder",
    description: "Pixel-inspired coding sticker with keyboard energy and playful motion.",
    category: "sticker",
  },
  {
    id: "sticker-night-ops",
    label: "Night Ops",
    description: "Deep-night ops sticker with dual screens and an alert console vibe.",
    category: "sticker",
  },
  {
    id: "sticker-launch-lab",
    label: "Launch Lab",
    description: "Startup launch sticker with a rocket laptop and bright lab colors.",
    category: "sticker",
  },
];

export const PROFILE_VISUAL_PRESETS: ProfileVisualPreset[] = [
  ...PROFESSIONAL_PROFILE_VISUALS,
  ...STICKER_PROFILE_VISUALS,
];

const PROFILE_VISUAL_MAP = new Map(
  PROFILE_VISUAL_PRESETS.map((preset) => [preset.id, preset] as const),
);

function hashSeed(value: string) {
  let hash = 0;

  for (const character of value) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return hash;
}

export function getProfileVisualPreset(id: string | null | undefined) {
  if (!id) return null;
  return PROFILE_VISUAL_MAP.get(id) || null;
}

export function isValidProfileVisualId(id: string | null | undefined) {
  return Boolean(id && PROFILE_VISUAL_MAP.has(id));
}

export function getDefaultProfileVisualId(authorId: string) {
  const index = hashSeed(authorId) % PROFESSIONAL_PROFILE_VISUALS.length;
  return PROFESSIONAL_PROFILE_VISUALS[index].id;
}

export function getLegacyStickerProfileVisualId(authorId: string) {
  const index = hashSeed(authorId) % STICKER_PROFILE_VISUALS.length;
  return STICKER_PROFILE_VISUALS[index].id;
}

export function resolveProfileVisualPreset(
  authorId: string,
  avatarId?: string | null,
) {
  const selectedPreset = getProfileVisualPreset(avatarId);
  if (selectedPreset) {
    return selectedPreset;
  }

  const legacyFallbackId = getLegacyStickerProfileVisualId(authorId);
  return PROFILE_VISUAL_MAP.get(legacyFallbackId) || STICKER_PROFILE_VISUALS[0];
}
