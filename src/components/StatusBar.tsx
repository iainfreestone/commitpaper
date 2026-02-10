import React from "react";
import { useVaultStore } from "../stores/vaultStore";
import { useEditorStore } from "../stores/editorStore";
import { useGitStore } from "../stores/gitStore";
import { setRootHandle } from "../lib/api";
import { ThemeSelector } from "./ThemeSelector";
import { SettingsMenu } from "./SettingsMenu";

export function StatusBar() {
  const vault = useVaultStore((s) => s.vault);
  const closeVault = useVaultStore((s) => s.closeVault);
  const openVault = useVaultStore((s) => s.openVault);
  const activeTabPath = useEditorStore((s) => s.activeTabPath);
  const isDirty = useEditorStore((s) => s.isDirty);
  const wordCount = useEditorStore((s) => s.wordCount);
  const currentBranch = useGitStore((s) => s.currentBranch);
  const modifiedCount = useGitStore((s) => s.modifiedCount);
  const editorMode = useEditorStore((s) => s.editorMode);
  const toggleEditorMode = useEditorStore((s) => s.toggleEditorMode);

  const handleSwitchVault = async () => {
    try {
      const handle = await (window as any).showDirectoryPicker({
        mode: "readwrite",
      });
      // Save any dirty file first
      if (useEditorStore.getState().isDirty) {
        await useEditorStore.getState().saveFile();
      }
      // Close current vault cleanly
      useEditorStore.getState().closeAllTabs();
      closeVault();
      // Open new vault
      setRootHandle(handle);
      openVault(handle.name);
    } catch (e: any) {
      if (e.name === "AbortError") return;
      console.error("Failed to switch vault:", e);
    }
  };

  const handleCloseVault = () => {
    if (useEditorStore.getState().isDirty) {
      useEditorStore.getState().saveFile();
    }
    useEditorStore.getState().closeAllTabs();
    closeVault();
  };

  // Format the path for display
  const displayPath = activeTabPath
    ? activeTabPath.replace(/\\/g, "/").split("/").slice(-2).join("/")
    : null;

  return (
    <div className="status-bar">
      <div className="status-bar-item vault-switcher">
        <span
          className="vault-name"
          title="Switch folder"
          onClick={handleSwitchVault}
          role="button"
          tabIndex={0}
        >
          📂 {vault?.path ?? "No folder"}
        </span>
        <button
          className="vault-close-btn"
          onClick={handleCloseVault}
          title="Close folder"
        >
          ✕
        </button>
      </div>

      {vault?.is_git_repo && currentBranch && (
        <div className="status-bar-item">
          <span>⎇</span>
          <span className="status-bar-branch">{currentBranch}</span>
        </div>
      )}

      {modifiedCount > 0 && (
        <div className="status-bar-item">
          <span style={{ color: "var(--yellow)" }}>
            ●{modifiedCount} modified
          </span>
        </div>
      )}

      <div className="status-bar-right">
        {activeTabPath && (
          <button
            className="status-bar-item editor-mode-toggle"
            onClick={toggleEditorMode}
            title={`Switch to ${editorMode === "rich" ? "raw markdown" : "rich editor"} (Ctrl+E)`}
          >
            {editorMode === "rich" ? "◇ Rich" : "⟨/⟩ Raw"}
          </button>
        )}
        {activeTabPath && wordCount > 0 && (
          <>
            <div className="status-bar-item">
              {wordCount.toLocaleString()} word{wordCount !== 1 ? "s" : ""}
            </div>
            <div className="status-bar-item" style={{ opacity: 0.6 }}>
              ~{Math.max(1, Math.ceil(wordCount / 200))} min read
            </div>
          </>
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
        <ThemeSelector />
        <SettingsMenu />
        <div className="status-bar-item">CommitPaper</div>
      </div>
    </div>
  );
}
