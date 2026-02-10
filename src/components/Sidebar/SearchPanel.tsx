import React, { useState, useCallback } from "react";
import { searchNotes } from "../../lib/api";
import { useEditorStore } from "../../stores/editorStore";
import type { SearchResult } from "../../lib/api";
import { trackSearchUsed } from "../../lib/analytics";

export function SearchPanel() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const openFile = useEditorStore((s) => s.openFile);

  const handleSearch = useCallback(async (q: string) => {
    setQuery(q);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    try {
      const res = await searchNotes(q);
      setResults(res);
      trackSearchUsed(res.length);
    } catch (e) {
      console.error("Search failed:", e);
    }
  }, []);

  return (
    <div className="search-panel">
      <input
        className="search-input"
        placeholder="Search notes... (Ctrl+Shift+F)"
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        autoFocus
      />
      {results.map((r) => (
        <div
          key={r.path}
          className="search-result"
          onClick={() => openFile(r.path)}
        >
          <div className="search-result-title">{r.title}</div>
          <div className="search-result-snippet">{r.snippet}</div>
        </div>
      ))}
      {query.trim().length >= 2 && results.length === 0 && (
        <div
          style={{
            padding: "12px",
            textAlign: "center",
            color: "var(--text-muted)",
            fontSize: "12px",
          }}
        >
          No results
        </div>
      )}
    </div>
  );
}
