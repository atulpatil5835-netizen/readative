import { useCallback, useEffect, useState } from "react";

interface TrustConsentProps {
  cookieConsentAccepted: boolean;
  consentStorageKey: string;
  consentVersion: string;
  notificationPromptEligible: boolean;
  onCookieAccepted: () => void;
}

const NOTIFICATION_PERMISSION_STORAGE_KEY = "readativeNotificationPermission";
const NOTIFICATION_PROMPT_SESSION_KEY = "readativeNotificationPromptShown:v1";

function readStorage(storage: Storage | undefined, key: string) {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeStorage(storage: Storage | undefined, key: string, value: string) {
  try {
    storage?.setItem(key, value);
  } catch {
    // Consent and permission prompts should fail softly if storage is blocked.
  }
}

function getBrowserNotificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }

  return window.Notification.permission;
}

function storeSettledNotificationPermission(
  permission: NotificationPermission | "unsupported",
) {
  if (permission === "granted" || permission === "denied") {
    writeStorage(window.localStorage, NOTIFICATION_PERMISSION_STORAGE_KEY, permission);
  }
}

export function TrustConsent({
  cookieConsentAccepted,
  consentStorageKey,
  consentVersion,
  notificationPromptEligible,
  onCookieAccepted,
}: TrustConsentProps) {
  const [showNotificationPrompt, setShowNotificationPrompt] = useState(false);
  const [requestingPermission, setRequestingPermission] = useState(false);

  const handleCookieAccept = useCallback(() => {
    writeStorage(window.localStorage, consentStorageKey, consentVersion);
    onCookieAccepted();
  }, [consentStorageKey, consentVersion, onCookieAccepted]);

  const hideNotificationPrompt = useCallback(() => {
    writeStorage(window.sessionStorage, NOTIFICATION_PROMPT_SESSION_KEY, "shown");
    setShowNotificationPrompt(false);
  }, []);

  const handleEnableNotifications = useCallback(async () => {
    if (requestingPermission) return;

    const permission = getBrowserNotificationPermission();
    if (permission !== "default") {
      storeSettledNotificationPermission(permission);
      hideNotificationPrompt();
      return;
    }

    setRequestingPermission(true);

    try {
      const nextPermission = await window.Notification.requestPermission();
      storeSettledNotificationPermission(nextPermission);
    } finally {
      setRequestingPermission(false);
      hideNotificationPrompt();
    }
  }, [hideNotificationPrompt, requestingPermission]);

  useEffect(() => {
    if (!cookieConsentAccepted || !notificationPromptEligible) {
      setShowNotificationPrompt(false);
      return;
    }

    const permission = getBrowserNotificationPermission();
    if (permission !== "default") {
      storeSettledNotificationPermission(permission);
      setShowNotificationPrompt(false);
      return;
    }

    const storedPermission = readStorage(
      window.localStorage,
      NOTIFICATION_PERMISSION_STORAGE_KEY,
    );
    if (storedPermission === "granted" || storedPermission === "denied") {
      setShowNotificationPrompt(false);
      return;
    }

    if (readStorage(window.sessionStorage, NOTIFICATION_PROMPT_SESSION_KEY)) {
      setShowNotificationPrompt(false);
      return;
    }

    writeStorage(window.sessionStorage, NOTIFICATION_PROMPT_SESSION_KEY, "shown");
    setShowNotificationPrompt(true);
  }, [cookieConsentAccepted, notificationPromptEligible]);

  return (
    <>
      {!cookieConsentAccepted && (
        <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-[70] mx-auto max-w-xl md:bottom-6 md:left-6 md:right-auto md:mx-0 md:max-w-md">
          <section
            aria-labelledby="readative-cookie-title"
            className="rounded-[1.75rem] border border-slate-200/80 bg-white/95 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.18)] backdrop-blur-xl"
            data-trust-consent="cookie"
            role="region"
          >
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">
              Privacy first
            </p>
            <h2
              id="readative-cookie-title"
              className="mt-2 text-xl font-black tracking-tight text-slate-950"
            >
              Welcome to Readative
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              We use essential cookies to improve your reading experience, remember your
              preferences, and keep Readative secure.
            </p>
            <div className="mt-5 grid gap-2 sm:grid-cols-[1fr_auto]">
              <button
                type="button"
                onClick={handleCookieAccept}
                className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              >
                Accept &amp; Continue
              </button>
              <a
                href="/cookies"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              >
                Learn More
              </a>
            </div>
          </section>
        </div>
      )}

      {showNotificationPrompt && (
        <div className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-[70] mx-auto max-w-xl md:bottom-6 md:left-6 md:right-auto md:mx-0 md:max-w-sm">
          <section
            aria-labelledby="readative-notification-title"
            className="rounded-[1.75rem] border border-slate-200/80 bg-white/95 p-5 shadow-[0_24px_80px_rgba(15,23,42,0.18)] backdrop-blur-xl"
            data-trust-consent="notifications"
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                event.stopPropagation();
                hideNotificationPrompt();
              }
            }}
            role="region"
            tabIndex={-1}
          >
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">
              Optional
            </p>
            <h2
              id="readative-notification-title"
              className="mt-2 text-xl font-black tracking-tight text-slate-950"
            >
              Stay Updated
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Enable browser notifications for:
            </p>
            <ul className="mt-3 grid gap-2 text-sm font-semibold text-slate-700">
              <li>• replies</li>
              <li>• comments</li>
              <li>• likes</li>
              <li>• SmartTalk activity</li>
            </ul>
            <div className="mt-5 grid gap-2 sm:grid-cols-[1fr_auto]">
              <button
                type="button"
                onClick={() => {
                  void handleEnableNotifications();
                }}
                disabled={requestingPermission}
                className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                Enable Notifications
              </button>
              <button
                type="button"
                onClick={hideNotificationPrompt}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              >
                Not Now
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
