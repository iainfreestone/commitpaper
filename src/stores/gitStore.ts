import { create } from "zustand";
import * as api from "../lib/tauri";
import type { FileStatus, BranchInfo, CommitInfo } from "../lib/tauri";

interface GitStore {
  status: FileStatus[];
  currentBranch: string;
  branches: BranchInfo[];
  log: CommitInfo[];
  commitMessage: string;
  isLoading: boolean;

  refreshStatus: () => Promise<void>;
  refreshBranches: () => Promise<void>;
  refreshLog: () => Promise<void>;
  stageFile: (path: string) => Promise<void>;
  unstageFile: (path: string) => Promise<void>;
  stageAll: () => Promise<void>;
  commit: () => Promise<void>;
  pull: () => Promise<string>;
  push: () => Promise<void>;
  checkoutBranch: (name: string) => Promise<void>;
  createBranch: (name: string) => Promise<void>;
  setCommitMessage: (msg: string) => void;
}

export const useGitStore = create<GitStore>((set, get) => ({
  status: [],
  currentBranch: "",
  branches: [],
  log: [],
  commitMessage: "",
  isLoading: false,

  refreshStatus: async () => {
    try {
      // Fetch independently — if one fails, the other still works
      const status = await api.gitStatus().catch(() => []);
      const branch = await api.gitCurrentBranch().catch(() => "");
      set({ status, currentBranch: branch });
    } catch (e) {
      // Not a git repo
      set({ status: [], currentBranch: "" });
    }
  },

  refreshBranches: async () => {
    try {
      const branches = await api.gitBranches();
      set({ branches });
    } catch (e) {
      set({ branches: [] });
    }
  },

  refreshLog: async () => {
    try {
      const log = await api.gitLog(50);
      set({ log });
    } catch (e) {
      set({ log: [] });
    }
  },

  stageFile: async (path: string) => {
    await api.gitStageFile(path);
    get().refreshStatus();
  },

  unstageFile: async (path: string) => {
    await api.gitUnstageFile(path);
    get().refreshStatus();
  },

  stageAll: async () => {
    await api.gitStageAll();
    get().refreshStatus();
  },

  commit: async () => {
    const { commitMessage } = get();
    if (!commitMessage.trim()) return;
    await api.gitCommit(commitMessage);
    set({ commitMessage: "" });
    get().refreshStatus();
    get().refreshLog();
  },

  pull: async () => {
    set({ isLoading: true });
    try {
      const result = await api.gitPull();
      get().refreshStatus();
      get().refreshLog();
      return result;
    } finally {
      set({ isLoading: false });
    }
  },

  push: async () => {
    set({ isLoading: true });
    try {
      await api.gitPush();
      get().refreshBranches();
    } finally {
      set({ isLoading: false });
    }
  },

  checkoutBranch: async (name: string) => {
    await api.gitCheckoutBranch(name);
    get().refreshStatus();
    get().refreshBranches();
    get().refreshLog();
  },

  createBranch: async (name: string) => {
    await api.gitCreateBranch(name);
    get().refreshBranches();
  },

  setCommitMessage: (msg: string) => set({ commitMessage: msg }),
}));
