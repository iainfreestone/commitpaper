import React from "react";
import { useEditorStore } from "../../stores/editorStore";

export function HistoryPanel() {
  const activeTabPath = useEditorStore((s) => s.activeTabPath);

  if (!activeTabPath) {
    return (
      <div className="history-panel">
        <div
          style={{
            padding: "12px",
            color: "var(--text-muted)",
            fontSize: "12px",
            textAlign: "center",
          }}
        >
          Open a note to see its history
        </div>
      </div>
    );
  }

  return (
    <div className="history-panel">
      <div className="sidebar-section-title">History</div>
      <div
        style={{
          padding: "16px",
          textAlign: "center",
          color: "var(--text-muted)",
          fontSize: "13px",
          lineHeight: "1.6",
        }}
      >
        <div style={{ fontSize: "24px", marginBottom: "8px" }}>📜</div>
        <div>
          File history is not available in the browser version.
        </div>
        <div style={{ fontSize: "12px", marginTop: "8px" }}>
          Use <code style={{ color: "var(--accent)" }}>git log --follow -- {activeTabPath}</code> in your terminal to view history.
        </div>
      </div>
    </div>
  );
}
