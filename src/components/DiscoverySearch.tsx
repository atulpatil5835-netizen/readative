import { Search, X } from "lucide-react";
import { memo, useCallback, type ChangeEvent } from "react";

interface DiscoverySearchProps {
  theme: "emerald" | "indigo";
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  ariaLabel: string;
}

const themeClasses = {
  emerald: {
    shell:
      "border-slate-200 bg-white focus-within:border-emerald-400 focus-within:ring-2 focus-within:ring-emerald-200",
    icon: "text-slate-400",
    input: "placeholder:text-slate-400",
    clear: "text-slate-400 hover:bg-slate-100 hover:text-slate-600",
  },
  indigo: {
    shell:
      "border-slate-200 bg-white focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-200",
    icon: "text-slate-400",
    input: "placeholder:text-slate-400",
    clear: "text-slate-400 hover:bg-slate-100 hover:text-slate-600",
  },
} as const;

export const DiscoverySearch = memo(function DiscoverySearch({
  theme,
  placeholder,
  value,
  onChange,
  onClear,
  ariaLabel,
}: DiscoverySearchProps) {
  const styles = themeClasses[theme];
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange(event.target.value);
    },
    [onChange],
  );

  return (
    <div
      className={`mx-auto flex w-full max-w-xl items-center gap-2 rounded-full border px-3 py-2 shadow-sm transition-all ${styles.shell}`}
    >
      <Search className={`h-4 w-4 shrink-0 ${styles.icon}`} />
      <input
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoComplete="off"
        spellCheck={false}
        className={`min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none ${styles.input}`}
      />
      {value && (
        <button
          onClick={onClear}
          aria-label="Clear search"
          className={`inline-flex h-7 w-7 items-center justify-center rounded-full transition-colors ${styles.clear}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
});
