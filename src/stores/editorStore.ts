import { create } from "zustand";
import * as api from "../lib/api";
import { getSettings, updateSettings } from "../lib/settings";
import type { VaultSettings } from "../lib/settings";
import {
  trackNoteOpened,
  trackEditorModeToggled,
  trackEditorWidthChanged,
  trackFontSizeChanged,
  trackLineNumbersToggled,
} from "../lib/analytics";

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
  restoreTabs: (settings: VaultSettings) => Promise<void>;
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
let persistTabsTimer: ReturnType<typeof setTimeout> | null = null;
const AUTO_SAVE_DELAY = 3000;
const TITLE_RENAME_DELAY = 5000;
let nextTabId = 1;

/**
 * Debounced persist of current tab state to .commitpaper/settings.json.
 * Avoids hammering the file system on rapid tab operations.
 */
function persistTabs() {
  if (persistTabsTimer) clearTimeout(persistTabsTimer);
  persistTabsTimer = setTimeout(() => {
    const { openTabs, activeTabPath } = useEditorStore.getState();
    updateSettings({
      openTabs: openTabs.map((t) => t.path),
      activeTab: activeTabPath,
    });
  }, 500);
}

// ─── Write serialization ───────────────────────────────────────
// All file writes (save, rename) must go through this chain to prevent
// concurrent File System Access API writes from clobbering each other.
let writeChain: Promise<void> = Promise.resolve();

/**
 * Content snapshot from the last successful save.
 * Used to skip redundant writes and to detect whether the user
 * has edited since the last save completed.
 */
let lastSavedContent: string = "";

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

  // Serialized through the write chain so renames never overlap with saves
  await enqueueWrite(async () => {
    if (isRenaming) return;

    // Re-verify we're still on the same file (may have changed while queued)
    const state = useEditorStore.getState();
    if (state.activeTabPath !== currentPath) return;

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
      // Use fresh content from the live editor
      const content = getFreshContent();
      await api.writeFile(currentPath, content);
      lastSavedContent = content;
      await api.renameFile(currentPath, newPath);
      store.renameActiveTab(currentPath, newPath);
      const vaultStore = (
        await import("./vaultStore")
      ).useVaultStore.getState();
      vaultStore.refreshFileTree();
    } catch (e) {
      console.error("Failed to rename file from title:", e);
    } finally {
      isRenaming = false;
    }
  });
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

/**
 * Enqueue a write operation on the serialized write chain.
 * Guarantees that only one file-system write runs at a time.
 */
function enqueueWrite(fn: () => Promise<void>): Promise<void> {
  const link = writeChain.then(fn).catch((e) => {
    console.error("Serialized write failed:", e);
  });
  writeChain = link;
  return link;
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
      trackNoteOpened();

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
      lastSavedContent = content; // Track what's on disk for dedup
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
      persistTabs();
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
          persistTabs();
        });
      } else {
        set({
          openTabs: newTabs,
          activeTabPath: null,
          content: "",
          isDirty: false,
        });
        persistTabs();
      }
    } else {
      // Closing a background tab — don't touch the active tab's content
      set({ openTabs: newTabs });
      persistTabs();
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
    persistTabs();
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
      lastSavedContent = content; // Track what's on disk for dedup
      set({ activeTabPath: path, content, isDirty: false });
      persistTabs();
    } catch (e) {
      console.error("Failed to switch tab:", e);
      set({ activeTabPath: path });
      persistTabs();
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
      // Use fresh content for H1 extraction instead of potentially stale store
      const freshContent = getFreshContent();
      const h1 = extractH1Title(freshContent);
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

    // Capture content and path NOW, before entering the serialized write
    // queue. This ensures we save the correct snapshot even if the user
    // switches tabs before the queued write executes.
    const contentToSave = getFreshContent();
    const pathToSave = activeTabPath;

    await enqueueWrite(async () => {
      // Skip if content is identical to what's already on disk
      if (contentToSave === lastSavedContent) {
        const s = get();
        if (s.activeTabPath === pathToSave) {
          set({
            isDirty: false,
            openTabs: s.openTabs.map((t) =>
              t.path === pathToSave ? { ...t, isDirty: false } : t,
            ),
          });
        }
        return;
      }

      try {
        await api.writeFile(pathToSave, contentToSave);
        await api.reindexFile(pathToSave);
        lastSavedContent = contentToSave;

        // Only clear dirty flag if we're still on the same file
        // AND content hasn't changed since we captured it
        const s = get();
        if (s.activeTabPath === pathToSave) {
          const currentContent = getFreshContent();
          if (currentContent === contentToSave) {
            set({
              isDirty: false,
              openTabs: s.openTabs.map((t) =>
                t.path === pathToSave ? { ...t, isDirty: false } : t,
              ),
            });
          }
          // else: user typed during save, isDirty stays true,
          // auto-save will fire again naturally
        }
      } catch (e) {
        console.error("Failed to save file:", e);
      }
    });
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
    persistTabs();
  },

  restoreTabs: async (settings: VaultSettings) => {
    const paths = settings.openTabs ?? [];
    if (paths.length === 0) return;

    // Verify which files still exist and build tab entries
    const tabs: TabInfo[] = [];
    for (const p of paths) {
      try {
        await api.readFile(p); // will throw if file was deleted
        tabs.push({
          id: nextTabId++,
          path: p,
          name: p.split("/").pop() || p,
          isDirty: false,
        });
      } catch {
        // File no longer exists — skip it
      }
    }

    if (tabs.length === 0) return;

    // Pick the active tab: prefer the saved one if it's still open
    const activeTab =
      (settings.activeTab && tabs.find((t) => t.path === settings.activeTab)
        ? settings.activeTab
        : tabs[tabs.length - 1]?.path) ?? null;

    let content = "";
    if (activeTab) {
      try {
        content = await api.readFile(activeTab);
        lastSavedContent = content;
      } catch {
        // Shouldn't happen since we verified above
      }
    }

    set({
      openTabs: tabs,
      activeTabPath: activeTab,
      content,
      isDirty: false,
    });
  },

  toggleEditorMode: () => {
    const { editorMode } = get();
    if (editorMode === "rich") {
      // Grab fresh markdown from Milkdown before switching away
      const freshContent = getFreshContent();
      set({ editorMode: "raw", content: freshContent });
      trackEditorModeToggled("raw");
    } else {
      // Switching back to rich — content in store is already up-to-date
      set({ editorMode: "rich" });
      trackEditorModeToggled("rich");
    }
  },

  setEditorWidth: (width: EditorWidth) => {
    updateSettings({ editorWidth: width });
    set({ editorWidth: width });
    trackEditorWidthChanged(width);
  },

  setFontSize: (size: number) => {
    updateSettings({ fontSize: size });
    set({ fontSize: size });
    trackFontSizeChanged(size);
  },

  setLineNumbers: (on: boolean) => {
    updateSettings({ lineNumbers: on });
    set({ lineNumbers: on });
    trackLineNumbersToggled(on);
  },
}));
