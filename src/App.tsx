import React, { useEffect, useCallback } from "react";
import { useVaultStore } from "./stores/vaultStore";
import { useEditorStore } from "./stores/editorStore";
import { useGitStore } from "./stores/gitStore";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { EditorArea } from "./components/Editor/EditorArea";
import { RightPanel } from "./components/RightPanel/RightPanel";
import { StatusBar } from "./components/StatusBar";
import { CommandPalette } from "./components/CommandPalette";
import { openTodayNote } from "./components/Sidebar/DailyNotes";
import { resolveWikilink } from "./lib/tauri";
import { listen } from "@tauri-apps/api/event";

export default function App() {
  const vault = useVaultStore((s) => s.vault);
  const refreshFileTree = useVaultStore((s) => s.refreshFileTree);
  const refreshStatus = useGitStore((s) => s.refreshStatus);
  const saveFile = useEditorStore((s) => s.saveFile);
  const [showCommandPalette, setShowCommandPalette] = React.useState(false);
  const [showRightPanel, setShowRightPanel] = React.useState(true);

  // Listen for file system changes
  useEffect(() => {
    if (!vault) return;

    const unlisten = listen("file-change", () => {
      refreshFileTree();
      refreshStatus();
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [vault]);

  // Refresh git status when vault opens
  useEffect(() => {
    if (vault?.is_git_repo) {
      refreshStatus();
    }
  }, [vault]);

  // Handle wikilink clicks — resolve target name to file path and open it
  useEffect(() => {
    const handleWikilinkClick = async (e: Event) => {
      const target = (e as CustomEvent).detail?.target;
      if (!target) return;
      try {
        const path = await resolveWikilink(target);
        if (path) {
          useEditorStore.getState().openFile(path);
        } else {
          // Note doesn't exist yet — create it
          useEditorStore.getState().openFile(`${target}.md`);
        }
      } catch {
        // fallback: try opening as-is
        useEditorStore.getState().openFile(`${target}.md`);
      }
    };

    window.addEventListener("wikilink-click", handleWikilinkClick);
    return () =>
      window.removeEventListener("wikilink-click", handleWikilinkClick);
  }, [vault]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key === "p") {
        e.preventDefault();
        setShowCommandPalette((v) => !v);
      }
      if (mod && e.key === "s") {
        e.preventDefault();
        saveFile();
      }
      if (mod && e.key === "b") {
        e.preventDefault();
        setShowRightPanel((v) => !v);
      }
      if (e.altKey && e.key === "d") {
        e.preventDefault();
        openTodayNote();
      }
      if (mod && e.key === "e") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("toggle-preview-mode"));
      }
      if (e.key === "Escape") {
        setShowCommandPalette(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [saveFile]);

  if (!vault) {
    return <WelcomeScreen />;
  }

  return (
    <div className="app-layout">
      <div className="app-main">
        <Sidebar />
        <EditorArea />
        {showRightPanel && <RightPanel />}
      </div>
      <StatusBar />
      {showCommandPalette && (
        <CommandPalette onClose={() => setShowCommandPalette(false)} />
      )}
    </div>
  );
}
