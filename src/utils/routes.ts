export type AppTab = "knowledge" | "smarttalk" | "profile";

export interface RouteOptions {
  focusedEntryId?: string | null;
  profileAuthorId?: string | null;
  selectedHashtag?: string | null;
}

export interface ParsedAppRoute {
  tab: AppTab | "notFound";
  focusedEntryId: string | null;
  profileAuthorId: string | null;
  selectedHashtag: string | null;
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
  };
}

function parseKnowledgeRoute(
  routePart: string,
  search: string,
  source: "hash" | "path",
  attemptedLocation: string
) {
  if (routePart === "knowledge" || routePart === "/knowledge" || routePart === "/") {
    return createRoute("knowledge", source, attemptedLocation, {
      selectedHashtag: normalizeTag(new URLSearchParams(search).get("tag")),
    });
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

  return (
    parseKnowledgeRoute(routePart, search, "hash", attemptedLocation) ||
    parseProfileRoute(routePart, "hash", attemptedLocation) ||
    createRoute("notFound", "hash", attemptedLocation)
  );
}

function parsePathRoute(pathname: string, search: string) {
  const normalizedPathname = normalizePathname(pathname);
  const attemptedLocation = `${normalizedPathname}${search}`;

  if (normalizedPathname === "/" || normalizedPathname === "/index.html") {
    return createRoute("knowledge", "path", attemptedLocation, {
      selectedHashtag: normalizeTag(new URLSearchParams(search).get("tag")),
    });
  }

  if (normalizedPathname === "/smarttalk") {
    return createRoute("smarttalk", "path", attemptedLocation);
  }

  return (
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
    return `/knowledge/${encodeURIComponent(options.focusedEntryId)}`;
  }

  if (tab === "knowledge" && options.selectedHashtag) {
    return `/knowledge?tag=${encodeURIComponent(
      normalizeTag(options.selectedHashtag) || ""
    )}`;
  }

  if (tab === "profile" && options.profileAuthorId) {
    return `/profile/${encodeURIComponent(options.profileAuthorId)}`;
  }

  if (tab === "profile") {
    return "/profile";
  }

  if (tab === "smarttalk") {
    return "/smarttalk";
  }

  return "/";
}

export function buildAbsoluteRouteUrl(
  tab: AppTab,
  options: RouteOptions = {},
  origin =
    typeof window === "undefined" ? "https://readative.com" : window.location.origin
) {
  return `${origin}${buildPublicPath(tab, options)}`;
}

export function buildHashRoute(tab: AppTab, options: RouteOptions = {}) {
  if (tab === "knowledge" && options.focusedEntryId) {
    return `#knowledge/${encodeURIComponent(options.focusedEntryId)}`;
  }

  if (tab === "knowledge" && options.selectedHashtag) {
    return `#knowledge?tag=${encodeURIComponent(
      normalizeTag(options.selectedHashtag) || ""
    )}`;
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
