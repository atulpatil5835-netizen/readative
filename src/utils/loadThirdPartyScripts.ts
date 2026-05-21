const READATIVE_GA_MEASUREMENT_ID = "G-09CXBVC580";
const GOOGLE_ANALYTICS_SRC = `https://www.googletagmanager.com/gtag/js?id=${READATIVE_GA_MEASUREMENT_ID}`;
const GOOGLE_ADS_SRC =
  "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8482951627272767";
const ADS_IDLE_DELAY_MS = 4500;
const ADS_INTERACTION_EVENTS = ["pointerdown", "keydown", "scroll"] as const;
const ADS_ROUTE_CHANGE_EVENTS = ["hashchange", "popstate", "readative:routechange"] as const;
const PUBLISHER_CONTENT_SELECTOR = [
  '[data-publisher-content="knowledge-post"]',
  '[data-publisher-content="smarttalk-question"]',
].join(",");

let thirdPartyScriptsScheduled = false;
let analyticsConfigured = false;
let adsLoadWatcherScheduled = false;
let adsScriptLoaded = false;

interface BrowserIdleCallbacks {
  requestIdleCallback?: (
    callback: IdleRequestCallback,
    options?: IdleRequestOptions,
  ) => number;
}

function appendScript(
  source: string,
  attributes: Record<string, string | boolean> = {},
) {
  if (typeof document === "undefined") {
    return;
  }

  const existingScript = document.querySelector<HTMLScriptElement>(
    `script[src="${source}"]`,
  );
  if (existingScript) {
    return;
  }

  const script = document.createElement("script");
  script.src = source;

  Object.entries(attributes).forEach(([key, value]) => {
    if (typeof value === "boolean") {
      if (value) {
        script.setAttribute(key, "");
      }
      return;
    }

    script.setAttribute(key, value);
  });

  document.head.appendChild(script);
}

function ensureAnalyticsStub() {
  if (typeof window === "undefined") {
    return;
  }

  window.READATIVE_GA_MEASUREMENT_ID = READATIVE_GA_MEASUREMENT_ID;
  window.dataLayer = window.dataLayer || [];
  window.gtag =
    window.gtag ||
    ((...args: unknown[]) => {
      window.dataLayer?.push(args);
    });
}

function configureAnalytics() {
  ensureAnalyticsStub();

  if (analyticsConfigured) {
    return;
  }

  analyticsConfigured = true;
  window.gtag?.("js", new Date());
  window.gtag?.("config", READATIVE_GA_MEASUREMENT_ID, {
    send_page_view: false,
  });
}

function runWhenBrowserIsIdle(callback: () => void) {
  if (typeof window === "undefined") {
    return;
  }

  const browserIdle = window as unknown as BrowserIdleCallbacks;

  if (browserIdle.requestIdleCallback) {
    browserIdle.requestIdleCallback(callback, { timeout: 3000 });
    return;
  }

  window.setTimeout(callback, 1200);
}

function getNormalizedPathname() {
  if (typeof window === "undefined") {
    return "/";
  }

  const pathname = window.location.pathname.replace(/\/+$/, "");
  return pathname || "/";
}

function isAdsEligibleRoute() {
  if (typeof window === "undefined") {
    return false;
  }

  const pathname = getNormalizedPathname();
  const hashRoute = window.location.hash.replace(/^#/, "").split("?")[0];

  if (
    pathname === "/" ||
    pathname === "/index.html" ||
    pathname === "/knowledge" ||
    pathname.startsWith("/knowledge/") ||
    pathname === "/smarttalk"
  ) {
    return true;
  }

  if (
    hashRoute === "knowledge" ||
    hashRoute.startsWith("knowledge/") ||
    hashRoute === "smarttalk"
  ) {
    return true;
  }

  return false;
}

function hasPublisherContent() {
  if (typeof document === "undefined") {
    return false;
  }

  return Boolean(document.querySelector(PUBLISHER_CONTENT_SELECTOR));
}

function scheduleAdsScript() {
  if (typeof window === "undefined" || adsLoadWatcherScheduled || adsScriptLoaded) {
    return;
  }

  adsLoadWatcherScheduled = true;
  let timeoutId: number | null = null;
  let observer: MutationObserver | null = null;

  const loadAds = () => {
    if (adsScriptLoaded || !isAdsEligibleRoute() || !hasPublisherContent()) {
      return;
    }

    adsScriptLoaded = true;

    [...ADS_INTERACTION_EVENTS, ...ADS_ROUTE_CHANGE_EVENTS].forEach((eventName) => {
      window.removeEventListener(eventName, loadAds);
    });

    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
      timeoutId = null;
    }

    observer?.disconnect();
    observer = null;

    appendScript(GOOGLE_ADS_SRC, {
      async: true,
      crossorigin: "anonymous",
    });
  };

  [...ADS_INTERACTION_EVENTS, ...ADS_ROUTE_CHANGE_EVENTS].forEach((eventName) => {
    window.addEventListener(eventName, loadAds, { passive: true });
  });

  if (typeof MutationObserver === "function" && document.body) {
    observer = new MutationObserver(loadAds);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  timeoutId = window.setTimeout(loadAds, ADS_IDLE_DELAY_MS);
}

function loadThirdPartyScripts() {
  configureAnalytics();

  runWhenBrowserIsIdle(() => {
    appendScript(GOOGLE_ANALYTICS_SRC, { async: true });
    scheduleAdsScript();
  });
}

export function scheduleThirdPartyScripts() {
  if (typeof window === "undefined" || thirdPartyScriptsScheduled) {
    return;
  }

  thirdPartyScriptsScheduled = true;
  configureAnalytics();

  if (document.readyState === "complete") {
    loadThirdPartyScripts();
    return;
  }

  window.addEventListener("load", loadThirdPartyScripts, { once: true });
}
