import React from "react";
import Image from "next/image";

interface VowrayLogoProps {
  className?: string;
}

export function VowrayLogo({ className = "w-7 h-7" }: VowrayLogoProps) {
  return (
    <span
      className={`relative inline-flex shrink-0 overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--pill-bg)] ${className}`}
    >
      <Image
        src="/vowray-logo.png"
        alt="Vowray logo"
        fill
        sizes="64px"
        className="object-cover"
        priority
      />
    </span>
  );
}
