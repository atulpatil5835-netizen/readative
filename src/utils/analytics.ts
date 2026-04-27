function getPagePath() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function trackPageView() {
  if (typeof window === "undefined" || typeof window.gtag !== "function") {
    return;
  }

  const params: Record<string, string> = {
    page_title: document.title,
    page_location: window.location.href,
    page_path: getPagePath(),
  };

  if (window.READATIVE_GA_MEASUREMENT_ID) {
    params.send_to = window.READATIVE_GA_MEASUREMENT_ID;
  }

  window.gtag("event", "page_view", params);
}
