import React, { useEffect, useRef, useState, useCallback } from "react";
import { getNoteNames, resolveWikilink } from "../../lib/api";

interface NotePickerProps {
  /** Screen position to anchor the picker near */
  anchor: { x: number; y: number };
  /** Called when a note is selected — returns {title, path} */
  onSelect: (note: { title: string; path: string }) => void;
  /** Called when the picker is dismissed */
  onClose: () => void;
}

export function NotePicker({ anchor, onSelect, onClose }: NotePickerProps) {
  const [query, setQuery] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  const [filtered, setFiltered] = useState<string[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Load note names on mount
  useEffect(() => {
    getNoteNames().then((names) => {
      const sorted = names.sort((a, b) => a.localeCompare(b));
      setNotes(sorted);
      setFiltered(sorted);
    });
  }, []);

  // Filter on query change
  useEffect(() => {
    const q = query.toLowerCase().trim();
    if (!q) {
      setFiltered(notes);
    } else {
      setFiltered(
        notes.filter((n) => n.toLowerCase().includes(q)),
      );
    }
    setSelectedIdx(0);
  }, [query, notes]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll(".note-picker-item");
    items[selectedIdx]?.scrollIntoView({ block: "nearest" });
  }, [selectedIdx]);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const el = (e.target as HTMLElement).closest(".note-picker-popup");
      if (!el) onClose();
    };
    // Use setTimeout to avoid the opening click triggering close
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
    }, 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [onClose]);

  const handleSelect = useCallback(
    async (name: string) => {
      const path = await resolveWikilink(name);
      if (path) {
        onSelect({ title: name, path });
      }
    },
    [onSelect],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIdx((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (filtered[selectedIdx]) {
            handleSelect(filtered[selectedIdx]);
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [filtered, selectedIdx, handleSelect, onClose],
  );

  // Position: try to keep within viewport
  const style: React.CSSProperties = {
    position: "fixed",
    left: Math.min(anchor.x, window.innerWidth - 320),
    top: Math.min(anchor.y, window.innerHeight - 340),
    zIndex: 500,
  };

  return (
    <div className="note-picker-popup" style={style} onKeyDown={handleKeyDown}>
      <input
        ref={inputRef}
        className="note-picker-input"
        placeholder="Search notes…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />
      <div className="note-picker-list" ref={listRef}>
        {filtered.length === 0 ? (
          <div className="note-picker-empty">No notes found</div>
        ) : (
          filtered.map((name, i) => (
            <div
              key={name}
              className={`note-picker-item ${i === selectedIdx ? "selected" : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(name);
              }}
              onMouseEnter={() => setSelectedIdx(i)}
            >
              {name}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
