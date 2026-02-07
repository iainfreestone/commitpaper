import React, { useEffect, useState } from "react";
import { useVaultStore } from "../stores/vaultStore";
import { setRootHandle, getRecentVaults, verifyPermission } from "../lib/api";

interface RecentVault {
  name: string;
  handle: FileSystemDirectoryHandle;
}

export function WelcomeScreen() {
  const openVault = useVaultStore((s) => s.openVault);
  const isLoading = useVaultStore((s) => s.isLoading);
  const error = useVaultStore((s) => s.error);
  const [recentVaults, setRecentVaults] = useState<RecentVault[]>([]);

  useEffect(() => {
    getRecentVaults().then(setRecentVaults).catch(() => {});
  }, []);

  const handleOpen = async () => {
    try {
      const handle = await (window as any).showDirectoryPicker({ mode: "readwrite" });
      setRootHandle(handle);
      openVault(handle.name);
    } catch (e: any) {
      if (e.name === "AbortError") return;
      console.error("Failed to open directory:", e);
    }
  };

  const handleOpenRecent = async (vault: RecentVault) => {
    try {
      const granted = await verifyPermission(vault.handle);
      if (!granted) {
        // Permission denied — user needs to re-pick
        console.warn("Permission denied for", vault.name);
        return;
      }
      setRootHandle(vault.handle);
      openVault(vault.handle.name);
    } catch (e) {
      console.error("Failed to restore vault:", e);
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

      {recentVaults.length > 0 && (
        <div className="recent-vaults">
          <h3 style={{ fontSize: "13px", color: "var(--text-muted)", marginBottom: "8px" }}>
            Recent Vaults
          </h3>
          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 16px 0" }}>
            {recentVaults.map((v) => (
              <li key={v.name}>
                <button
                  className="recent-vault-btn"
                  onClick={() => handleOpenRecent(v)}
                  disabled={isLoading}
                >
                  <span className="recent-vault-icon">📁</span>
                  <span>{v.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        className="open-btn"
        onClick={handleOpen}
        disabled={isLoading || !isSupported}
      >
        {isLoading ? "Opening..." : recentVaults.length > 0 ? "Open Different Vault" : "Open Vault"}
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
