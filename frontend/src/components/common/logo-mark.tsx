import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

/**
 * Custom AI/IT knowledge-network mark: a core node with orbiting satellite
 * nodes connected by data lines — reused by the sidebar header and the
 * intro animation so branding stays consistent between the two.
 */
export function LogoMark({
  className,
  glow = true,
  style,
}: {
  className?: string;
  glow?: boolean;
  style?: CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      className={cn("size-8", className)}
      style={style}
      role="img"
      aria-label="TechCore IT logo"
    >
      <defs>
        <linearGradient id="logo-grad" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="oklch(0.78 0.15 220)" />
          <stop offset="100%" stopColor="oklch(0.72 0.14 190)" />
        </linearGradient>
      </defs>
      <rect x="1" y="1" width="46" height="46" rx="13" fill="url(#logo-grad)" fillOpacity="0.16" />
      <rect x="1" y="1" width="46" height="46" rx="13" stroke="url(#logo-grad)" strokeOpacity="0.5" />

      <g stroke="url(#logo-grad)" strokeWidth="1.4" strokeLinecap="round" opacity="0.85">
        <line x1="24" y1="24" x2="13" y2="15" />
        <line x1="24" y1="24" x2="35" y2="15" />
        <line x1="24" y1="24" x2="13" y2="33" />
        <line x1="24" y1="24" x2="35" y2="33" />
      </g>

      <circle cx="13" cy="15" r="3" fill="url(#logo-grad)" opacity="0.75" />
      <circle cx="35" cy="15" r="3" fill="url(#logo-grad)" opacity="0.75" />
      <circle cx="13" cy="33" r="3" fill="url(#logo-grad)" opacity="0.75" />
      <circle cx="35" cy="33" r="3" fill="url(#logo-grad)" opacity="0.75" />

      <circle cx="24" cy="24" r="6.5" fill="url(#logo-grad)" />
      <circle cx="24" cy="24" r="6.5" className={glow ? "animate-pulse" : undefined} fill="url(#logo-grad)" opacity="0.4" />
    </svg>
  );
}
