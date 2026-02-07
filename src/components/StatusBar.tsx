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
  const modifiedCount = useGitStore((s) => s.modifiedCount);

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

      {modifiedCount > 0 && (
        <div className="status-bar-item">
          <span style={{ color: "var(--yellow)" }}>●{modifiedCount} modified</span>
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
        <div className="status-bar-item">Gitsidian Web</div>
      </div>
    </div>
  );
}
