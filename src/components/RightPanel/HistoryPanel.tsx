import React, { useEffect, useState } from "react";
import { useEditorStore } from "../../stores/editorStore";
import { useVaultStore } from "../../stores/vaultStore";
import * as api from "../../lib/api";
import type { CommitInfo } from "../../lib/api";

function timeAgo(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString();
}

export function HistoryPanel() {
  const activeTabPath = useEditorStore((s) => s.activeTabPath);
  const vault = useVaultStore((s) => s.vault);
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
  const [commitContent, setCommitContent] = useState<string | null>(null);

  useEffect(() => {
    if (!activeTabPath || !vault?.is_git_repo) {
      setCommits([]);
      setSelectedCommit(null);
      setCommitContent(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    api
      .gitFileLog(activeTabPath, 30)
      .then((log) => {
        if (!cancelled) setCommits(log);
      })
      .catch(() => {
        if (!cancelled) setCommits([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTabPath, vault?.is_git_repo]);

  const viewCommit = async (commitId: string) => {
    if (!activeTabPath) return;
    if (selectedCommit === commitId) {
      setSelectedCommit(null);
      setCommitContent(null);
      return;
    }
    try {
      const content = await api.gitFileAtCommit(commitId, activeTabPath);
      setSelectedCommit(commitId);
      setCommitContent(content);
    } catch {
      setSelectedCommit(null);
      setCommitContent(null);
    }
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

  if (!vault?.is_git_repo) {
    return (
      <div className="history-panel">
        <div className="sidebar-section-title">History</div>
        <div
          style={{
            padding: "12px",
            color: "var(--text-muted)",
            fontSize: "12px",
            textAlign: "center",
          }}
        >
          Initialize a Git repository to track file history.
        </div>
      </div>
    );
  }

  return (
    <div className="history-panel">
      <div className="sidebar-section-title">
        History — {activeTabPath.split("/").pop()?.replace(/\.md$/, "")}
      </div>

      {loading ? (
        <div
          style={{
            padding: "12px",
            color: "var(--text-muted)",
            fontSize: "12px",
            textAlign: "center",
          }}
        >
          Loading history...
        </div>
      ) : commits.length === 0 ? (
        <div
          style={{
            padding: "12px",
            color: "var(--text-muted)",
            fontSize: "12px",
            textAlign: "center",
          }}
        >
          No commit history for this file.
        </div>
      ) : (
        <div>
          {commits.map((c) => (
            <div key={c.id}>
              <div
                className="git-commit-item"
                style={{ cursor: "pointer" }}
                onClick={() => viewCommit(c.id)}
                title={`Click to view this version\n${c.author} <${c.email}>`}
              >
                <div className="git-commit-msg">{c.message}</div>
                <div className="git-commit-meta">
                  <span className="git-commit-sha">{c.short_id}</span>
                  <span>{timeAgo(c.timestamp)}</span>
                </div>
              </div>
              {selectedCommit === c.id && commitContent !== null && (
                <div
                  style={{
                    margin: "0 8px 8px",
                    padding: "8px",
                    background: "var(--bg-primary)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "11px",
                    fontFamily: "var(--font-mono)",
                    whiteSpace: "pre-wrap",
                    maxHeight: "300px",
                    overflow: "auto",
                    color: "var(--text-secondary)",
                    lineHeight: "1.5",
                  }}
                >
                  {commitContent}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
