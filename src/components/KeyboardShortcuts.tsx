import React, { useEffect, useRef } from "react";

const shortcuts = [
  { keys: "Ctrl+S", action: "Save" },
  { keys: "Ctrl+P", action: "Command palette" },
  { keys: "Ctrl+E", action: "Toggle Rich / Raw editor" },
  { keys: "Ctrl+\\", action: "Toggle right panel" },
  { keys: "Ctrl+B", action: "Bold" },
  { keys: "Ctrl+I", action: "Italic" },
  { keys: "Ctrl+K", action: "Insert link" },
  { keys: "Ctrl+1–4", action: "Heading level 1–4" },
  { keys: "Ctrl+Shift+8", action: "Bullet list" },
  { keys: "Ctrl+Shift+7", action: "Numbered list" },
  { keys: "Ctrl+Shift+9", action: "Checkbox" },
  { keys: "Ctrl+Z", action: "Undo" },
  { keys: "Ctrl+Shift+Z", action: "Redo" },
];

interface KeyboardShortcutsProps {
  open: boolean;
  onClose: () => void;
}

export function KeyboardShortcuts({ open, onClose }: KeyboardShortcutsProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClick);
    return () => {
      window.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="shortcuts-overlay">
      <div className="shortcuts-panel" ref={panelRef}>
        <div className="shortcuts-panel-header">
          <span>Keyboard Shortcuts</span>
          <button className="shortcuts-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="shortcuts-panel-body">
          {shortcuts.map((s) => (
            <div className="shortcut-row" key={s.keys}>
              <span className="shortcut-action">{s.action}</span>
              <kbd className="shortcut-kbd">{s.keys}</kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
