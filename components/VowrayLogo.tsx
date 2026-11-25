import React from "react";

interface VowrayLogoProps {
  className?: string;
}

export function VowrayLogo({ className = "w-6 h-6" }: VowrayLogoProps) {
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="2"
        y="2"
        width="24"
        height="24"
        rx="8"
        className="fill-[var(--pill-bg)] stroke-[var(--border-strong)]"
        strokeWidth="1.25"
      />
      <path
        d="M8.75 9.5L14 19.25L19.25 9.5"
        className="stroke-[var(--text-primary)]"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="14"
        cy="9.25"
        r="1.35"
        className="fill-[var(--text-primary)]"
      />
    </svg>
  );
}
