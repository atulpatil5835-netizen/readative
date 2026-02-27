import React from "react";

export function Logo({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <img 
      src="/logo.png" 
      alt="Redative" 
      className={className}
    />
  );
}