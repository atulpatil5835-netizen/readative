import { type CSSProperties } from "react";

type ReadativeLoaderSize = "xs" | "sm" | "md" | "lg";
type ReadativeLoaderTone = "emerald" | "indigo" | "light";

const LOADER_SIZES: Record<ReadativeLoaderSize, number> = {
  xs: 18,
  sm: 24,
  md: 34,
  lg: 44,
};

interface ReadativeRMarkProps {
  className?: string;
}

interface ReadativeLoaderProps {
  size?: ReadativeLoaderSize;
  tone?: ReadativeLoaderTone;
  label?: string;
  className?: string;
  labelClassName?: string;
}

export function ReadativeRMark({ className = "" }: ReadativeRMarkProps) {
  return (
    <span
      className={`inline-flex items-center justify-center font-black leading-none ${className}`}
      aria-hidden="true"
    >
      R
    </span>
  );
}

export function ReadativeLoader({
  size = "md",
  tone = "emerald",
  label,
  className = "",
  labelClassName = "text-sm text-slate-400",
}: ReadativeLoaderProps) {
  const mark = (
    <span
      className={`readative-r-loader readative-r-loader--${tone} ${className}`}
      style={
        {
          "--readative-loader-size": `${LOADER_SIZES[size]}px`,
        } as CSSProperties
      }
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <span className="readative-r-loader__ring" aria-hidden="true" />
      <span className="readative-r-loader__orbit" aria-hidden="true">
        <span className="readative-r-loader__dot" />
      </span>
      <span className="readative-r-loader__core">R</span>
    </span>
  );

  if (!label) {
    return mark;
  }

  return (
    <div className="inline-flex flex-col items-center justify-center gap-3">
      {mark}
      <p className={labelClassName}>{label}</p>
    </div>
  );
}
