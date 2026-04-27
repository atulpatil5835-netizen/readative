export function Logo({ className = "h-10 w-10" }: { className?: string }) {
  return (
    <img
      src="/logo-mark.png"
      alt="Readative"
      className={className}
      width={256}
      height={256}
      decoding="async"
    />
  );
}
