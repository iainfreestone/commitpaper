import { create } from "zustand";
import * as api from "../lib/api";
import type { VaultConfig, FileTreeNode } from "../lib/api";

interface VaultStore {
  vault: VaultConfig | null;
  fileTree: FileTreeNode[];
  isLoading: boolean;
  error: string | null;

  openVault: (path: string) => Promise<void>;
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
      set({ vault, fileTree, isLoading: false });
    } catch (e) {
      set({ error: String(e), isLoading: false });
    }
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
