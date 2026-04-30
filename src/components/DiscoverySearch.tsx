import { Search, Sparkles, X } from "lucide-react";

interface SearchSuggestion {
  label: string;
  query: string;
}

interface DiscoverySearchProps {
  theme: "emerald" | "indigo";
  title: string;
  description: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  resultLabel: string;
  helperText: string;
  suggestions: SearchSuggestion[];
}

const themeClasses = {
  emerald: {
    shell:
      "border-emerald-200/70 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_45%),linear-gradient(135deg,rgba(255,255,255,0.96),rgba(236,253,245,0.98))]",
    badge: "border-emerald-200 bg-white/85 text-emerald-700",
    result: "border-emerald-200/70 bg-emerald-50/80 text-emerald-700",
    icon: "bg-emerald-100 text-emerald-700",
    input:
      "border-emerald-200/80 bg-white/90 text-slate-800 placeholder:text-slate-400 focus:border-emerald-400 focus:ring-emerald-200",
    clear: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
    suggestion:
      "border-emerald-200/80 bg-white/85 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50",
    helper: "text-emerald-800/80",
  },
  indigo: {
    shell:
      "border-indigo-200/70 bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.2),_transparent_45%),linear-gradient(135deg,rgba(255,255,255,0.96),rgba(238,242,255,0.98))]",
    badge: "border-indigo-200 bg-white/85 text-indigo-700",
    result: "border-indigo-200/70 bg-indigo-50/80 text-indigo-700",
    icon: "bg-indigo-100 text-indigo-700",
    input:
      "border-indigo-200/80 bg-white/90 text-slate-800 placeholder:text-slate-400 focus:border-indigo-400 focus:ring-indigo-200",
    clear: "border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100",
    suggestion:
      "border-indigo-200/80 bg-white/85 text-indigo-700 hover:border-indigo-300 hover:bg-indigo-50",
    helper: "text-indigo-900/80",
  },
} as const;

export function DiscoverySearch({
  theme,
  title,
  description,
  placeholder,
  value,
  onChange,
  onClear,
  resultLabel,
  helperText,
  suggestions,
}: DiscoverySearchProps) {
  const styles = themeClasses[theme];

  return (
    <section
      className={`overflow-hidden rounded-[30px] border px-5 py-5 shadow-[0_20px_55px_rgba(15,23,42,0.08)] backdrop-blur ${styles.shell}`}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] ${styles.badge}`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Next Search
              </span>
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${styles.result}`}
              >
                {resultLabel}
              </span>
            </div>
            <h3 className="mt-3 text-2xl font-black tracking-tight text-slate-950">
              {title}
            </h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              {description}
            </p>
          </div>
        </div>

        <div
          className={`flex flex-col gap-3 rounded-[26px] border p-3 shadow-inner sm:flex-row sm:items-center ${styles.input}`}
        >
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${styles.icon}`}
          >
            <Search className="h-5 w-5" />
          </div>
          <input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
          />
          {value && (
            <button
              onClick={onClear}
              className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-3 py-2 text-xs font-bold uppercase tracking-[0.16em] transition-colors ${styles.clear}`}
            >
              <X className="h-3.5 w-3.5" />
              Clear
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.label}
              onClick={() => onChange(suggestion.query)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${styles.suggestion}`}
            >
              {suggestion.label}
            </button>
          ))}
        </div>

        <p className={`text-xs font-medium ${styles.helper}`}>{helperText}</p>
      </div>
    </section>
  );
}
