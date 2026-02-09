import React, { useEffect, useState } from "react";
import { useGitStore } from "../../stores/gitStore";
import { useVaultStore } from "../../stores/vaultStore";

function timeAgo(timestamp: number): string {
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString();
}

export function GitPanel() {
  const vault = useVaultStore((s) => s.vault);
  const {
    status,
    currentBranch,
    branches,
    log,
    commitMessage,
    isLoading,
    gitWarning,
    gitSuccess,
    authorName,
    authorEmail,
    refreshAll,
    refreshStatus,
    setCommitMessage,
    dismissWarning,
    dismissSuccess,
    stageFile,
    unstageFile,
    stageAll,
    commit,
    quickCommit,
    quickCommitAndPush,
    createBranch,
    checkoutBranch,
    initRepo,
    setAuthor,
  } = useGitStore();

  const [showBranches, setShowBranches] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [showAuthorSettings, setShowAuthorSettings] = useState(false);
  const [editName, setEditName] = useState(authorName);
  const [editEmail, setEditEmail] = useState(authorEmail);
  const [showLog, setShowLog] = useState(false);

  useEffect(() => {
    if (vault?.is_git_repo) {
      refreshAll();
    }
  }, [vault?.is_git_repo]);

  // Auto-dismiss success messages
  useEffect(() => {
    if (gitSuccess) {
      const timer = setTimeout(() => dismissSuccess(), 4000);
      return () => clearTimeout(timer);
    }
  }, [gitSuccess]);

  const stagedFiles = status.filter((f) => f.staged);
  const unstagedFiles = status.filter((f) => !f.staged);

  // If not a git repo, offer to initialize
  if (vault && !vault.is_git_repo) {
    return (
      <div className="git-panel">
        <div
          style={{
            padding: "16px 12px",
            textAlign: "center",
            color: "var(--text-muted)",
            fontSize: "12px",
          }}
        >
          <p style={{ marginBottom: "12px" }}>
            This vault is not a Git repository.
          </p>
          <button
            className="git-commit-btn"
            onClick={initRepo}
            disabled={isLoading}
            style={{ width: "100%" }}
          >
            Initialize Git Repository
          </button>
        </div>
      </div>
    );
  }

  const statusIcon = (s: string) => {
    switch (s) {
      case "Modified":
        return <span style={{ color: "var(--yellow)" }}>M</span>;
      case "Added":
        return <span style={{ color: "var(--green)" }}>A</span>;
      case "Deleted":
        return <span style={{ color: "var(--red)" }}>D</span>;
      case "Untracked":
        return <span style={{ color: "var(--text-muted)" }}>U</span>;
      case "Renamed":
        return <span style={{ color: "var(--blue)" }}>R</span>;
      default:
        return <span style={{ color: "var(--text-muted)" }}>?</span>;
    }
  };

  return (
    <div className="git-panel">
      {/* Branch bar */}
      <div className="git-branch-bar">
        <span className="git-branch-icon">⎇</span>
        <span
          className="git-branch-name"
          style={{ cursor: "pointer", flex: 1 }}
          onClick={() => setShowBranches(!showBranches)}
          title="Click to manage branches"
        >
          {currentBranch || "No branch"}
        </span>
        <button
          className="git-action-btn"
          onClick={() => setShowBranches(!showBranches)}
          title="Branches"
          style={{ fontSize: "10px" }}
        >
          {showBranches ? "▾" : "▸"}
        </button>
      </div>

      {/* Branch management */}
      {showBranches && (
        <div
          style={{
            padding: "4px 8px 8px",
            borderBottom: "1px solid var(--border-color)",
          }}
        >
          {branches.map((b) => (
            <div
              key={b.name}
              className="git-file-item"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "3px 4px",
                cursor: b.is_head ? "default" : "pointer",
                opacity: b.is_head ? 1 : 0.8,
                fontWeight: b.is_head ? 600 : 400,
              }}
              onClick={() => !b.is_head && checkoutBranch(b.name)}
            >
              <span style={{ fontSize: "12px" }}>
                {b.is_head ? "● " : "○ "}
                {b.name}
              </span>
            </div>
          ))}
          <div
            style={{
              display: "flex",
              gap: "4px",
              marginTop: "6px",
            }}
          >
            <input
              placeholder="New branch..."
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newBranchName.trim()) {
                  createBranch(newBranchName.trim());
                  setNewBranchName("");
                }
              }}
              style={{
                flex: 1,
                fontSize: "11px",
                padding: "3px 6px",
                background: "var(--bg-primary)",
                border: "1px solid var(--border-color)",
                borderRadius: "var(--radius-sm)",
                color: "var(--text-primary)",
              }}
            />
            <button
              className="git-action-btn"
              onClick={() => {
                if (newBranchName.trim()) {
                  createBranch(newBranchName.trim());
                  setNewBranchName("");
                }
              }}
              title="Create branch"
            >
              +
            </button>
          </div>
        </div>
      )}

      {/* Alerts */}
      {gitWarning && (
        <div className="git-alert git-alert-warning">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <span>{gitWarning}</span>
            <button
              className="git-action-btn"
              onClick={dismissWarning}
              style={{ flexShrink: 0, marginLeft: "8px" }}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {gitSuccess && (
        <div className="git-alert git-alert-success">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <span>{gitSuccess}</span>
            <button
              className="git-action-btn"
              onClick={dismissSuccess}
              style={{ flexShrink: 0, marginLeft: "8px" }}
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div
        style={{
          padding: "8px",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
        }}
      >
        <button
          className="git-commit-btn"
          onClick={() => quickCommit(commitMessage || undefined)}
          disabled={isLoading || status.length === 0}
          style={{ width: "100%" }}
          title="Stage all changes and commit with auto-generated message (or your message below)"
        >
          {isLoading ? "..." : `↑ Commit All (${status.length})`}
        </button>
        <button
          className="git-commit-btn git-commit-btn-secondary"
          onClick={() => quickCommitAndPush(commitMessage || undefined)}
          disabled={isLoading || status.length === 0}
          style={{ width: "100%" }}
          title="Stage all, commit, and push to remote"
        >
          {isLoading ? "..." : "↑ Commit & Push"}
        </button>
      </div>

      {/* Optional commit message */}
      <div style={{ padding: "0 8px 8px" }}>
        <textarea
          className="git-commit-input"
          placeholder="Optional message (auto-generated if empty)..."
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              quickCommit(commitMessage || undefined);
            }
          }}
          rows={2}
        />
      </div>

      {/* Staged changes */}
      <div style={{ borderTop: "1px solid var(--border-color)" }}>
        <div
          className="git-section-header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>Staged ({stagedFiles.length})</span>
          {stagedFiles.length > 0 && (
            <button
              className="git-action-btn"
              onClick={async () => {
                for (const f of stagedFiles) {
                  await unstageFile(f.path);
                }
              }}
              title="Unstage all"
              style={{ fontSize: "10px" }}
            >
              −
            </button>
          )}
        </div>
        {stagedFiles.length === 0 ? (
          <div className="git-empty-text">No staged changes</div>
        ) : (
          stagedFiles.map((f) => (
            <div
              key={`staged-${f.path}`}
              className="git-file-item"
              title={f.path}
            >
              <span className="git-file-status">{statusIcon(f.status)}</span>
              <span className="git-file-name">
                {f.path.split("/").pop() || f.path}
              </span>
              <button
                className="git-action-btn git-file-action"
                onClick={() => unstageFile(f.path)}
                title="Unstage"
              >
                −
              </button>
            </div>
          ))
        )}
      </div>

      {/* Unstaged changes */}
      <div style={{ borderTop: "1px solid var(--border-color)" }}>
        <div
          className="git-section-header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>Changes ({unstagedFiles.length})</span>
          {unstagedFiles.length > 0 && (
            <button
              className="git-action-btn"
              onClick={stageAll}
              title="Stage all"
              style={{ fontSize: "10px" }}
            >
              +
            </button>
          )}
        </div>
        {unstagedFiles.length === 0 ? (
          <div className="git-empty-text">No changes</div>
        ) : (
          unstagedFiles.map((f) => (
            <div
              key={`unstaged-${f.path}`}
              className="git-file-item"
              title={f.path}
            >
              <span className="git-file-status">{statusIcon(f.status)}</span>
              <span className="git-file-name">
                {f.path.split("/").pop() || f.path}
              </span>
              <button
                className="git-action-btn git-file-action"
                onClick={() => stageFile(f.path)}
                title="Stage"
              >
                +
              </button>
            </div>
          ))
        )}
      </div>

      {/* Commit log */}
      <div style={{ borderTop: "1px solid var(--border-color)" }}>
        <div
          className="git-section-header"
          style={{
            cursor: "pointer",
            display: "flex",
            justifyContent: "space-between",
          }}
          onClick={() => {
            setShowLog(!showLog);
            if (!showLog && log.length === 0) {
              useGitStore.getState().refreshLog();
            }
          }}
        >
          <span>Commits</span>
          <span style={{ fontSize: "10px" }}>{showLog ? "▾" : "▸"}</span>
        </div>
        {showLog && (
          <div>
            {log.length === 0 ? (
              <div className="git-empty-text">No commits yet</div>
            ) : (
              log.slice(0, 20).map((c) => (
                <div
                  key={c.id}
                  className="git-commit-item"
                  title={`${c.id}\n${c.author} <${c.email}>\n${new Date(c.timestamp * 1000).toLocaleString()}`}
                >
                  <div className="git-commit-msg">{c.message}</div>
                  <div className="git-commit-meta">
                    <span className="git-commit-sha">{c.short_id}</span>
                    <span>{timeAgo(c.timestamp)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Author settings */}
      <div style={{ borderTop: "1px solid var(--border-color)" }}>
        <div
          className="git-section-header"
          style={{
            cursor: "pointer",
            display: "flex",
            justifyContent: "space-between",
          }}
          onClick={() => setShowAuthorSettings(!showAuthorSettings)}
        >
          <span>Author</span>
          <span style={{ fontSize: "10px" }}>
            {showAuthorSettings ? "▾" : "▸"}
          </span>
        </div>
        {showAuthorSettings && (
          <div style={{ padding: "4px 8px 8px" }}>
            <input
              placeholder="Name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={() => setAuthor(editName, editEmail)}
              style={{
                width: "100%",
                fontSize: "11px",
                padding: "4px 6px",
                marginBottom: "4px",
                background: "var(--bg-primary)",
                border: "1px solid var(--border-color)",
                borderRadius: "var(--radius-sm)",
                color: "var(--text-primary)",
              }}
            />
            <input
              placeholder="Email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              onBlur={() => setAuthor(editName, editEmail)}
              style={{
                width: "100%",
                fontSize: "11px",
                padding: "4px 6px",
                background: "var(--bg-primary)",
                border: "1px solid var(--border-color)",
                borderRadius: "var(--radius-sm)",
                color: "var(--text-primary)",
              }}
            />
            <div
              style={{
                fontSize: "10px",
                color: "var(--text-muted)",
                marginTop: "4px",
              }}
            >
              Used for commit authorship
            </div>
          </div>
        )}
      </div>

      {/* Refresh */}
      <div
        style={{ padding: "8px", borderTop: "1px solid var(--border-color)" }}
      >
        <button
          className="git-commit-btn git-commit-btn-secondary"
          onClick={refreshAll}
          disabled={isLoading}
          style={{ width: "100%" }}
        >
          ↻ Refresh
        </button>
      </div>
    </div>
  );
}
