export type AppTab = "knowledge" | "smarttalk" | "explore" | "profile";

export const CANONICAL_SITE_ORIGIN = "https://www.readative.com";

export interface RouteOptions {
  focusedEntryId?: string | null;
  profileAuthorId?: string | null;
  selectedHashtag?: string | null;
  selectedTopic?: string | null;
}

export interface ParsedAppRoute {
  tab: AppTab | "notFound";
  focusedEntryId: string | null;
  profileAuthorId: string | null;
  selectedHashtag: string | null;
  selectedTopic: string | null;
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
  const normalized = tag?.replace(/^#/, "").trim().toLowerCase();
  return normalized || null;
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
  tab: AppTab | "notFound",
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
  };
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

  return createRoute("knowledge", source, attemptedLocation, {
    selectedTopic,
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

function parseHashRoute(hash: string) {
  const cleanedHash = hash.replace(/^#/, "").trim();
  const attemptedLocation = cleanedHash ? `#${cleanedHash}` : "#";

  if (!cleanedHash) {
    return createRoute("knowledge", "hash", attemptedLocation);
  }

  const [routePart, search = ""] = cleanedHash.split("?");

  if (routePart === "smarttalk") {
    return createRoute("smarttalk", "hash", attemptedLocation);
  }

  if (routePart === "explore" || routePart === "jobs") {
    return createRoute("explore", "hash", attemptedLocation);
  }

  return (
    parseCategoryRoute(routePart, "hash", attemptedLocation) ||
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
    return createRoute("smarttalk", "path", attemptedLocation);
  }

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
    parseCategoryRoute(normalizedPathname, "path", attemptedLocation) ||
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

    const category = selectedTopic ? normalizeCategorySlug(selectedTopic) : null;
    if (category && !selectedHashtag) {
      return `/category/${encodeURIComponent(category)}`;
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
    return `/profile/${encodeURIComponent(options.profileAuthorId)}`;
  }

  if (tab === "profile") {
    return "/profile";
  }

  if (tab === "explore" && options.selectedTopic) {
    const selectedTopic = normalizeTopic(options.selectedTopic);

    return selectedTopic ? `/topic/${encodeURIComponent(selectedTopic)}` : "/explore";
  }

  if (tab === "explore") {
    return "/explore";
  }

  if (tab === "smarttalk") {
    return "/smarttalk";
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
    return `#profile/${encodeURIComponent(options.profileAuthorId)}`;
  }

  if (tab === "profile") {
    return "#profile";
  }

  if (tab === "smarttalk") {
    return "#smarttalk";
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
