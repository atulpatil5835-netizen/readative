import React from "react";

export function Logo({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg viewBox="10 5 95 95" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="blueBody" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00C6FF" />
          <stop offset="100%" stopColor="#0072FF" />
        </linearGradient>
        <linearGradient id="leaf1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FF8008" />
          <stop offset="100%" stopColor="#FFC837" />
        </linearGradient>
        <linearGradient id="leaf2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f83600" />
          <stop offset="100%" stopColor="#fe8c00" />
        </linearGradient>
        <linearGradient id="leaf3" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#43e97b" />
          <stop offset="100%" stopColor="#38f9d7" />
        </linearGradient>
      </defs>
      
      {/* The "R" Stem and Bowl */}
      <path 
        d="M20 15 C20 10 25 10 25 10 H55 C75 10 85 25 85 40 C85 55 75 65 55 65 H45 V90 C45 90 45 95 40 95 C35 95 35 90 35 90 V65 V40 V15 H20 Z" 
        fill="url(#blueBody)" 
      />
      
      {/* The 3 Feathers/Leaves forming the leg */}
      {/* Top Leaf (Orange/Red) */}
      <path 
        d="M55 65 C55 65 75 65 90 50 C90 50 95 55 85 70 C85 70 70 80 55 65 Z" 
        fill="url(#leaf2)" 
      />
      
      {/* Middle Leaf (Yellow/Orange) */}
      <path 
        d="M55 72 C55 72 75 72 95 60 C95 60 100 65 90 80 C90 80 75 90 55 72 Z" 
        fill="url(#leaf1)" 
      />
      
      {/* Bottom Leaf (Teal) */}
      <path 
        d="M55 80 C55 80 75 80 95 75 C95 75 98 82 85 92 C85 92 70 98 55 80 Z" 
        fill="url(#leaf3)" 
      />
    </svg>
  );
}
