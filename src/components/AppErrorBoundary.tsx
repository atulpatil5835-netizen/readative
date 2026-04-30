import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Readative render crash:", error, errorInfo);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-[#F5F5F0] px-4 py-12 text-[#1A1A1A]">
        <div className="mx-auto max-w-2xl rounded-[32px] border border-amber-200 bg-white px-6 py-14 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-700">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.22em] text-amber-600">
            App error
          </p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
            Readative hit an unexpected issue
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            The page crashed while rendering. Reload the app to recover and try again.
          </p>

          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-700"
            >
              <RefreshCcw className="h-4 w-4" />
              Reload app
            </button>
            <button
              onClick={() => window.location.assign("/")}
              className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition-colors hover:border-emerald-200 hover:text-emerald-700"
            >
              Go home
            </button>
          </div>
        </div>
      </div>
    );
  }
}
