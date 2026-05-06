import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { AppErrorBoundary } from "./components/AppErrorBoundary.tsx";
import "./index.css";
import { scheduleThirdPartyScripts } from "./utils/loadThirdPartyScripts.ts";

const root = createRoot(document.getElementById("root")!);

root.render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>
);

scheduleThirdPartyScripts();
