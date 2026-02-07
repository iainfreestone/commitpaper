import { create } from "zustand";
import * as api from "../lib/api";
import type { FileStatus, BranchInfo, CommitInfo } from "../lib/api";

interface GitStore {
  status: FileStatus[];
  currentBranch: string;
  branches: BranchInfo[];
  log: CommitInfo[];
  commitMessage: string;
  isLoading: boolean;
  gitWarning: string | null;
  modifiedCount: number;

  refreshStatus: () => Promise<void>;
  refreshBranches: () => Promise<void>;
  refreshLog: () => Promise<void>;
  setCommitMessage: (msg: string) => void;
  dismissWarning: () => void;
}

export const useGitStore = create<GitStore>((set, get) => ({
  status: [],
  currentBranch: "",
  branches: [],
  log: [],
  commitMessage: "",
  isLoading: false,
  gitWarning: null,
  modifiedCount: 0,

  refreshStatus: async () => {
    try {
      const status = await api.gitStatus().catch(() => []);
      const branch = await api.gitCurrentBranch().catch(() => "");
      set({ status, currentBranch: branch, modifiedCount: status.length });
    } catch {
      set({ status: [], currentBranch: "" });
    }
  },

  refreshBranches: async () => {
    try {
      const branches = await api.gitBranches();
      set({ branches });
    } catch {
      set({ branches: [] });
    }
  },

  refreshLog: async () => {
    // Git log not available in browser mode
    set({ log: [] });
  },

  setCommitMessage: (msg: string) => set({ commitMessage: msg }),

  dismissWarning: () => set({ gitWarning: null }),
}));
