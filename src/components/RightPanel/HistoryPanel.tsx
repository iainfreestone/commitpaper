import React, { useEffect, useState } from "react";
import { useEditorStore } from "../../stores/editorStore";
import { gitFileLog, gitFileAtCommit } from "../../lib/tauri";
import type { CommitInfo } from "../../lib/tauri";

export function HistoryPanel() {
  const activeTabPath = useEditorStore((s) => s.activeTabPath);
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
  const [historicContent, setHistoricContent] = useState<string | null>(null);

  useEffect(() => {
    if (!activeTabPath) {
      setCommits([]);
      return;
    }

    gitFileLog(activeTabPath, 30)
      .then(setCommits)
      .catch(() => setCommits([]));
  }, [activeTabPath]);

  const viewCommit = async (commitId: string) => {
    if (!activeTabPath) return;
    if (selectedCommit === commitId) {
      setSelectedCommit(null);
      setHistoricContent(null);
      return;
    }
    try {
      const content = await gitFileAtCommit(commitId, activeTabPath);
      setSelectedCommit(commitId);
      setHistoricContent(content);
    } catch (e) {
      console.error("Failed to load file at commit:", e);
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

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
      <div className="sidebar-section-title">
        History ({commits.length} commits)
      </div>
      {commits.length === 0 ? (
        <div
          style={{
            padding: "12px",
            color: "var(--text-muted)",
            fontSize: "12px",
            textAlign: "center",
          }}
        >
          No history yet
        </div>
      ) : (
        commits.map((commit) => (
          <div key={commit.id}>
            <div
              className="commit-item"
              onClick={() => viewCommit(commit.id)}
              style={{
                borderLeftColor:
                  selectedCommit === commit.id ? "var(--accent)" : undefined,
                background:
                  selectedCommit === commit.id
                    ? "var(--bg-surface)"
                    : undefined,
              }}
            >
              <div className="commit-message">
                {commit.message.split("\n")[0]}
              </div>
              <div className="commit-meta">
                <span>{commit.short_id}</span>
                <span> · </span>
                <span>{commit.author}</span>
                <span> · </span>
                <span>{formatDate(commit.timestamp)}</span>
              </div>
            </div>
            {selectedCommit === commit.id && historicContent !== null && (
              <div
                style={{
                  margin: "0 8px 8px 18px",
                  padding: "8px",
                  background: "var(--bg-tertiary)",
                  borderRadius: "var(--radius-sm)",
                  fontSize: "12px",
                  fontFamily: "var(--font-mono)",
                  whiteSpace: "pre-wrap",
                  maxHeight: "300px",
                  overflow: "auto",
                  color: "var(--text-secondary)",
                }}
              >
                {historicContent}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
