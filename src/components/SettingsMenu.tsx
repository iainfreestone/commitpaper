import React, { useState, useEffect, useRef } from "react";
import { useEditorStore } from "../stores/editorStore";
import type { EditorWidth } from "../stores/editorStore";

const widthOptions: { value: EditorWidth; label: string; desc: string }[] = [
  { value: "readable", label: "Readable", desc: "Centred, 780px max" },
  { value: "full", label: "Full width", desc: "Use all available space" },
];

export function SettingsMenu() {
  const editorWidth = useEditorStore((s) => s.editorWidth);
  const setEditorWidth = useEditorStore((s) => s.setEditorWidth);
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

  return (
    <div className="settings-menu" ref={panelRef}>
      <button
        className="status-bar-item settings-toggle-btn"
        onClick={() => setOpen((v) => !v)}
        title="Settings"
      >
        ⚙
      </button>

      {open && (
        <div className="settings-dropdown">
          <div className="settings-dropdown-header">Settings</div>

          {/* Editor width */}
          <div className="settings-section">
            <div className="settings-section-label">Editor width</div>
            <div className="settings-option-group">
              {widthOptions.map((opt) => (
                <button
                  key={opt.value}
                  className={`settings-option ${editorWidth === opt.value ? "active" : ""}`}
                  onClick={() => setEditorWidth(opt.value)}
                >
                  <span className="settings-option-label">{opt.label}</span>
                  <span className="settings-option-desc">{opt.desc}</span>
                  {editorWidth === opt.value && (
                    <span className="settings-check">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
