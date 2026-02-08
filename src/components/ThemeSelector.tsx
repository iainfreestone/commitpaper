import React, { useState, useEffect, useRef } from "react";
import { useThemeStore, themes } from "../stores/themeStore";
import type { ThemeId } from "../stores/themeStore";

export function ThemeSelector() {
  const currentTheme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);

  const currentMeta = themes.find((t) => t.id === currentTheme);

  return (
    <div className="theme-selector" ref={panelRef}>
      <button
        className="status-bar-item theme-toggle-btn"
        onClick={() => setOpen((v) => !v)}
        title="Change theme"
      >
        {currentMeta?.isDark ? "🌙" : "☀️"} {currentMeta?.label ?? "Theme"}
      </button>

      {open && (
        <div className="theme-dropdown">
          <div className="theme-dropdown-header">Theme</div>
          <div className="theme-dropdown-section">Dark</div>
          {themes
            .filter((t) => t.isDark)
            .map((t) => (
              <button
                key={t.id}
                className={`theme-option ${t.id === currentTheme ? "active" : ""}`}
                onClick={() => {
                  setTheme(t.id);
                  setOpen(false);
                }}
              >
                <span className="theme-swatch" data-theme-preview={t.id} />
                <span>{t.label}</span>
                {t.id === currentTheme && (
                  <span className="theme-check">✓</span>
                )}
              </button>
            ))}
          <div className="theme-dropdown-section">Light</div>
          {themes
            .filter((t) => !t.isDark)
            .map((t) => (
              <button
                key={t.id}
                className={`theme-option ${t.id === currentTheme ? "active" : ""}`}
                onClick={() => {
                  setTheme(t.id);
                  setOpen(false);
                }}
              >
                <span className="theme-swatch" data-theme-preview={t.id} />
                <span>{t.label}</span>
                {t.id === currentTheme && (
                  <span className="theme-check">✓</span>
                )}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
