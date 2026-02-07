import React, { useEffect, useState } from "react";
import { useGitStore } from "../../stores/gitStore";

export function GitPanel() {
  const {
    status,
    currentBranch,
    branches,
    commitMessage,
    isLoading,
    refreshStatus,
    refreshBranches,
    stageFile,
    unstageFile,
    stageAll,
    commit,
    pull,
    push,
    setCommitMessage,
    createBranch,
    checkoutBranch,
  } = useGitStore();

  const [showBranches, setShowBranches] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");

  useEffect(() => {
    refreshStatus();
    refreshBranches();
  }, []);

  const stagedFiles = status.filter((f) => f.staged);
  const unstagedFiles = status.filter((f) => !f.staged);

  const statusBadge = (s: string) => {
    const map: Record<string, { letter: string; cls: string }> = {
      Modified: { letter: "M", cls: "modified" },
      Added: { letter: "A", cls: "added" },
      Deleted: { letter: "D", cls: "deleted" },
      Untracked: { letter: "U", cls: "untracked" },
      Renamed: { letter: "R", cls: "modified" },
      Conflicted: { letter: "!", cls: "conflicted" },
    };
    const info = map[s] || { letter: "?", cls: "" };
    return (
      <span className={`git-status-badge ${info.cls}`}>{info.letter}</span>
    );
  };

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) return;
    await createBranch(newBranchName);
    await checkoutBranch(newBranchName);
    setNewBranchName("");
  };

  return (
    <div className="git-panel">
      {/* Branch info */}
      <div
        className="git-branch-bar"
        onClick={() => setShowBranches((v) => !v)}
        style={{ cursor: "pointer" }}
      >
        <span className="git-branch-icon">⎇</span>
        <span className="git-branch-name">{currentBranch || "No branch"}</span>
      </div>

      {showBranches && (
        <div style={{ marginBottom: "8px", padding: "4px" }}>
          <div style={{ marginBottom: "4px" }}>
            <input
              placeholder="New branch name..."
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateBranch()}
              style={{ width: "100%", fontSize: "11px" }}
            />
          </div>
          {branches.map((b) => (
            <div
              key={b.name}
              className="file-tree-item"
              style={{ fontSize: "12px" }}
              onClick={() => {
                checkoutBranch(b.name);
                setShowBranches(false);
              }}
            >
              <span
                style={{
                  marginRight: "6px",
                  color: b.is_head ? "var(--accent)" : "var(--text-muted)",
                }}
              >
                {b.is_head ? "●" : "○"}
              </span>
              {b.name}
              {(b.ahead > 0 || b.behind > 0) && (
                <span
                  style={{
                    marginLeft: "auto",
                    color: "var(--text-muted)",
                    fontSize: "11px",
                  }}
                >
                  {b.ahead > 0 && `↑${b.ahead}`}{" "}
                  {b.behind > 0 && `↓${b.behind}`}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="git-actions-bar">
        <button onClick={() => pull()} disabled={isLoading}>
          ↓ Pull
        </button>
        <button onClick={() => push()} disabled={isLoading}>
          ↑ Push
        </button>
        <button onClick={() => refreshStatus()}>↻ Refresh</button>
      </div>

      {/* Staged changes */}
      {stagedFiles.length > 0 && (
        <>
          <div className="sidebar-section-title">
            Staged Changes ({stagedFiles.length})
          </div>
          {stagedFiles.map((f) => (
            <div key={`s-${f.path}`} className="git-status-item">
              {statusBadge(f.status)}
              <span className="git-status-path">{f.path}</span>
              <button
                className="git-action-btn"
                onClick={() => unstageFile(f.path)}
                title="Unstage"
              >
                −
              </button>
            </div>
          ))}
        </>
      )}

      {/* Unstaged changes */}
      {unstagedFiles.length > 0 && (
        <>
          <div
            className="sidebar-section-title"
            style={{ display: "flex", alignItems: "center" }}
          >
            <span style={{ flex: 1 }}>Changes ({unstagedFiles.length})</span>
            <button
              className="git-action-btn"
              onClick={() => stageAll()}
              title="Stage All"
              style={{ fontSize: "11px" }}
            >
              + All
            </button>
          </div>
          {unstagedFiles.map((f) => (
            <div key={`u-${f.path}`} className="git-status-item">
              {statusBadge(f.status)}
              <span className="git-status-path">{f.path}</span>
              <button
                className="git-action-btn"
                onClick={() => stageFile(f.path)}
                title="Stage"
              >
                +
              </button>
            </div>
          ))}
        </>
      )}

      {status.length === 0 && (
        <div
          style={{
            padding: "12px",
            textAlign: "center",
            color: "var(--text-muted)",
            fontSize: "12px",
          }}
        >
          No changes
        </div>
      )}

      {/* Commit area */}
      <div className="git-commit-area">
        <textarea
          className="git-commit-input"
          placeholder="Commit message..."
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
              commit();
            }
          }}
        />
        <button
          className="git-commit-btn"
          onClick={() => commit()}
          disabled={!commitMessage.trim() || stagedFiles.length === 0}
        >
          Commit ({stagedFiles.length} staged)
        </button>
      </div>
    </div>
  );
}
