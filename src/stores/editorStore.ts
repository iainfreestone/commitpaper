import { create } from "zustand";
import * as api from "../lib/api";
import { getSettings, updateSettings } from "../lib/settings";

export type EditorMode = "rich" | "raw";
export type EditorWidth = "readable" | "full";

interface EditorStore {
  openTabs: TabInfo[];
  activeTabPath: string | null;
  content: string;
  isDirty: boolean;
  wordCount: number;
  editorMode: EditorMode;
  editorWidth: EditorWidth;
  fontSize: number;
  lineNumbers: boolean;

  openFile: (path: string) => Promise<void>;
  closeTab: (path: string, force?: boolean) => void;
  closeAllTabs: () => Promise<void>;
  setActiveTab: (path: string) => Promise<void>;
  setContent: (content: string) => void;
  setWordCount: (count: number) => void;
  saveFile: () => Promise<void>;
  renameActiveTab: (oldPath: string, newPath: string) => void;
  toggleEditorMode: () => void;
  setEditorWidth: (width: EditorWidth) => void;
  setFontSize: (size: number) => void;
  setLineNumbers: (on: boolean) => void;
}

export interface TabInfo {
  id: number;
  path: string;
  name: string;
  isDirty: boolean;
}

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
let titleRenameTimer: ReturnType<typeof setTimeout> | null = null;
const AUTO_SAVE_DELAY = 2000;
const TITLE_RENAME_DELAY = 800;
let nextTabId = 1;

// ─── Live editor content provider ──────────────────────────────
// The live Crepe/ProseMirror editor is the source of truth for content.
// Editor.tsx registers a function that returns crepe.getMarkdown().
// All save operations use this instead of the (potentially stale) store content.

let _getEditorMarkdown: (() => string) | null = null;

/**
 * Register a function that returns the live editor markdown.
 * Called by Editor.tsx when the Crepe instance is ready, cleared on unmount.
 */
export function registerEditorContentProvider(fn: (() => string) | null) {
  _getEditorMarkdown = fn;
}

/**
 * Get the freshest content available: from the live editor if possible,
 * otherwise fall back to the store's last-known content.
 */
function getFreshContent(): string {
  if (_getEditorMarkdown) {
    try {
      return _getEditorMarkdown();
    } catch {
      // Editor might be mid-destruction
    }
  }
  return useEditorStore.getState().content;
}

/** Extract the text of the first H1 heading from markdown content */
function extractH1Title(content: string): string | null {
  const match = content.match(/^#\s+(.+)$/m);
  if (!match) return null;
  const title = match[1].trim();
  return title || null;
}

/** Sanitize a title string into a valid filename (no path separators, etc.) */
function sanitizeFilename(title: string): string {
  return title
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

let isRenaming = false;

async function handleTitleRename(
  newTitle: string,
  currentPath: string,
  store: EditorStore,
) {
  if (isRenaming) return;
  const sanitized = sanitizeFilename(newTitle);
  if (!sanitized) return;

  const currentName = (currentPath.split("/").pop() || "").replace(
    /\.md$/i,
    "",
  );
  if (sanitized.toLowerCase() === currentName.toLowerCase()) return;

  const dir = currentPath.includes("/")
    ? currentPath.substring(0, currentPath.lastIndexOf("/") + 1)
    : "";
  let newPath = `${dir}${sanitized}.md`;

  if (await api.fileExists(newPath)) {
    let i = 1;
    while (await api.fileExists(`${dir}${sanitized} ${i}.md`)) {
      i++;
    }
    newPath = `${dir}${sanitized} ${i}.md`;
  }

  try {
    isRenaming = true;
    // Use fresh content from the live editor, not the potentially stale store
    const content = getFreshContent();
    await api.writeFile(currentPath, content);
    await api.renameFile(currentPath, newPath);
    store.renameActiveTab(currentPath, newPath);
    const vaultStore = (await import("./vaultStore")).useVaultStore.getState();
    vaultStore.refreshFileTree();
  } catch (e) {
    console.error("Failed to rename file from title:", e);
  } finally {
    isRenaming = false;
  }
}

/** Clear all pending timers (auto-save, title rename) */
function clearPendingTimers() {
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = null;
  }
  if (titleRenameTimer) {
    clearTimeout(titleRenameTimer);
    titleRenameTimer = null;
  }
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  openTabs: [],
  activeTabPath: null,
  content: "",
  isDirty: false,
  wordCount: 0,
  editorMode: "rich" as EditorMode,
  editorWidth: getSettings().editorWidth,
  fontSize: getSettings().fontSize,
  lineNumbers: getSettings().lineNumbers,

  openFile: async (path: string) => {
    try {
      // Save the current file before opening a new one
      const { activeTabPath, isDirty } = get();
      if (activeTabPath && isDirty) {
        await get().saveFile();
      }

      // If this file is already active, nothing to do
      if (activeTabPath === path) return;

      // Clear pending timers from the old file
      clearPendingTimers();

      const content = await api.readFile(path);
      const name = path.split("/").pop() || path;

      const { openTabs } = get();
      const existingTab = openTabs.find((t) => t.path === path);

      if (!existingTab) {
        set({
          openTabs: [
            ...openTabs,
            { id: nextTabId++, path, name, isDirty: false },
          ],
          activeTabPath: path,
          content,
          isDirty: false,
        });
      } else {
        set({ activeTabPath: path, content, isDirty: false });
      }
    } catch (e) {
      console.error("Failed to open file:", e);
    }
  },

  closeTab: (path: string, force?: boolean) => {
    const { openTabs, activeTabPath } = get();
    const tab = openTabs.find((t) => t.path === path);

    if (tab?.isDirty && !force) {
      const discard = window.confirm(
        `"${tab.name}" has unsaved changes. Close without saving?`,
      );
      if (!discard) return;
    }

    const newTabs = openTabs.filter((t) => t.path !== path);

    if (activeTabPath === path) {
      // Closing the active tab — switch to an adjacent tab
      const idx = openTabs.findIndex((t) => t.path === path);
      const newActive =
        newTabs[Math.min(idx, newTabs.length - 1)]?.path || null;

      clearPendingTimers();

      if (newActive) {
        api.readFile(newActive).then((content) => {
          set({
            openTabs: newTabs,
            activeTabPath: newActive,
            content,
            isDirty: false,
          });
        });
      } else {
        set({
          openTabs: newTabs,
          activeTabPath: null,
          content: "",
          isDirty: false,
        });
      }
    } else {
      // Closing a background tab — don't touch the active tab's content
      set({ openTabs: newTabs });
    }
  },

  closeAllTabs: async () => {
    // Save current file before closing everything
    const { isDirty, activeTabPath } = get();
    if (activeTabPath && isDirty) {
      await get().saveFile();
    }
    clearPendingTimers();
    set({
      openTabs: [],
      activeTabPath: null,
      content: "",
      isDirty: false,
      wordCount: 0,
    });
  },

  setActiveTab: async (path: string) => {
    const { activeTabPath, isDirty } = get();

    // Don't do anything if already on this tab
    if (activeTabPath === path) return;

    // Save current file before switching
    if (activeTabPath && isDirty) {
      await get().saveFile();
    }

    clearPendingTimers();

    try {
      const content = await api.readFile(path);
      set({ activeTabPath: path, content, isDirty: false });
    } catch (e) {
      console.error("Failed to switch tab:", e);
      set({ activeTabPath: path });
    }
  },

  setContent: (content: string) => {
    const { activeTabPath, openTabs, isDirty } = get();

    // Only create a new openTabs array when the dirty flag actually changes.
    // This prevents unnecessary re-renders of EditorArea (and its tabs bar)
    // which can destabilize Crepe's floating menus (slash menu, toolbar).
    if (isDirty) {
      set({ content });
    } else {
      set({
        content,
        isDirty: true,
        openTabs: openTabs.map((t) =>
          t.path === activeTabPath ? { ...t, isDirty: true } : t,
        ),
      });
    }

    // Capture the path this content belongs to, so timers can verify
    // they're still operating on the correct file
    const pathAtCallTime = activeTabPath;

    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      const state = get();
      // Only save if we're still on the same file
      if (
        state.isDirty &&
        state.activeTabPath &&
        state.activeTabPath === pathAtCallTime
      ) {
        state.saveFile();
      }
    }, AUTO_SAVE_DELAY);

    if (titleRenameTimer) clearTimeout(titleRenameTimer);
    titleRenameTimer = setTimeout(() => {
      const state = get();
      // Only rename if we're still on the same file
      if (!state.activeTabPath || state.activeTabPath !== pathAtCallTime)
        return;
      const h1 = extractH1Title(state.content);
      if (h1) {
        handleTitleRename(h1, state.activeTabPath, state);
      }
    }, TITLE_RENAME_DELAY);
  },

  setWordCount: (count: number) => {
    set({ wordCount: count });
  },

  saveFile: async () => {
    const { activeTabPath } = get();
    if (!activeTabPath) return;

    // Always get the freshest content from the live editor
    const content = getFreshContent();

    // Sync store so consumers see the latest
    set({ content });

    try {
      await api.writeFile(activeTabPath, content);
      await api.reindexFile(activeTabPath);

      // Only clear dirty flag if content hasn't changed during the save
      const currentContent = getFreshContent();
      if (currentContent === content) {
        set({
          isDirty: false,
          openTabs: get().openTabs.map((t) =>
            t.path === activeTabPath ? { ...t, isDirty: false } : t,
          ),
        });
      }
      // If content changed during save, isDirty stays true and auto-save
      // will fire again naturally
    } catch (e) {
      console.error("Failed to save file:", e);
    }
  },

  renameActiveTab: (oldPath: string, newPath: string) => {
    const newName = newPath.split("/").pop() || newPath;
    set((state) => ({
      activeTabPath:
        state.activeTabPath === oldPath ? newPath : state.activeTabPath,
      openTabs: state.openTabs.map((t) =>
        t.path === oldPath ? { ...t, path: newPath, name: newName } : t,
      ),
    }));
  },

  toggleEditorMode: () => {
    const { editorMode } = get();
    if (editorMode === "rich") {
      // Grab fresh markdown from Milkdown before switching away
      const freshContent = getFreshContent();
      set({ editorMode: "raw", content: freshContent });
    } else {
      // Switching back to rich — content in store is already up-to-date
      set({ editorMode: "rich" });
    }
  },

  setEditorWidth: (width: EditorWidth) => {
    updateSettings({ editorWidth: width });
    set({ editorWidth: width });
  },

  setFontSize: (size: number) => {
    updateSettings({ fontSize: size });
    set({ fontSize: size });
  },

  setLineNumbers: (on: boolean) => {
    updateSettings({ lineNumbers: on });
    set({ lineNumbers: on });
  },
}));
