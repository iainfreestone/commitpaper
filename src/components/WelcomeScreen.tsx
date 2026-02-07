import React from "react";
import { useVaultStore } from "../stores/vaultStore";
import { setRootHandle } from "../lib/api";

export function WelcomeScreen() {
  const openVault = useVaultStore((s) => s.openVault);
  const isLoading = useVaultStore((s) => s.isLoading);
  const error = useVaultStore((s) => s.error);

  const handleOpen = async () => {
    try {
      // Use the File System Access API to pick a directory
      const handle = await (window as any).showDirectoryPicker({ mode: "readwrite" });
      setRootHandle(handle);
      openVault(handle.name);
    } catch (e: any) {
      if (e.name === "AbortError") return; // User cancelled
      console.error("Failed to open directory:", e);
    }
  };

  const isSupported = typeof (window as any).showDirectoryPicker === "function";

  return (
    <div className="welcome-screen">
      <h1>CommitPaper</h1>
      <p>
        Git-native personal knowledge management. Open a folder to start — it
        works with any Git repository.
      </p>
      {!isSupported && (
        <p style={{ color: "var(--red)", fontSize: "13px", maxWidth: 400 }}>
          Your browser does not support the File System Access API. Please use
          Chrome, Edge, or another Chromium-based browser.
        </p>
      )}
      {error && (
        <p style={{ color: "var(--red)", fontSize: "13px" }}>{error}</p>
      )}
      <button
        className="open-btn"
        onClick={handleOpen}
        disabled={isLoading || !isSupported}
      >
        {isLoading ? "Opening..." : "Open Vault"}
      </button>
      <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
        Ctrl+P to open command palette
      </p>
      <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "-12px" }}>
        Web version — Git operations require an external Git client
      </p>
    </div>
  );
}
