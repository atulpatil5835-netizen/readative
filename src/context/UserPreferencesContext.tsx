import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemePreference = "light" | "dark" | "system";

interface UserPreferences {
  theme: ThemePreference;
  showProductSpotlight: boolean;
}

interface UserPreferencesContextValue {
  preferences: UserPreferences;
  setTheme: (theme: ThemePreference) => void;
  setShowProductSpotlight: (show: boolean) => void;
}

const USER_PREFERENCES_STORAGE_KEY = "readativeUserPreferences:v1";
const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "light",
  showProductSpotlight: true,
};

const UserPreferencesContext =
  createContext<UserPreferencesContextValue | null>(null);

function loadUserPreferences(): UserPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;

  try {
    const rawValue = window.localStorage.getItem(USER_PREFERENCES_STORAGE_KEY);
    if (!rawValue) return DEFAULT_PREFERENCES;

    const storedValue = JSON.parse(rawValue) as Partial<UserPreferences>;
    return {
      theme:
        storedValue.theme === "dark" || storedValue.theme === "system"
          ? storedValue.theme
          : "light",
      showProductSpotlight:
        typeof storedValue.showProductSpotlight === "boolean"
          ? storedValue.showProductSpotlight
          : true,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function UserPreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState(loadUserPreferences);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;

    try {
      window.localStorage.setItem(
        USER_PREFERENCES_STORAGE_KEY,
        JSON.stringify(preferences),
      );
    } catch {
      // Keep in-memory preferences usable when storage is unavailable.
    }
  }, [preferences]);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;

    const root = window.document.documentElement;
    const systemPreference = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const isDark =
        preferences.theme === "dark" ||
        (preferences.theme === "system" && systemPreference.matches);
      root.classList.toggle("dark", isDark);
      root.style.colorScheme = isDark ? "dark" : "light";
      const themeColor = root.querySelector<HTMLMetaElement>(
        'meta[name="theme-color"]',
      );
      if (themeColor) themeColor.content = isDark ? "#0b1220" : "#0f766e";
    };

    applyTheme();
    if (preferences.theme !== "system") return;

    if (typeof systemPreference.addEventListener === "function") {
      systemPreference.addEventListener("change", applyTheme);
      return () => systemPreference.removeEventListener("change", applyTheme);
    }

    systemPreference.addListener(applyTheme);
    return () => systemPreference.removeListener(applyTheme);
  }, [preferences.theme]);

  const value = useMemo<UserPreferencesContextValue>(
    () => ({
      preferences,
      setTheme: (theme) =>
        setPreferences((current) => ({ ...current, theme })),
      setShowProductSpotlight: (show) =>
        setPreferences((current) => ({
          ...current,
          showProductSpotlight: show,
        })),
    }),
    [preferences],
  );

  return (
    <UserPreferencesContext.Provider value={value}>
      {children}
    </UserPreferencesContext.Provider>
  );
}

export function useUserPreferences() {
  const context = useContext(UserPreferencesContext);
  if (!context) {
    throw new Error(
      "useUserPreferences must be used within UserPreferencesProvider.",
    );
  }
  return context;
}
