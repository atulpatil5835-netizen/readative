export function scrollDocumentToTop(behavior: ScrollBehavior = "auto") {
  if (typeof window === "undefined") return;

  window.scrollTo({ top: 0, left: 0, behavior });

  if (behavior === "auto") {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }
}

export function scheduleDocumentScrollToTop(behavior: ScrollBehavior = "auto") {
  if (typeof window === "undefined") return () => undefined;

  const frameIds: number[] = [];
  scrollDocumentToTop(behavior);

  frameIds.push(
    window.requestAnimationFrame(() => {
      scrollDocumentToTop(behavior);
      frameIds.push(window.requestAnimationFrame(() => scrollDocumentToTop(behavior)));
    }),
  );

  return () => {
    frameIds.forEach((frameId) => window.cancelAnimationFrame(frameId));
  };
}

export function initializeDocumentScrollRestoration() {
  if (typeof window === "undefined") return;

  if ("scrollRestoration" in window.history) {
    window.history.scrollRestoration = "manual";
  }

  scrollDocumentToTop("auto");
}
