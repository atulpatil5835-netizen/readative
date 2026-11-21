import { useEffect, useRef } from "react";
import { Check, Monitor, Moon, Sun, X } from "lucide-react";
import {
  type ThemePreference,
  useUserPreferences,
} from "../context/UserPreferencesContext";

interface AppSettingsProps {
  onClose: () => void;
}

const THEME_OPTIONS: Array<{
  value: ThemePreference;
  label: string;
  description: string;
  icon: typeof Sun;
}> = [
  {
    value: "light",
    label: "Light",
    description: "Keep Readative bright and familiar.",
    icon: Sun,
  },
  {
    value: "dark",
    label: "Dark",
    description: "Use a darker palette for every page.",
    icon: Moon,
  },
  {
    value: "system",
    label: "Use device setting",
    description: "Follow your phone or computer preference.",
    icon: Monitor,
  },
];

export function AppSettings({ onClose }: AppSettingsProps) {
  const { preferences, setTheme, setShowProductSpotlight } =
    useUserPreferences();
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key !== "Tab") return;

      const focusableElements = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusableElements?.length) {
        event.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-5"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="readative-settings-title"
        className="readative-dialog-surface relative max-h-[min(90dvh,760px)] w-full max-w-xl overflow-y-auto overscroll-contain"
      >
        <header className="border-b border-slate-200/80 px-5 py-5 pr-16 sm:px-7">
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
            aria-label="Close settings"
          >
            <X className="h-4 w-4" />
          </button>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-600">
            Preferences
          </p>
          <h2
            id="readative-settings-title"
            className="mt-1 text-2xl font-black tracking-tight text-slate-950"
          >
            Settings
          </h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Choose how Readative looks on this device.
          </p>
        </header>

        <div className="space-y-7 p-5 sm:p-7">
          <fieldset>
            <legend className="text-sm font-black text-slate-900">
              Appearance
            </legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {THEME_OPTIONS.map(({ value, label, description, icon: Icon }) => {
                const selected = preferences.theme === value;
                return (
                  <label
                    key={value}
                    className={`relative flex min-h-[112px] cursor-pointer flex-col rounded-2xl border p-3 transition-colors ${
                      selected
                        ? "border-emerald-500 bg-emerald-50/80 ring-2 ring-emerald-500/15"
                        : "border-slate-200 bg-white hover:border-emerald-200 hover:bg-slate-50"
                    } focus-within:ring-2 focus-within:ring-emerald-400 focus-within:ring-offset-2`}
                  >
                    <input
                      type="radio"
                      name="readative-theme"
                      value={value}
                      checked={selected}
                      onChange={() => setTheme(value)}
                      className="sr-only"
                    />
                    <span className="flex items-center justify-between">
                      <Icon
                        className={`h-4 w-4 ${selected ? "text-emerald-700" : "text-slate-500"}`}
                        aria-hidden="true"
                      />
                      {selected && (
                        <Check
                          className="h-4 w-4 text-emerald-700"
                          aria-hidden="true"
                        />
                      )}
                    </span>
                    <span className="mt-3 text-xs font-black text-slate-900">
                      {label}
                    </span>
                    <span className="mt-1 text-[11px] leading-4 text-slate-500">
                      {description}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div>
            <h3 className="text-sm font-black text-slate-900">
              Featured product
            </h3>
            <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <input
                type="checkbox"
                checked={preferences.showProductSpotlight}
                onChange={(event) =>
                  setShowProductSpotlight(event.target.checked)
                }
                className="mt-1 h-4 w-4 shrink-0 accent-emerald-600"
              />
              <span className="min-w-0">
                <span className="block text-sm font-bold text-slate-900">
                  Show the FBPLY product card
                </span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">
                  Keep a compact link to the budget planner in the lower-right
                  corner. You can turn it off at any time.
                </span>
              </span>
            </label>
          </div>

          <p className="text-xs leading-5 text-slate-400">
            These preferences are saved in this browser and are not tied to your
            account.
          </p>
        </div>
      </section>
    </div>
  );
}
