import { scheduleThirdPartyScripts } from "./loadThirdPartyScripts";

function getPagePath() {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function trackPageView() {
  if (typeof window === "undefined") {
    return;
  }

  // Safe fallback: if cookie consent has been accepted, ensure scripts are loaded
  let hasConsent = false;
  try {
    hasConsent = window.localStorage.getItem("readativeCookieConsentVersion") === "2026-07-05.t1";
  } catch {
    // ignore
  }

  if (hasConsent) {
    scheduleThirdPartyScripts();
  }

  if (typeof window.gtag !== "function") {
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

export function trackEvent(eventName: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") {
    return;
  }

  const eventParams = { ...params };
  if (window.READATIVE_GA_MEASUREMENT_ID) {
    eventParams.send_to = window.READATIVE_GA_MEASUREMENT_ID;
  }

  window.gtag("event", eventName, eventParams);
}

export function setAnalyticsUser(authorId: string | null) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") {
    return;
  }

  const measurementId = window.READATIVE_GA_MEASUREMENT_ID || "G-09CXBVC580";

  if (authorId) {
    // Set user ID for all subsequent events in the session
    window.gtag("config", measurementId, {
      user_id: authorId,
      keep_alive: true,
    });
  } else {
    // Clear user ID on logout
    window.gtag("config", measurementId, {
      user_id: "",
      keep_alive: true,
    });
  }
}

export function trackLogin(method: string = "Google") {
  trackEvent("login", { method });
}

export function trackLogout() {
  trackEvent("logout");
}

export function trackSearch(searchTerm: string) {
  trackEvent("search", { search_term: searchTerm });
}

export function trackShare(contentType: string, itemId: string) {
  trackEvent("share", { content_type: contentType, item_id: itemId });
}

export function trackPostCreated(postId: string, category?: string) {
  trackEvent("create_post", { post_id: postId, category });
}

export function trackPostLiked(postId: string) {
  trackEvent("like_post", { post_id: postId });
}

export function trackSmartTalkAsked(questionId: string, category?: string) {
  trackEvent("ask_question", { question_id: questionId, category });
}

export function trackSmartTalkAnswered(questionId: string, answerId: string) {
  trackEvent("answer_question", { question_id: questionId, answer_id: answerId });
}
