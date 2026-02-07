import { create } from "zustand";
import * as api from "../lib/tauri";

interface EditorStore {
  // Currently open tabs
  openTabs: TabInfo[];
  activeTabPath: string | null;

  // Current file content
  content: string;
  isDirty: boolean;
  wordCount: number;

  openFile: (path: string) => Promise<void>;
  closeTab: (path: string, force?: boolean) => void;
  setActiveTab: (path: string) => void;
  setContent: (content: string) => void;
  setWordCount: (count: number) => void;
  saveFile: () => Promise<void>;
}

export interface TabInfo {
  path: string;
  name: string;
  isDirty: boolean;
}

// Auto-save debounce timer
let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
const AUTO_SAVE_DELAY = 2000; // 2 seconds

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
          openTabs: [...openTabs, { path, name, isDirty: false }],
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

    // Warn if tab has unsaved changes (unless force-closing)
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

  setActiveTab: (path: string) => {
    const { activeTabPath, isDirty, content, openTabs } = get();

    // Save current content before switching
    if (activeTabPath && isDirty) {
      api
        .writeFile(activeTabPath, content)
        .then(() => api.reindexFile(activeTabPath))
        .then(() => {
          // Mark the tab as saved
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

    // Auto-save after 2 seconds of inactivity
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      const state = get();
      if (state.isDirty && state.activeTabPath) {
        state.saveFile();
      }
    }, AUTO_SAVE_DELAY);
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
}));
