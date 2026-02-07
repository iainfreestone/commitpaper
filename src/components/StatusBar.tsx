import React from "react";
import { useVaultStore } from "../stores/vaultStore";
import { useEditorStore } from "../stores/editorStore";
import { useGitStore } from "../stores/gitStore";

export function StatusBar() {
  const vault = useVaultStore((s) => s.vault);
  const activeTabPath = useEditorStore((s) => s.activeTabPath);
  const isDirty = useEditorStore((s) => s.isDirty);
  const wordCount = useEditorStore((s) => s.wordCount);
  const currentBranch = useGitStore((s) => s.currentBranch);
  const status = useGitStore((s) => s.status);

  const changedCount = status.filter((f) => !f.staged).length;
  const stagedCount = status.filter((f) => f.staged).length;

  // Format the path for display
  const displayPath = activeTabPath
    ? activeTabPath.replace(/\\/g, "/").split("/").slice(-2).join("/")
    : null;

  return (
    <div className="status-bar">
      {vault?.is_git_repo && currentBranch && (
        <div className="status-bar-item">
          <span>⎇</span>
          <span className="status-bar-branch">{currentBranch}</span>
        </div>
      )}

      {status.length > 0 && (
        <div className="status-bar-item">
          {changedCount > 0 && (
            <span style={{ color: "var(--yellow)" }}>●{changedCount}</span>
          )}
          {stagedCount > 0 && (
            <span style={{ color: "var(--green)", marginLeft: "4px" }}>
              ✓{stagedCount}
            </span>
          )}
        </div>
      )}

      <div className="status-bar-right">
        {activeTabPath && wordCount > 0 && (
          <div className="status-bar-item">
            {wordCount.toLocaleString()} word{wordCount !== 1 ? "s" : ""}
          </div>
        )}
        {isDirty && (
          <div className="status-bar-item" style={{ color: "var(--yellow)" }}>
            Unsaved
          </div>
        )}
        {displayPath && (
          <div className="status-bar-item" style={{ opacity: 0.7 }}>
            {displayPath}
          </div>
        )}
        <div className="status-bar-item">Gitsidian</div>
      </div>
    </div>
  );
}
