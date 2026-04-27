declare global {
  interface Window {
    READATIVE_GA_MEASUREMENT_ID?: string;
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export {};
