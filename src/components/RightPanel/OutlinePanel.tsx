import React, { useEffect, useState } from "react";
import { useEditorStore } from "../../stores/editorStore";

interface HeadingInfo {
  level: number;
  text: string;
  line: number;
}

export function OutlinePanel() {
  const content = useEditorStore((s) => s.content);
  const activeTabPath = useEditorStore((s) => s.activeTabPath);
  const [headings, setHeadings] = useState<HeadingInfo[]>([]);

  useEffect(() => {
    if (!content) {
      setHeadings([]);
      return;
    }

    const lines = content.split("\n");
    const result: HeadingInfo[] = [];

    lines.forEach((line, idx) => {
      const match = line.match(/^(#{1,6})\s+(.+)/);
      if (match) {
        result.push({
          level: match[1].length,
          text: match[2].replace(/\*\*|__|~~|==|`/g, "").trim(), // strip formatting
          line: idx + 1,
        });
      }
    });

    setHeadings(result);
  }, [content]);

  if (!activeTabPath) {
    return (
      <div
        className="outline-panel"
        style={{
          padding: "16px",
          color: "var(--text-muted)",
          textAlign: "center",
        }}
      >
        Open a note to see its outline
      </div>
    );
  }

  if (headings.length === 0) {
    return (
      <div
        className="outline-panel"
        style={{
          padding: "16px",
          color: "var(--text-muted)",
          textAlign: "center",
        }}
      >
        No headings found
      </div>
    );
  }

  const minLevel = Math.min(...headings.map((h) => h.level));

  return (
    <div className="outline-panel" style={{ padding: "4px 0" }}>
      <div className="sidebar-section-title" style={{ padding: "4px 12px" }}>
        Table of Contents
      </div>
      {headings.map((heading, i) => (
        <div
          key={i}
          className="outline-item"
          style={{ paddingLeft: `${12 + (heading.level - minLevel) * 16}px` }}
          onClick={() => {
            // Dispatch a custom event to scroll the editor to this line
            window.dispatchEvent(
              new CustomEvent("editor-goto-line", {
                detail: { line: heading.line },
              }),
            );
          }}
          title={`Line ${heading.line}`}
        >
          <span className="outline-level">H{heading.level}</span>
          <span className="outline-text">{heading.text}</span>
        </div>
      ))}
    </div>
  );
}
