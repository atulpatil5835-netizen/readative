import { memo } from "react";

interface LogoProps {
  className?: string;
  loading?: "eager" | "lazy";
}

export const Logo = memo(function Logo({
  className = "h-10 w-10",
  loading = "lazy",
}: LogoProps) {
  return (
    <img
      src="/logo-mark.webp"
      alt="Readative"
      className={`${className} object-contain`}
      width={256}
      height={256}
      loading={loading}
      decoding="async"
    />
  );
});
