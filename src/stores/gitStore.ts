import { create } from "zustand";
import * as api from "../lib/api";
import type { FileStatus, BranchInfo, CommitInfo } from "../lib/api";
import { getAuthor, setAuthorConfig } from "../lib/git";

interface GitStore {
  // State
  status: FileStatus[];
  currentBranch: string;
  branches: BranchInfo[];
  log: CommitInfo[];
  commitMessage: string;
  isLoading: boolean;
  gitWarning: string | null;
  gitSuccess: string | null;
  modifiedCount: number;
  authorName: string;
  authorEmail: string;

  // Actions
  refreshStatus: () => Promise<void>;
  refreshBranches: () => Promise<void>;
  refreshLog: () => Promise<void>;
  refreshAll: () => Promise<void>;
  setCommitMessage: (msg: string) => void;
  dismissWarning: () => void;
  dismissSuccess: () => void;

  // Git operations
  stageFile: (path: string) => Promise<void>;
  unstageFile: (path: string) => Promise<void>;
  stageAll: () => Promise<void>;
  commit: () => Promise<void>;
  quickCommit: (message?: string) => Promise<void>;
  quickCommitAndPush: (message?: string) => Promise<void>;
  createBranch: (name: string) => Promise<void>;
  checkoutBranch: (name: string) => Promise<void>;
  initRepo: () => Promise<void>;
  setAuthor: (name: string, email: string) => void;
}

export const useGitStore = create<GitStore>((set, get) => ({
  status: [],
  currentBranch: "",
  branches: [],
  log: [],
  commitMessage: "",
  isLoading: false,
  gitWarning: null,
  gitSuccess: null,
  modifiedCount: 0,
  authorName: getAuthor().name,
  authorEmail: getAuthor().email,

  refreshStatus: async () => {
    try {
      const status = await api.gitStatus();
      const branch = await api.gitCurrentBranch();
      set({
        status,
        currentBranch: branch,
        modifiedCount: status.length,
      });
    } catch (e) {
      console.warn("refreshStatus error:", e);
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
    try {
      const log = await api.gitLog(50);
      set({ log });
    } catch {
      set({ log: [] });
    }
  },

  refreshAll: async () => {
    const { refreshStatus, refreshBranches, refreshLog } = get();
    await Promise.all([refreshStatus(), refreshBranches(), refreshLog()]);
  },

  setCommitMessage: (msg: string) => set({ commitMessage: msg }),

  dismissWarning: () => set({ gitWarning: null }),

  dismissSuccess: () => set({ gitSuccess: null }),

  // ---- Git operations ----

  stageFile: async (path: string) => {
    try {
      await api.gitStageFile(path);
      await get().refreshStatus();
    } catch (e) {
      set({ gitWarning: `Failed to stage ${path}: ${e}` });
    }
  },

  unstageFile: async (path: string) => {
    try {
      await api.gitUnstageFile(path);
      await get().refreshStatus();
    } catch (e) {
      set({ gitWarning: `Failed to unstage ${path}: ${e}` });
    }
  },

  stageAll: async () => {
    try {
      set({ isLoading: true });
      await api.gitStageAll();
      await get().refreshStatus();
    } catch (e) {
      set({ gitWarning: `Failed to stage all: ${e}` });
    } finally {
      set({ isLoading: false });
    }
  },

  commit: async () => {
    const { commitMessage, refreshAll } = get();
    if (!commitMessage.trim()) {
      set({ gitWarning: "Please enter a commit message." });
      return;
    }
    try {
      set({ isLoading: true });
      const sha = await api.gitCommit(commitMessage.trim());
      set({
        commitMessage: "",
        gitSuccess: `Committed: ${sha.substring(0, 7)}`,
        gitWarning: null,
      });
      await refreshAll();
    } catch (e) {
      set({ gitWarning: `Commit failed: ${e}` });
    } finally {
      set({ isLoading: false });
    }
  },

  quickCommit: async (message?: string) => {
    const { refreshAll } = get();
    const now = new Date();
    const autoMsg =
      message?.trim() ||
      `Update ${now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} ${now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
    try {
      set({ isLoading: true, gitWarning: null });
      await api.gitStageAll();
      const sha = await api.gitCommit(autoMsg);
      set({
        commitMessage: "",
        gitSuccess: `Committed: ${sha.substring(0, 7)}`,
      });
      await refreshAll();
    } catch (e) {
      set({ gitWarning: `Commit failed: ${e}` });
    } finally {
      set({ isLoading: false });
    }
  },

  quickCommitAndPush: async (message?: string) => {
    const { quickCommit, refreshAll } = get();
    try {
      set({ isLoading: true, gitWarning: null });
      await quickCommit(message);
      await api.gitPush();
      set({
        gitSuccess:
          get().gitSuccess?.replace("Committed", "Committed & pushed") ||
          "Pushed",
      });
      await refreshAll();
    } catch (e) {
      const errMsg = String(e);
      if (errMsg.includes("No remote URL")) {
        set({
          gitWarning:
            "No remote configured. Add a remote with: git remote add origin <url>",
        });
      } else {
        set({ gitWarning: `Push failed: ${e}` });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  createBranch: async (name: string) => {
    try {
      await api.gitCreateBranch(name);
      await get().refreshBranches();
      set({ gitSuccess: `Branch '${name}' created.` });
    } catch (e) {
      set({ gitWarning: `Failed to create branch: ${e}` });
    }
  },

  checkoutBranch: async (name: string) => {
    try {
      set({ isLoading: true });
      await api.gitCheckoutBranch(name);
      await get().refreshAll();
      set({ gitSuccess: `Switched to branch '${name}'.` });
    } catch (e) {
      set({ gitWarning: `Failed to checkout branch: ${e}` });
    } finally {
      set({ isLoading: false });
    }
  },

  initRepo: async () => {
    try {
      set({ isLoading: true });
      await api.initVaultRepo();
      await get().refreshAll();
      set({ gitSuccess: "Git repository initialized." });
    } catch (e) {
      set({ gitWarning: `Failed to init repo: ${e}` });
    } finally {
      set({ isLoading: false });
    }
  },

  setAuthor: (name: string, email: string) => {
    setAuthorConfig(name, email);
    set({ authorName: name, authorEmail: email });
  },
}));
