function readClientEnv(name: string) {
  const value = import.meta.env[name];
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export const firebaseClientDataEnabled =
  readClientEnv("VITE_FIREBASE_CLIENT_DATA_ENABLED") === "true";

export const firebaseClientDataDisabledMessage =
  "Live community features are temporarily paused to keep cloud usage within the no-charge budget.";
