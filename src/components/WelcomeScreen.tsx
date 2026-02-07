import React from "react";
import { useVaultStore } from "../stores/vaultStore";
import { open } from "@tauri-apps/plugin-dialog";

export function WelcomeScreen() {
  const openVault = useVaultStore((s) => s.openVault);
  const isLoading = useVaultStore((s) => s.isLoading);
  const error = useVaultStore((s) => s.error);

  const handleOpen = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected && typeof selected === "string") {
      openVault(selected);
    }
  };

  return (
    <div className="welcome-screen">
      <h1>Gitsidian</h1>
      <p>
        Git-native personal knowledge management. Open a folder to start — it
        works with any Git repository.
      </p>
      {error && (
        <p style={{ color: "var(--red)", fontSize: "13px" }}>{error}</p>
      )}
      <button className="open-btn" onClick={handleOpen} disabled={isLoading}>
        {isLoading ? "Opening..." : "Open Vault"}
      </button>
      <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>
        Ctrl+P to open command palette
      </p>
    </div>
  );
}
