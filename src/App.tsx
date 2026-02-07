import React, { useEffect } from "react";
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
import { resolveWikilink, startFileWatching, stopFileWatching } from "./lib/api";

export default function App() {
  const vault = useVaultStore((s) => s.vault);
  const refreshFileTree = useVaultStore((s) => s.refreshFileTree);
  const refreshStatus = useGitStore((s) => s.refreshStatus);
  const saveFile = useEditorStore((s) => s.saveFile);
  const [showCommandPalette, setShowCommandPalette] = React.useState(false);
  const [showRightPanel, setShowRightPanel] = React.useState(true);

  // File watching via polling
  useEffect(() => {
    if (!vault) return;
    startFileWatching(() => {
      refreshFileTree();
      refreshStatus();
    });
    return () => stopFileWatching();
  }, [vault]);

  // Refresh git status when vault opens
  useEffect(() => {
    if (vault?.is_git_repo) {
      refreshStatus();
    }
  }, [vault]);

  // Handle wikilink clicks
  useEffect(() => {
    const handleWikilinkClick = async (e: Event) => {
      const target = (e as CustomEvent).detail?.target;
      if (!target) return;
      try {
        const path = await resolveWikilink(target);
        if (path) {
          useEditorStore.getState().openFile(path);
        } else {
          useEditorStore.getState().openFile(`${target}.md`);
        }
      } catch {
        useEditorStore.getState().openFile(`${target}.md`);
      }
    };
    window.addEventListener("wikilink-click", handleWikilinkClick);
    return () => window.removeEventListener("wikilink-click", handleWikilinkClick);
  }, [vault]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key === "p") { e.preventDefault(); setShowCommandPalette((v) => !v); }
      if (mod && e.key === "s") { e.preventDefault(); saveFile(); }
      if (mod && e.key === "b") { e.preventDefault(); setShowRightPanel((v) => !v); }
      if (e.altKey && e.key === "d") { e.preventDefault(); openTodayNote(); }
      if (mod && e.key === "e") { e.preventDefault(); window.dispatchEvent(new CustomEvent("toggle-preview-mode")); }
      if (e.key === "Escape") { setShowCommandPalette(false); }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [saveFile]);

  // Warn before unload if dirty
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (useEditorStore.getState().isDirty) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

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
