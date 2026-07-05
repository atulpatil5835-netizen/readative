import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { AppErrorBoundary } from "./components/AppErrorBoundary.tsx";
import "./index.css";
import { initializeDocumentScrollRestoration } from "./utils/scrollRestoration.ts";

initializeDocumentScrollRestoration();
const root = createRoot(document.getElementById("root")!);

root.render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>
);
