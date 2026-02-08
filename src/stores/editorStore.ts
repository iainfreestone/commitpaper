import { create } from "zustand";
import * as api from "../lib/api";

interface EditorStore {
  openTabs: TabInfo[];
  activeTabPath: string | null;
  content: string;
  isDirty: boolean;
  wordCount: number;

  openFile: (path: string) => Promise<void>;
  closeTab: (path: string, force?: boolean) => void;
  closeAllTabs: () => void;
  setActiveTab: (path: string) => void;
  setContent: (content: string) => void;
  setWordCount: (count: number) => void;
  saveFile: () => Promise<void>;
  renameActiveTab: (oldPath: string, newPath: string) => void;
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

/** Extract the text of the first H1 heading from markdown content */
function extractH1Title(content: string): string | null {
  // Match the first line that starts with exactly one # followed by a space
  const match = content.match(/^#\s+(.+)$/m);
  if (!match) return null;
  const title = match[1].trim();
  return title || null;
}

/** Sanitize a title string into a valid filename (no path separators, etc.) */
function sanitizeFilename(title: string): string {
  return title
    .replace(/[\\/:*?"<>|]/g, "") // remove invalid filename chars
    .replace(/\s+/g, " ") // collapse whitespace
    .trim();
}

/** Whether a rename from H1 should be attempted for this path */
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
  if (sanitized.toLowerCase() === currentName.toLowerCase()) return; // already matches

  // Build new path preserving directory
  const dir = currentPath.includes("/")
    ? currentPath.substring(0, currentPath.lastIndexOf("/") + 1)
    : "";
  let newPath = `${dir}${sanitized}.md`;

  // Check for conflicts and add number suffix if needed
  if (await api.fileExists(newPath)) {
    let i = 1;
    while (await api.fileExists(`${dir}${sanitized} ${i}.md`)) {
      i++;
    }
    newPath = `${dir}${sanitized} ${i}.md`;
  }

  try {
    isRenaming = true;
    // Save current content to old path first
    const content = store.content;
    await api.writeFile(currentPath, content);
    // Rename file on disk
    await api.renameFile(currentPath, newPath);
    // Update tab state without remounting the editor
    store.renameActiveTab(currentPath, newPath);
    // Refresh sidebar
    const vaultStore = (await import("./vaultStore")).useVaultStore.getState();
    vaultStore.refreshFileTree();
  } catch (e) {
    console.error("Failed to rename file from title:", e);
  } finally {
    isRenaming = false;
  }
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  openTabs: [],
  activeTabPath: null,
  content: "",
  isDirty: false,
  wordCount: 0,

  openFile: async (path: string) => {
    try {
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

    let newActive = activeTabPath;
    if (activeTabPath === path) {
      const idx = openTabs.findIndex((t) => t.path === path);
      newActive = newTabs[Math.min(idx, newTabs.length - 1)]?.path || null;
    }

    if (newActive && newActive !== path) {
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
        activeTabPath: newActive,
        content: "",
        isDirty: false,
      });
    }
  },

  closeAllTabs: () => {
    set({
      openTabs: [],
      activeTabPath: null,
      content: "",
      isDirty: false,
      wordCount: 0,
    });
  },

  setActiveTab: (path: string) => {
    const { activeTabPath, isDirty, content, openTabs } = get();

    if (activeTabPath && isDirty) {
      api
        .writeFile(activeTabPath, content)
        .then(() => api.reindexFile(activeTabPath))
        .then(() => {
          set({
            openTabs: get().openTabs.map((t) =>
              t.path === activeTabPath ? { ...t, isDirty: false } : t,
            ),
          });
        })
        .catch(console.error);
    }

    api.readFile(path).then((content) => {
      set({ activeTabPath: path, content, isDirty: false });
    });
  },

  setContent: (content: string) => {
    const { activeTabPath, openTabs } = get();
    set({
      content,
      isDirty: true,
      openTabs: openTabs.map((t) =>
        t.path === activeTabPath ? { ...t, isDirty: true } : t,
      ),
    });

    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      const state = get();
      if (state.isDirty && state.activeTabPath) {
        state.saveFile();
      }
    }, AUTO_SAVE_DELAY);

    // Debounced title-based rename
    if (titleRenameTimer) clearTimeout(titleRenameTimer);
    titleRenameTimer = setTimeout(() => {
      const state = get();
      if (!state.activeTabPath) return;
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
    const { activeTabPath, content, openTabs } = get();
    if (!activeTabPath) return;

    try {
      await api.writeFile(activeTabPath, content);
      await api.reindexFile(activeTabPath);
      set({
        isDirty: false,
        openTabs: openTabs.map((t) =>
          t.path === activeTabPath ? { ...t, isDirty: false } : t,
        ),
      });
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
}));
