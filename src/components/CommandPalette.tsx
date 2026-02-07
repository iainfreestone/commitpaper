import React, { useEffect, useRef, useState } from "react";
import { useEditorStore } from "../stores/editorStore";
import { getNoteNames, resolveWikilink } from "../lib/tauri";

interface CommandPaletteProps {
  onClose: () => void;
}

export function CommandPalette({ onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<string[]>([]);
  const [filtered, setFiltered] = useState<string[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const openFile = useEditorStore((s) => s.openFile);

  useEffect(() => {
    getNoteNames().then((names) => {
      setItems(names.sort());
      setFiltered(names.sort());
    });
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    const q = query.toLowerCase();
    const results = items.filter((name) => name.toLowerCase().includes(q));
    setFiltered(results);
    setSelectedIdx(0);
  }, [query, items]);

  const handleSelect = async (name: string) => {
    const path = await resolveWikilink(name);
    if (path) {
      openFile(path);
    } else {
      // Create new note
      openFile(`${name}.md`);
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[selectedIdx]) {
        handleSelect(filtered[selectedIdx]);
      } else if (query.trim()) {
        handleSelect(query.trim());
      }
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  return (
    <div className="command-palette-overlay" onClick={onClose}>
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          placeholder="Search notes or create new..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <div className="command-palette-results">
          {filtered.map((name, i) => (
            <div
              key={name}
              className={`command-palette-item ${i === selectedIdx ? "selected" : ""}`}
              onClick={() => handleSelect(name)}
              onMouseEnter={() => setSelectedIdx(i)}
            >
              {name}
            </div>
          ))}
          {filtered.length === 0 && query.trim() && (
            <div className="command-palette-item selected">
              Create note: {query.trim()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
