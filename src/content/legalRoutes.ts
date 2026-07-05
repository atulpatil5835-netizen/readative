export const LEGAL_PAGE_SLUGS = [
  "about",
  "projects",
  "mission",
  "support",
  "contact",
  "community",
  "privacy",
  "terms",
  "disclaimer",
  "cookies",
  "editorial-policy",
  "content-policy",
  "corrections-policy",
  "copyright",
  "dmca",
] as const;

export type LegalSlug = (typeof LEGAL_PAGE_SLUGS)[number];

const LEGAL_PAGE_SLUG_SET = new Set<string>(LEGAL_PAGE_SLUGS);

export function isLegalPageSlug(value: string): value is LegalSlug {
  return LEGAL_PAGE_SLUG_SET.has(value);
}

