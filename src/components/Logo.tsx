export function Logo({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label="Readative"
      className={className}
    >
      <defs>
        <linearGradient id="readative-logo-bg" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="100%" stopColor="#0f766e" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="url(#readative-logo-bg)" />
      <path
        d="M19 18h17c6.6 0 12 5.4 12 12v16H31c-6.6 0-12-5.4-12-12V18zm12 8v12h13"
        fill="none"
        stroke="#ffffff"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="5"
      />
    </svg>
  );
}
