import { create } from "zustand";
import * as api from "../lib/api";
import type { VaultConfig, FileTreeNode } from "../lib/api";
import {
  loadSettings,
  saveSettings,
  clearLegacyLocalStorage,
} from "../lib/settings";
import { useEditorStore } from "./editorStore";

interface VaultStore {
  vault: VaultConfig | null;
  fileTree: FileTreeNode[];
  isLoading: boolean;
  error: string | null;

  openVault: (path: string) => Promise<void>;
  closeVault: () => void;
  refreshFileTree: () => Promise<void>;
}

export const useVaultStore = create<VaultStore>((set, get) => ({
  vault: null,
  fileTree: [],
  isLoading: false,
  error: null,

  openVault: async (path: string) => {
    set({ isLoading: true, error: null });
    try {
      const vault = await api.openVault(path);
      const fileTree = await api.getFileTree();

      // Load vault settings from .commitpaper/settings.json
      const settings = await loadSettings();

      // If we migrated from localStorage, persist and clean up
      await saveSettings();
      clearLegacyLocalStorage();

      set({ vault, fileTree, isLoading: false });

      // Dispatch event so other stores can apply loaded settings
      window.dispatchEvent(
        new CustomEvent("vault-settings-loaded", { detail: settings }),
      );

      // Restore previously open tabs
      await useEditorStore.getState().restoreTabs(settings);
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
  },

  closeVault: () => {
    api.stopFileWatching();
    set({ vault: null, fileTree: [], error: null });
  },

  refreshFileTree: async () => {
    try {
      const fileTree = await api.getFileTree();
      set({ fileTree });
    } catch (e) {
      console.error("Failed to refresh file tree:", e);
    }
  },
}));
