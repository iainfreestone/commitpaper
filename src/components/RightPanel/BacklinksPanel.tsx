import React, { useEffect, useState } from "react";
import { useEditorStore } from "../../stores/editorStore";
import { getBacklinks } from "../../lib/api";

export function BacklinksPanel() {
  const activeTabPath = useEditorStore((s) => s.activeTabPath);
  const openFile = useEditorStore((s) => s.openFile);
  const [backlinks, setBacklinks] = useState<string[]>([]);

  useEffect(() => {
    if (!activeTabPath) {
      setBacklinks([]);
      return;
    }

    getBacklinks(activeTabPath)
      .then(setBacklinks)
      .catch(() => setBacklinks([]));
  }, [activeTabPath]);

  if (!activeTabPath) {
    return (
      <div className="backlinks-panel">
        <div
          style={{
            padding: "12px",
            color: "var(--text-muted)",
            fontSize: "12px",
            textAlign: "center",
          }}
        >
          Open a note to see backlinks
        </div>
      </div>
    );
  }

  return (
    <div className="backlinks-panel">
      <div className="sidebar-section-title">
        Backlinks ({backlinks.length})
      </div>
      {backlinks.length === 0 ? (
        <div
          style={{
            padding: "12px",
            color: "var(--text-muted)",
            fontSize: "12px",
            textAlign: "center",
          }}
        >
          No backlinks found
        </div>
      ) : (
        backlinks.map((link) => (
          <div
            key={link}
            className="backlink-item"
            onClick={() => openFile(link)}
          >
            {link.replace(/\.md$/, "").split("/").pop()}
          </div>
        ))
      )}
    </div>
  );
}
