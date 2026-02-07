import React, { useEffect } from "react";
import { useGitStore } from "../../stores/gitStore";

export function GitPanel() {
  const {
    currentBranch,
    modifiedCount,
    gitWarning,
    refreshStatus,
    dismissWarning,
  } = useGitStore();

  useEffect(() => {
    refreshStatus();
  }, []);

  return (
    <div className="git-panel">
      {/* Branch info */}
      <div className="git-branch-bar">
        <span className="git-branch-icon">⎇</span>
        <span className="git-branch-name">{currentBranch || "No branch"}</span>
      </div>

      {/* Info banner */}
      {gitWarning && (
        <div
          style={{
            padding: "8px 12px",
            margin: "8px 0",
            background: "rgba(249, 226, 175, 0.1)",
            border: "1px solid rgba(249, 226, 175, 0.3)",
            borderRadius: "var(--radius-sm)",
            fontSize: "12px",
            color: "var(--yellow)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <span>{gitWarning}</span>
            <button
              className="git-action-btn"
              onClick={dismissWarning}
              style={{ flexShrink: 0, marginLeft: "8px" }}
              title="Dismiss"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Modified files count */}
      {modifiedCount > 0 ? (
        <div style={{ padding: "8px" }}>
          <div className="sidebar-section-title">
            Modified Files ({modifiedCount})
          </div>
          <div
            style={{
              padding: "8px",
              fontSize: "12px",
              color: "var(--text-muted)",
            }}
          >
            Files have been modified in this session. Use your Git client to
            review and commit changes.
          </div>
        </div>
      ) : (
        <div
          style={{
            padding: "12px",
            textAlign: "center",
            color: "var(--text-muted)",
            fontSize: "12px",
          }}
        >
          No changes in this session
        </div>
      )}

      {/* Guidance */}
      <div
        style={{
          padding: "12px",
          borderTop: "1px solid var(--border-color)",
          marginTop: "8px",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            color: "var(--text-muted)",
            lineHeight: "1.5",
          }}
        >
          <strong style={{ color: "var(--text-secondary)" }}>Git in the browser</strong>
          <br />
          The web version shows your branch and tracks modified files. To
          commit, push, or pull, use your terminal or Git client:
          <br />
          <br />
          <code style={{ color: "var(--accent)", fontSize: "11px" }}>
            git add . && git commit -m "update" && git push
          </code>
        </div>
      </div>

      {/* Refresh button */}
      <div style={{ padding: "0 8px 8px" }}>
        <button
          className="git-commit-btn"
          onClick={() => refreshStatus()}
          style={{ width: "100%" }}
        >
          ↻ Refresh Status
        </button>
      </div>
    </div>
  );
}
