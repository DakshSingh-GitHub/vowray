"use client";

import React from "react";
import { Moon, PanelLeft, Sun } from "lucide-react";
import { ThemeMode } from "@/lib/types";
import { VowrayLogo } from "./VowrayLogo";

interface HeaderProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
}

export function Header({
  isSidebarOpen,
  onToggleSidebar,
  theme,
  onToggleTheme,
}: HeaderProps) {
  return (
    <header className="h-16 shrink-0 border-b border-[var(--border-subtle)] bg-[var(--surface)]/85 backdrop-blur-md px-3 sm:px-5 flex items-center justify-between gap-3 z-20">
      {/* Left: Sidebar toggle + Brand */}
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          title={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          className="h-9 w-9 rounded-full flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--pill-bg)] transition-colors cursor-pointer"
        >
          <PanelLeft className="w-[18px] h-[18px]" />
        </button>

        <div className="flex items-center gap-2.5 select-none">
          <VowrayLogo className="w-7 h-7 shrink-0" />
          <span className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--text-primary)]">
            Vowray
          </span>
        </div>
      </div>

      {/* Right: Theme Toggle */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={
            theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
          }
          title={
            theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
          }
          className="h-9 w-9 rounded-full flex items-center justify-center bg-[var(--pill-bg)] hover:bg-[var(--pill-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer shrink-0"
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4" />
          ) : (
            <Moon className="w-4 h-4" />
          )}
        </button>
      </div>
    </header>
  );
}
