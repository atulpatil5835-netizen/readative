import fs from "node:fs";
import path from "node:path";
import { LEGAL_PAGE_SLUGS } from "../src/content/legalRoutes.js";

const DEFAULT_ORIGIN = "https://www.readative.com";
const FALLBACK_ORIGIN = "https://readative.com";
const DEFAULT_TIMEOUT_MS = readEnvNumber("READATIVE_ROUTE_VERIFY_TIMEOUT_MS", 60_000);
const DEFAULT_CONCURRENCY = 3;
const USER_AGENT = "ReadativeLiveRouteVerifier/1.0";
const REPORT_PATH = path.join(process.cwd(), "live_route_verification_report.json");

type HttpMethod = "GET" | "HEAD";

interface HttpResult {
  url: string;
  method: HttpMethod;
  status: number;
  statusText: string;
  location: string;
  contentType: string;
  headers: Record<string, string>;
  elapsedMs: number;
  body?: string;
  error?: string;
}

interface RouteStatusCheck {
  name: string;
  category: string;
  url: string;
  path: string;
  method: HttpMethod;
  status: number;
  contentType: string;
  elapsedMs: number;
  ok: boolean;
  error?: string;
}

interface CanonicalDocumentCheck {
  name: string;
  category: string;
  url: string;
  status: number;
  canonicalUrl: string;
  ok: boolean;
  error?: string;
}

interface RedirectStep {
  url: string;
  method: HttpMethod;
  status: number;
  location: string;
}

interface RedirectCheck {
  name: string;
  category: string;
  startUrl: string;
  expectedFinalUrl: string;
  finalUrl: string;
  finalStatus: number;
  redirected: boolean;
  ok: boolean;
  steps: RedirectStep[];
  error?: string;
}

function readEnvNumber(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function normalizeOrigin(origin: string) {
  return origin.replace(/\/+$/, "");
}

const ORIGIN = normalizeOrigin(process.env.READATIVE_VERIFY_ORIGIN || DEFAULT_ORIGIN);
const ALT_ORIGIN = normalizeOrigin(
  process.env.READATIVE_VERIFY_ALT_ORIGIN || FALLBACK_ORIGIN,
);
const CONCURRENCY = readEnvNumber(
  "READATIVE_ROUTE_VERIFY_CONCURRENCY",
  DEFAULT_CONCURRENCY,
);

function absoluteUrl(pathOrUrl: string, origin = ORIGIN) {
  if (/^https?:\/\//i.test(pathOrUrl)) {
    return pathOrUrl;
  }

  return `${origin}${pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`}`;
}

function comparableUrl(value: string) {
  const url = new URL(value);
  url.hash = "";
  if (url.pathname.length > 1) {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }
  return url.toString();
}

function sameUrl(left: string, right: string) {
  return comparableUrl(left) === comparableUrl(right);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const cause =
    error.cause &&
    typeof error.cause === "object" &&
    "code" in error.cause
      ? ` (${String((error.cause as { code?: unknown }).code)})`
      : "";
  return `${error.message}${cause}`;
}

async function request(
  url: string,
  method: HttpMethod,
  readBody = false,
): Promise<HttpResult> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method,
      redirect: "manual",
      signal: controller.signal,
      headers: {
        "User-Agent": USER_AGENT,
        Accept:
          method === "HEAD"
            ? "*/*"
            : "text/html,application/xhtml+xml,application/xml,text/plain;q=0.9,*/*;q=0.8",
      },
    });
    const location = response.headers.get("location");

    const body = readBody ? await response.text() : undefined;
    if (!readBody) {
      await response.body?.cancel().catch(() => undefined);
    }

    return {
      url,
      method,
      status: response.status,
      statusText: response.statusText,
      location: location ? new URL(location, url).toString() : "",
      contentType: response.headers.get("content-type") || "",
      headers: Object.fromEntries(response.headers.entries()),
      elapsedMs: Date.now() - startedAt,
      body,
    };
  } catch (error) {
    return {
      url,
      method,
      status: 0,
      statusText: "Request failed",
      location: "",
      contentType: "",
      headers: {},
      elapsedMs: Date.now() - startedAt,
      error: getErrorMessage(error),
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function requestWithRetry(
  url: string,
  method: HttpMethod,
  readBody = false,
) {
  let result = await request(url, method, readBody);

  if (result.status === 0 || result.status === 429 || result.status >= 500) {
    await delay(700);
    result = await request(url, method, readBody);
  }

  return result;
}

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'");
}

function parseSitemapUrls(xml: string) {
  return [...xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi)]
    .map((match) => decodeXml(match[1].trim()))
    .filter(Boolean);
}

function extractCanonicalUrl(html: string | undefined) {
  if (!html) return "";

  const tag = html.match(/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/i)?.[0];
  if (!tag) return "";

  return tag.match(/\bhref=["']([^"']+)["']/i)?.[1] || "";
}

function extractSeoDocumentId(url: string) {
  const pathname = new URL(url).pathname;
  const segment = decodeURIComponent(pathname.split("/").filter(Boolean).pop() || "");
  const separatorIndex = segment.lastIndexOf("--");
  return separatorIndex >= 0 ? segment.slice(separatorIndex + 2) : segment;
}

function extractSeoDocumentSegment(url: string) {
  return new URL(url).pathname.split("/").filter(Boolean).pop() || "";
}

const legalPaths = new Set(LEGAL_PAGE_SLUGS.map((slug) => `/${slug}`));

function classifyRoute(url: string) {
  const pathname = new URL(url).pathname.replace(/\/+$/, "") || "/";

  if (pathname === "/") return "home";
  if (pathname === "/robots.txt") return "robots";
  if (pathname === "/sitemap.xml") return "sitemap";
  if (pathname === "/posts") return "discovery";
  if (pathname.startsWith("/posts/")) return "article";
  if (pathname === "/smarttalks" || pathname.startsWith("/smarttalk/")) {
    return "smarttalk";
  }
  if (pathname.startsWith("/@")) return "profile";
  if (legalPaths.has(pathname)) return "legal";
  if (pathname === "/explore") return "explore";
  if (pathname.startsWith("/category/")) return "category";
  if (pathname.startsWith("/topic/")) return "topic";
  if (pathname.startsWith("/tag/")) return "tag";
  return "other";
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
) {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workerCount = Math.min(limit, Math.max(items.length, 1));

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await mapper(items[index], index);
      }
    }),
  );

  return results;
}

async function checkRouteStatus(
  name: string,
  url: string,
  category = classifyRoute(url),
  preferredMethod: HttpMethod = "HEAD",
): Promise<RouteStatusCheck> {
  let response = await requestWithRetry(url, preferredMethod);

  if (preferredMethod === "HEAD" && [0, 403, 405, 501].includes(response.status)) {
    response = await requestWithRetry(url, "GET");
  }

  return {
    name,
    category,
    url,
    path: new URL(url).pathname,
    method: response.method,
    status: response.status,
    contentType: response.contentType,
    elapsedMs: response.elapsedMs,
    ok: response.status === 200,
    error: response.error,
  };
}

async function checkCanonicalDocument(
  name: string,
  url: string,
  category = classifyRoute(url),
): Promise<CanonicalDocumentCheck> {
  const response = await requestWithRetry(url, "GET", true);
  const canonicalUrl = extractCanonicalUrl(response.body);

  return {
    name,
    category,
    url,
    status: response.status,
    canonicalUrl,
    ok: response.status === 200 && Boolean(canonicalUrl) && sameUrl(canonicalUrl, url),
    error: response.error,
  };
}

function isRedirectStatus(status: number) {
  return status >= 300 && status < 400;
}

async function checkRedirectChain(
  name: string,
  startUrl: string,
  expectedFinalUrl: string,
  category = "redirect",
): Promise<RedirectCheck> {
  const steps: RedirectStep[] = [];
  const seen = new Set<string>();
  let currentUrl = startUrl;
  let finalStatus = 0;
  let error = "";

  for (let index = 0; index < 8; index += 1) {
    if (seen.has(currentUrl)) {
      error = "Redirect loop detected.";
      break;
    }
    seen.add(currentUrl);

    let response = await requestWithRetry(currentUrl, "HEAD");
    if ([403, 405, 501].includes(response.status)) {
      response = await requestWithRetry(currentUrl, "GET");
    }

    steps.push({
      url: currentUrl,
      method: response.method,
      status: response.status,
      location: response.location,
    });

    if (isRedirectStatus(response.status)) {
      if (!response.location) {
        error = "Redirect response did not include a Location header.";
        finalStatus = response.status;
        break;
      }

      currentUrl = response.location;
      continue;
    }

    finalStatus = response.status;
    break;
  }

  if (!finalStatus && !error) {
    error = "Redirect chain did not resolve within the maximum hop count.";
  }

  const redirected = steps.some((step) => isRedirectStatus(step.status));
  const ok =
    redirected &&
    finalStatus === 200 &&
    sameUrl(currentUrl, expectedFinalUrl) &&
    !error;

  return {
    name,
    category,
    startUrl,
    expectedFinalUrl,
    finalUrl: currentUrl,
    finalStatus,
    redirected,
    ok,
    steps,
    error: error || undefined,
  };
}

function groupCounts(urls: string[]) {
  return urls.reduce<Record<string, number>>((counts, url) => {
    const category = classifyRoute(url);
    counts[category] = (counts[category] || 0) + 1;
    return counts;
  }, {});
}

function duplicateValues(values: string[]) {
  const counts = new Map<string, number>();
  values.forEach((value) => counts.set(value, (counts.get(value) || 0) + 1));
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value, count]) => ({ value, count }));
}

function hasCanonicalHost(url: string) {
  return new URL(url).origin === ORIGIN;
}

function formatFailure(prefix: string, detail: string) {
  return `${prefix}: ${detail}`;
}

async function main() {
  const sitemapUrl = absoluteUrl("/sitemap.xml");
  const robotsUrl = absoluteUrl("/robots.txt");
  const sitemapResponse = await requestWithRetry(sitemapUrl, "GET", true);
  const sitemapUrls =
    sitemapResponse.status === 200 ? parseSitemapUrls(sitemapResponse.body || "") : [];
  const uniqueSitemapUrls = [...new Set(sitemapUrls)];
  const duplicateSitemapUrls = duplicateValues(sitemapUrls);
  const nonCanonicalSitemapUrls = sitemapUrls.filter((url) => !hasCanonicalHost(url));
  const routeTypeCounts = groupCounts(uniqueSitemapUrls);
  const requiredSitemapPaths = [
    "/",
    "/posts",
    "/smarttalks",
    "/explore",
    ...LEGAL_PAGE_SLUGS.map((slug) => `/${slug}`),
  ];
  const sitemapPathSet = new Set(
    uniqueSitemapUrls.map((url) => new URL(url).pathname.replace(/\/+$/, "") || "/"),
  );
  const missingRequiredSitemapPaths = requiredSitemapPaths.filter(
    (requiredPath) => !sitemapPathSet.has(requiredPath),
  );

  const sitemapRouteChecks = await mapLimit(uniqueSitemapUrls, CONCURRENCY, (url, index) =>
    checkRouteStatus(`Sitemap URL ${index + 1}`, url, classifyRoute(url), "GET"),
  );

  const robotsResponse = await requestWithRetry(robotsUrl, "GET", true);
  const robotsBody = robotsResponse.body || "";
  const robotsCheck = {
    url: robotsUrl,
    status: robotsResponse.status,
    contentType: robotsResponse.contentType,
    hasUserAgentAll: /User-agent:\s*\*/i.test(robotsBody),
    allowsRoot: /Allow:\s*\//i.test(robotsBody),
    hasCanonicalSitemap: robotsBody.includes(`${ORIGIN}/sitemap.xml`),
    ok:
      robotsResponse.status === 200 &&
      /User-agent:\s*\*/i.test(robotsBody) &&
      /Allow:\s*\//i.test(robotsBody) &&
      robotsBody.includes(`${ORIGIN}/sitemap.xml`),
  };

  const routeFamilyPaths = [
    "/profile",
    "/post",
    "/category",
    "/topic",
    "/tag",
  ];
  const routeFamilyChecks = await mapLimit(routeFamilyPaths, CONCURRENCY, (routePath) =>
    checkRouteStatus(`Route family ${routePath}`, absoluteUrl(routePath), "route-family"),
  );

  const legalDocumentChecks = await mapLimit(
    LEGAL_PAGE_SLUGS.map((slug) => absoluteUrl(`/${slug}`)),
    CONCURRENCY,
    (url) => checkCanonicalDocument(`Legal route ${new URL(url).pathname}`, url, "legal"),
  );

  const articleUrls = uniqueSitemapUrls.filter((url) => classifyRoute(url) === "article");
  const profileUrls = uniqueSitemapUrls.filter((url) => classifyRoute(url) === "profile");
  const smartTalkUrls = uniqueSitemapUrls.filter((url) => {
    const pathname = new URL(url).pathname;
    return pathname.startsWith("/smarttalk/");
  });

  const profileDocumentChecks = await mapLimit(profileUrls, CONCURRENCY, (url, index) =>
    checkCanonicalDocument(`Profile route ${index + 1}`, url, "profile"),
  );

  const articleSampleUrls = articleUrls.slice(0, 5);
  const smartTalkSampleUrls = smartTalkUrls.slice(0, 5);
  const sampledDynamicDocumentChecks = await mapLimit(
    [...articleSampleUrls, ...smartTalkSampleUrls],
    CONCURRENCY,
    (url) =>
      checkCanonicalDocument(
        `${classifyRoute(url)} canonical sample ${new URL(url).pathname}`,
        url,
        classifyRoute(url),
      ),
  );

  const firstArticleUrl = articleUrls[0] || "";
  const firstArticleId = firstArticleUrl ? extractSeoDocumentId(firstArticleUrl) : "";
  const firstProfileUrl = profileUrls[0] || "";
  const firstSmartTalkUrl = smartTalkUrls[0] || "";
  const firstSmartTalkId = firstSmartTalkUrl ? extractSeoDocumentId(firstSmartTalkUrl) : "";
  const firstSmartTalkSegment = firstSmartTalkUrl
    ? extractSeoDocumentSegment(firstSmartTalkUrl)
    : "";

  const profileHeadResponse = firstProfileUrl
    ? await requestWithRetry(firstProfileUrl, "HEAD")
    : null;
  const legacyProfileId =
    profileHeadResponse?.headers["x-readative-seo-profile-id"] || "";

  const redirectChecks: RedirectCheck[] = [];
  redirectChecks.push(
    await checkRedirectChain("Non-www homepage", `${ALT_ORIGIN}/`, `${ORIGIN}/`),
  );
  redirectChecks.push(
    await checkRedirectChain("Legacy /knowledge", absoluteUrl("/knowledge"), absoluteUrl("/")),
  );
  redirectChecks.push(
    await checkRedirectChain("Legacy /jobs", absoluteUrl("/jobs"), absoluteUrl("/explore")),
  );
  redirectChecks.push(
    await checkRedirectChain(
      "Legacy /community-guidelines",
      absoluteUrl("/community-guidelines"),
      absoluteUrl("/community"),
    ),
  );
  redirectChecks.push(
    await checkRedirectChain(
      "Legacy /smarttalk",
      absoluteUrl("/smarttalk"),
      absoluteUrl("/smarttalks"),
    ),
  );
  redirectChecks.push(
    await checkRedirectChain(
      "Legacy /tags/Inspiration",
      absoluteUrl("/tags/Inspiration"),
      absoluteUrl("/tag/inspiration"),
    ),
  );

  if (firstArticleUrl && firstArticleId) {
    redirectChecks.push(
      await checkRedirectChain(
        "Legacy /knowledge/:id article",
        absoluteUrl(`/knowledge/${encodeURIComponent(firstArticleId)}`),
        firstArticleUrl,
        "article-redirect",
      ),
    );
    redirectChecks.push(
      await checkRedirectChain(
        "Legacy /post/:id article",
        absoluteUrl(`/post/${encodeURIComponent(firstArticleId)}`),
        firstArticleUrl,
        "article-redirect",
      ),
    );
    redirectChecks.push(
      await checkRedirectChain(
        "Canonicalizer /posts/:id article",
        absoluteUrl(`/posts/${encodeURIComponent(firstArticleId)}`),
        firstArticleUrl,
        "article-redirect",
      ),
    );
  }

  if (firstSmartTalkUrl && firstSmartTalkId && firstSmartTalkSegment) {
    redirectChecks.push(
      await checkRedirectChain(
        "Canonicalizer /smarttalk/:id",
        absoluteUrl(`/smarttalk/${encodeURIComponent(firstSmartTalkId)}`),
        firstSmartTalkUrl,
        "smarttalk-redirect",
      ),
    );
    redirectChecks.push(
      await checkRedirectChain(
        "Legacy /smarttalks/:id",
        absoluteUrl(`/smarttalks/${firstSmartTalkSegment}`),
        firstSmartTalkUrl,
        "smarttalk-redirect",
      ),
    );
    redirectChecks.push(
      await checkRedirectChain(
        "Legacy /smarttalk?id=:id",
        absoluteUrl(`/smarttalk?id=${encodeURIComponent(firstSmartTalkId)}`),
        firstSmartTalkUrl,
        "smarttalk-redirect",
      ),
    );
  }

  if (firstProfileUrl && legacyProfileId) {
    redirectChecks.push(
      await checkRedirectChain(
        "Legacy /profile/:id",
        absoluteUrl(`/profile/${encodeURIComponent(legacyProfileId)}`),
        firstProfileUrl,
        "profile-redirect",
      ),
    );
  }

  const notFoundChecks = await mapLimit(
    [
      {
        name: "Missing article route",
        url: absoluteUrl("/posts/readative-route-verification-missing"),
        expectedStatus: 404,
      },
      {
        name: "Missing SmartTalk route",
        url: absoluteUrl("/smarttalk/readative-route-verification-missing"),
        expectedStatus: 404,
      },
      {
        name: "Missing profile route",
        url: absoluteUrl("/@readative_route_verification_missing"),
        expectedStatus: 404,
      },
    ],
    CONCURRENCY,
    async (check) => {
      const response = await requestWithRetry(check.url, "HEAD");
      const resolvedResponse =
        response.status === 0 ? await requestWithRetry(check.url, "GET") : response;
      return {
        name: check.name,
        category: "not-found",
        url: check.url,
        path: new URL(check.url).pathname,
        method: resolvedResponse.method,
        status: resolvedResponse.status,
        contentType: resolvedResponse.contentType,
        elapsedMs: resolvedResponse.elapsedMs,
        ok: resolvedResponse.status === check.expectedStatus,
        error: resolvedResponse.error,
      } satisfies RouteStatusCheck;
    },
  );

  const allStatusChecks = [
    ...sitemapRouteChecks,
    ...routeFamilyChecks,
    ...notFoundChecks,
  ];
  const allCanonicalChecks = [
    ...legalDocumentChecks,
    ...profileDocumentChecks,
    ...sampledDynamicDocumentChecks,
  ];

  const failures = [
    sitemapResponse.status === 200
      ? null
      : formatFailure("Sitemap", `expected 200, received ${sitemapResponse.status}`),
    sitemapResponse.contentType.includes("xml")
      ? null
      : formatFailure("Sitemap", `unexpected content type ${sitemapResponse.contentType}`),
    duplicateSitemapUrls.length === 0
      ? null
      : formatFailure("Sitemap", `${duplicateSitemapUrls.length} duplicate URL groups`),
    nonCanonicalSitemapUrls.length === 0
      ? null
      : formatFailure("Sitemap", `${nonCanonicalSitemapUrls.length} non-canonical URLs`),
    missingRequiredSitemapPaths.length === 0
      ? null
      : formatFailure(
          "Sitemap",
          `missing required paths ${missingRequiredSitemapPaths.join(", ")}`,
        ),
    robotsCheck.ok
      ? null
      : formatFailure("Robots", `robots.txt failed validation at ${robotsUrl}`),
    ...allStatusChecks
      .filter((check) => !check.ok)
      .map((check) =>
        formatFailure(check.name, `expected route status, received ${check.status}`),
      ),
    ...allCanonicalChecks
      .filter((check) => !check.ok)
      .map((check) =>
        formatFailure(
          check.name,
          `expected canonical ${check.url}, received ${check.canonicalUrl || "none"}`,
        ),
      ),
    ...redirectChecks
      .filter((check) => !check.ok)
      .map((check) =>
        formatFailure(
          check.name,
          `expected final ${check.expectedFinalUrl}, received ${check.finalUrl} (${check.finalStatus})`,
        ),
      ),
  ].filter((failure): failure is string => Boolean(failure));

  const testedRoutes = [
    sitemapUrl,
    robotsUrl,
    ...uniqueSitemapUrls,
    ...routeFamilyChecks.map((check) => check.url),
    ...redirectChecks.map((check) => check.startUrl),
    ...notFoundChecks.map((check) => check.url),
  ];

  const report = {
    generatedAt: new Date().toISOString(),
    origin: ORIGIN,
    status: failures.length === 0 ? "pass" : "fail",
    counts: {
      sitemapUrls: sitemapUrls.length,
      uniqueSitemapUrls: uniqueSitemapUrls.length,
      routeStatusChecks: allStatusChecks.length,
      legalRoutes: legalDocumentChecks.length,
      profileRoutes: profileUrls.length,
      articleRoutes: articleUrls.length,
      smartTalkRoutes: smartTalkUrls.length,
      redirectChecks: redirectChecks.length,
      canonicalDocumentChecks: allCanonicalChecks.length,
      notFoundChecks: notFoundChecks.length,
      failures: failures.length,
    },
    sitemap: {
      url: sitemapUrl,
      status: sitemapResponse.status,
      contentType: sitemapResponse.contentType,
      routeTypeCounts,
      duplicateSitemapUrls,
      nonCanonicalSitemapUrls,
      missingRequiredSitemapPaths,
    },
    robots: robotsCheck,
    sitemapRouteChecks,
    routeFamilyChecks,
    legalDocumentChecks,
    profileDocumentChecks,
    sampledDynamicDocumentChecks,
    redirectChecks,
    notFoundChecks,
    testedRoutes: [...new Set(testedRoutes)],
    failures,
  };

  fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);

  console.log(
    JSON.stringify(
      {
        status: report.status,
        reportPath: REPORT_PATH,
        counts: report.counts,
        routeTypeCounts,
        failures,
      },
      null,
      2,
    ),
  );

  if (failures.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
