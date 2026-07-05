import { isLegalPageSlug, type LegalSlug } from "../content/legalRoutes";

export type AppTab = "knowledge" | "smarttalk" | "explore" | "profile";
export type AppRouteTab = AppTab | "legal" | "notFound";

export const CANONICAL_SITE_ORIGIN = "https://www.readative.com";

export interface RouteOptions {
  focusedEntryId?: string | null;
  profileAuthorId?: string | null;
  selectedHashtag?: string | null;
  selectedTopic?: string | null;
  section?: string | null;
  legalSlug?: LegalSlug | null;
}

export interface ParsedAppRoute {
  tab: AppRouteTab;
  focusedEntryId: string | null;
  profileAuthorId: string | null;
  selectedHashtag: string | null;
  selectedTopic: string | null;
  legalSlug: LegalSlug | null;
  source: "hash" | "path";
  attemptedLocation: string;
}

export const ROUTE_CHANGE_EVENT = "readative:routechange";

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function normalizePathname(pathname: string) {
  if (!pathname || pathname === "/") {
    return "/";
  }

  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed || "/";
}

function normalizeTag(tag: string | null | undefined) {
  return normalizeRouteSlug(tag);
}

const ROUTE_CATEGORY_ALIASES: Record<string, string> = {
  ai: "ai",
  "artificial-intelligence": "ai",
  technology: "technology",
  tech: "technology",
  apps: "technology",
  tools: "technology",
  business: "business",
  strategy: "business",
  marketing: "marketing",
  "digital-marketing": "marketing",
  startup: "startup",
  startups: "startup",
  founders: "startup",
  productivity: "productivity",
  workflow: "productivity",
  development: "development",
  programming: "development",
  coding: "development",
  software: "development",
  cybersecurity: "cybersecurity",
  security: "cybersecurity",
  privacy: "cybersecurity",
};

function normalizeRouteSlug(value: string | null | undefined) {
  const normalized = value
    ?.replace(/^#/, "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || null;
}

function normalizeCategorySlug(value: string | null | undefined) {
  const normalized = normalizeRouteSlug(value);
  return normalized ? ROUTE_CATEGORY_ALIASES[normalized] || null : null;
}

function normalizeTopic(topic: string | null | undefined) {
  const normalized = normalizeRouteSlug(topic);
  return normalized && normalized !== "all" ? normalized : null;
}

function normalizeKnowledgeTopic(topic: string | null | undefined) {
  const category = normalizeCategorySlug(topic);
  if (category) return category;

  return normalizeTopic(topic);
}

function getKnowledgeSearchOptions(search: string) {
  const params = new URLSearchParams(search);

  return {
    selectedHashtag: normalizeTag(params.get("tag")),
    selectedTopic: normalizeKnowledgeTopic(params.get("topic")),
  };
}

function createRoute(
  tab: AppRouteTab,
  source: "hash" | "path",
  attemptedLocation: string,
  options: RouteOptions = {}
): ParsedAppRoute {
  return {
    tab,
    source,
    attemptedLocation,
    focusedEntryId: options.focusedEntryId ?? null,
    profileAuthorId: options.profileAuthorId ?? null,
    selectedHashtag: options.selectedHashtag ?? null,
    selectedTopic: options.selectedTopic ?? null,
    legalSlug: options.legalSlug ?? null,
  };
}

function parseLegalRoute(
  routePart: string,
  source: "hash" | "path",
  attemptedLocation: string,
) {
  if (source !== "path" || !routePart.startsWith("/")) {
    return null;
  }

  const legalSlug = safeDecode(routePart.slice(1));
  if (!legalSlug || !isLegalPageSlug(legalSlug)) {
    return null;
  }

  return createRoute("legal", source, attemptedLocation, { legalSlug });
}

function parseKnowledgeRoute(
  routePart: string,
  search: string,
  source: "hash" | "path",
  attemptedLocation: string
) {
  if (routePart === "knowledge" || routePart === "/knowledge" || routePart === "/") {
    return createRoute(
      "knowledge",
      source,
      attemptedLocation,
      getKnowledgeSearchOptions(search),
    );
  }

  const knowledgePrefix = source === "hash" ? "knowledge/" : "/knowledge/";
  if (routePart.startsWith(knowledgePrefix)) {
    const focusedEntryId = safeDecode(routePart.slice(knowledgePrefix.length));
    if (!focusedEntryId) {
      return createRoute("notFound", source, attemptedLocation);
    }

    return createRoute("knowledge", source, attemptedLocation, {
      focusedEntryId,
    });
  }

  return null;
}

function parseProfileRoute(
  routePart: string,
  source: "hash" | "path",
  attemptedLocation: string
) {
  if (routePart === "profile" || routePart === "/profile") {
    return createRoute("profile", source, attemptedLocation);
  }

  const profilePrefix = source === "hash" ? "profile/" : "/profile/";
  if (routePart.startsWith(profilePrefix)) {
    const profileAuthorId = safeDecode(routePart.slice(profilePrefix.length));
    if (!profileAuthorId) {
      return createRoute("notFound", source, attemptedLocation);
    }

    return createRoute("profile", source, attemptedLocation, {
      profileAuthorId,
    });
  }

  return null;
}

function parseTopicRoute(
  routePart: string,
  source: "hash" | "path",
  attemptedLocation: string,
) {
  const topicPrefix = source === "hash" ? "topic/" : "/topic/";

  if (!routePart.startsWith(topicPrefix)) {
    return null;
  }

  const selectedTopic = normalizeTopic(safeDecode(routePart.slice(topicPrefix.length)));
  if (!selectedTopic) {
    return createRoute("notFound", source, attemptedLocation);
  }

  return createRoute("explore", source, attemptedLocation, {
    selectedTopic,
  });
}

function parseCategoryRoute(
  routePart: string,
  search: string,
  source: "hash" | "path",
  attemptedLocation: string,
) {
  const categoryPrefix = source === "hash" ? "category/" : "/category/";

  if (!routePart.startsWith(categoryPrefix)) {
    return null;
  }

  const selectedTopic = normalizeCategorySlug(
    safeDecode(routePart.slice(categoryPrefix.length)),
  );
  if (!selectedTopic) {
    return createRoute("notFound", source, attemptedLocation);
  }

  const params = new URLSearchParams(search);
  const focusedEntryId = params.get("id") || params.get("question");

  return createRoute("smarttalk", source, attemptedLocation, {
    selectedTopic,
    focusedEntryId,
  });
}


function parseTagRoute(
  routePart: string,
  source: "hash" | "path",
  attemptedLocation: string,
) {
  const tagPrefix = source === "hash" ? "tag/" : "/tag/";

  if (!routePart.startsWith(tagPrefix)) {
    return null;
  }

  const selectedHashtag = normalizeRouteSlug(safeDecode(routePart.slice(tagPrefix.length)));
  if (!selectedHashtag) {
    return createRoute("notFound", source, attemptedLocation);
  }

  return createRoute("knowledge", source, attemptedLocation, {
    selectedHashtag,
  });
}

function parsePostRoute(
  routePart: string,
  source: "hash" | "path",
  attemptedLocation: string,
) {
  const postPrefix = source === "hash" ? "post/" : "/post/";

  if (!routePart.startsWith(postPrefix)) {
    return null;
  }

  const focusedEntryId = safeDecode(routePart.slice(postPrefix.length));
  if (!focusedEntryId) {
    return createRoute("notFound", source, attemptedLocation);
  }

  return createRoute("knowledge", source, attemptedLocation, {
    focusedEntryId,
  });
}

function parseSmartTalkCanonicalRoute(
  routePart: string,
  source: "hash" | "path",
  attemptedLocation: string,
) {
  const hubPath = source === "hash" ? "smarttalks" : "/smarttalks";
  if (routePart === hubPath) {
    return createRoute("smarttalk", source, attemptedLocation);
  }

  const questionPrefix = source === "hash" ? "smarttalks/" : "/smarttalks/";
  if (!routePart.startsWith(questionPrefix)) return null;

  const focusedEntryId = safeDecode(routePart.slice(questionPrefix.length));
  if (!focusedEntryId) {
    return createRoute("notFound", source, attemptedLocation);
  }

  return createRoute("smarttalk", source, attemptedLocation, {
    focusedEntryId,
  });
}

function parseHashRoute(hash: string) {
  const cleanedHash = hash.replace(/^#/, "").trim();
  const attemptedLocation = cleanedHash ? `#${cleanedHash}` : "#";

  if (!cleanedHash) {
    return createRoute("knowledge", "hash", attemptedLocation);
  }

  const [routePart, search = ""] = cleanedHash.split("?");

  if (routePart === "smarttalk") {
    const params = new URLSearchParams(search);
    const focusedEntryId = params.get("id") || params.get("question");
    return createRoute("smarttalk", "hash", attemptedLocation, {
      focusedEntryId,
    });
  }

  if (routePart === "explore" || routePart === "jobs") {
    return createRoute("explore", "hash", attemptedLocation);
  }

  return (
    parseCategoryRoute(routePart, search, "hash", attemptedLocation) ||
    parseSmartTalkCanonicalRoute(routePart, "hash", attemptedLocation) ||
    parseTagRoute(routePart, "hash", attemptedLocation) ||
    parsePostRoute(routePart, "hash", attemptedLocation) ||
    parseTopicRoute(routePart, "hash", attemptedLocation) ||
    parseKnowledgeRoute(routePart, search, "hash", attemptedLocation) ||
    parseProfileRoute(routePart, "hash", attemptedLocation) ||
    createRoute("notFound", "hash", attemptedLocation)
  );
}

function parsePathRoute(pathname: string, search: string) {
  const normalizedPathname = normalizePathname(pathname);
  const attemptedLocation = `${normalizedPathname}${search}`;

  if (normalizedPathname === "/" || normalizedPathname === "/index.html") {
    return createRoute(
      "knowledge",
      "path",
      attemptedLocation,
      getKnowledgeSearchOptions(search),
    );
  }

  if (normalizedPathname === "/smarttalk") {
    const params = new URLSearchParams(search);
    const focusedEntryId = params.get("id") || params.get("question");
    return createRoute("smarttalk", "path", attemptedLocation, {
      focusedEntryId,
    });
  }

  const canonicalSmartTalkRoute = parseSmartTalkCanonicalRoute(
    normalizedPathname,
    "path",
    attemptedLocation,
  );
  if (canonicalSmartTalkRoute) return canonicalSmartTalkRoute;

  if (normalizedPathname === "/explore" || normalizedPathname === "/jobs") {
    return createRoute("explore", "path", attemptedLocation);
  }

  if (normalizedPathname === "/404" || normalizedPathname === "/not-found") {
    return createRoute(
      "notFound",
      "path",
      new URLSearchParams(search).get("from") || attemptedLocation,
    );
  }

  return (
    parseLegalRoute(normalizedPathname, "path", attemptedLocation) ||
    parseCategoryRoute(normalizedPathname, search, "path", attemptedLocation) ||
    parseTagRoute(normalizedPathname, "path", attemptedLocation) ||
    parsePostRoute(normalizedPathname, "path", attemptedLocation) ||
    parseTopicRoute(normalizedPathname, "path", attemptedLocation) ||
    parseKnowledgeRoute(normalizedPathname, search, "path", attemptedLocation) ||
    parseProfileRoute(normalizedPathname, "path", attemptedLocation) ||
    createRoute("notFound", "path", attemptedLocation)
  );
}

export function parseRouteFromLocation(locationLike = window.location) {
  const { hash, pathname, search } = locationLike;

  if (hash) {
    return parseHashRoute(hash);
  }

  return parsePathRoute(pathname, search);
}

export function buildPublicPath(tab: AppTab, options: RouteOptions = {}) {
  if (tab === "knowledge" && options.focusedEntryId) {
    return `/post/${encodeURIComponent(options.focusedEntryId)}`;
  }

  if (tab === "knowledge") {
    const params = new URLSearchParams();
    const selectedHashtag = normalizeTag(options.selectedHashtag);
    const selectedTopic = normalizeKnowledgeTopic(options.selectedTopic);

    if (selectedHashtag && !selectedTopic) {
      return `/tag/${encodeURIComponent(selectedHashtag)}`;
    }

    if (selectedHashtag) {
      params.set("tag", selectedHashtag);
    }

    if (selectedTopic) {
      params.set("topic", selectedTopic);
    }

    const search = params.toString();
    return search ? `/knowledge?${search}` : "/";
  }

  if (tab === "profile" && options.profileAuthorId) {
    const base = `/profile/${encodeURIComponent(options.profileAuthorId)}`;
    return options.section ? `${base}?tab=${encodeURIComponent(options.section)}` : base;
  }

  if (tab === "profile") {
    return options.section ? `/profile?tab=${encodeURIComponent(options.section)}` : "/profile";
  }

  if (tab === "explore" && options.selectedTopic) {
    const selectedTopic = normalizeTopic(options.selectedTopic);

    return selectedTopic ? `/topic/${encodeURIComponent(selectedTopic)}` : "/explore";
  }

  if (tab === "explore") {
    return "/explore";
  }

  if (tab === "smarttalk") {
    if (options.focusedEntryId) {
      return `/smarttalks/${encodeURIComponent(options.focusedEntryId)}`;
    }

    const category = options.selectedTopic ? normalizeCategorySlug(options.selectedTopic) : null;
    if (category) {
      return `/category/${encodeURIComponent(category)}`;
    }
    return "/smarttalks";
  }

  return "/";
}

export function buildAbsoluteRouteUrl(
  tab: AppTab,
  options: RouteOptions = {},
  origin = CANONICAL_SITE_ORIGIN,
) {
  return `${origin}${buildPublicPath(tab, options)}`;
}

export function buildHashRoute(tab: AppTab, options: RouteOptions = {}) {
  if (tab === "knowledge" && options.focusedEntryId) {
    return `#knowledge/${encodeURIComponent(options.focusedEntryId)}`;
  }

  if (tab === "knowledge") {
    const params = new URLSearchParams();
    const selectedHashtag = normalizeTag(options.selectedHashtag);
    const selectedTopic = normalizeKnowledgeTopic(options.selectedTopic);

    if (selectedHashtag) {
      params.set("tag", selectedHashtag);
    }

    if (selectedTopic) {
      params.set("topic", selectedTopic);
    }

    const search = params.toString();
    return search ? `#knowledge?${search}` : "#knowledge";
  }

  if (tab === "profile" && options.profileAuthorId) {
    const base = `#profile/${encodeURIComponent(options.profileAuthorId)}`;
    return options.section ? `${base}?tab=${encodeURIComponent(options.section)}` : base;
  }

  if (tab === "profile") {
    return options.section ? `#profile?tab=${encodeURIComponent(options.section)}` : "#profile";
  }

  if (tab === "smarttalk") {
    const params = new URLSearchParams();
    if (options.focusedEntryId) {
      params.set("id", options.focusedEntryId);
    }
    const category = options.selectedTopic ? normalizeCategorySlug(options.selectedTopic) : null;
    if (category) {
      const search = params.toString();
      return `#category/${encodeURIComponent(category)}${search ? `?${search}` : ""}`;
    }
    const search = params.toString();
    return search ? `#smarttalk?${search}` : "#smarttalk";
  }

  if (tab === "explore" && options.selectedTopic) {
    const selectedTopic = normalizeTopic(options.selectedTopic);

    return selectedTopic
      ? `#topic/${encodeURIComponent(selectedTopic)}`
      : "#explore";
  }

  if (tab === "explore") {
    return "#explore";
  }

  return "#knowledge";
}

export function navigateToRoute(
  tab: AppTab,
  options: RouteOptions = {},
  mode: "push" | "replace" = "push"
) {
  const targetPath = buildPublicPath(tab, options);
  const method = mode === "replace" ? "replaceState" : "pushState";

  window.history[method](null, "", targetPath);
  window.dispatchEvent(new Event(ROUTE_CHANGE_EVENT));
}

export function navigateToNotFound(
  attemptedLocation: string,
  mode: "push" | "replace" = "replace",
) {
  const method = mode === "replace" ? "replaceState" : "pushState";
  const targetPath = `/404?from=${encodeURIComponent(attemptedLocation)}`;

  window.history[method](null, "", targetPath);
  window.dispatchEvent(new Event(ROUTE_CHANGE_EVENT));
}
