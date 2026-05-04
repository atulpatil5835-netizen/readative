const READATIVE_GA_MEASUREMENT_ID = "G-09CXBVC580";
const GOOGLE_ANALYTICS_SRC = `https://www.googletagmanager.com/gtag/js?id=${READATIVE_GA_MEASUREMENT_ID}`;
const GOOGLE_ADS_SRC =
  "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8482951627272767";

let thirdPartyScriptsScheduled = false;

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

function runWhenBrowserIsIdle(callback: () => void) {
  if (typeof window === "undefined") {
    return;
  }

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(callback, { timeout: 3000 });
    return;
  }

  window.setTimeout(callback, 1200);
}

function loadThirdPartyScripts() {
  ensureAnalyticsStub();

  runWhenBrowserIsIdle(() => {
    window.gtag?.("js", new Date());
    window.gtag?.("config", READATIVE_GA_MEASUREMENT_ID, {
      send_page_view: false,
    });

    appendScript(GOOGLE_ANALYTICS_SRC, { async: true });
    appendScript(GOOGLE_ADS_SRC, {
      async: true,
      crossorigin: "anonymous",
    });
  });
}

export function scheduleThirdPartyScripts() {
  if (typeof window === "undefined" || thirdPartyScriptsScheduled) {
    return;
  }

  thirdPartyScriptsScheduled = true;
  ensureAnalyticsStub();

  if (document.readyState === "complete") {
    loadThirdPartyScripts();
    return;
  }

  window.addEventListener("load", loadThirdPartyScripts, { once: true });
}
