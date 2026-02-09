// ============================================================
// Git operations powered by isomorphic-git
// Real Git in the browser via File System Access API
// ============================================================

import git from "isomorphic-git";
import http from "isomorphic-git/http/web";
import { createFSAdapter } from "./fs-adapter";
import type { IsomorphicGitFS } from "./fs-adapter";
import type {
  FileStatus,
  BranchInfo,
  CommitInfo,
  FileDiff,
  DiffHunk,
  DiffLine,
} from "./api";

let fs: IsomorphicGitFS | null = null;
let dir = "/"; // isomorphic-git needs a "dir" string

// The user's configured author info (persisted in localStorage)
interface GitAuthorConfig {
  name: string;
  email: string;
}

function getAuthorConfig(): GitAuthorConfig {
  try {
    const stored = localStorage.getItem("commitpaper-git-author");
    if (stored) return JSON.parse(stored);
  } catch {
    // ignore
  }
  return { name: "CommitPaper User", email: "user@commitpaper.local" };
}

export function setAuthorConfig(name: string, email: string): void {
  localStorage.setItem(
    "commitpaper-git-author",
    JSON.stringify({ name, email }),
  );
}

export function getAuthor(): GitAuthorConfig {
  return getAuthorConfig();
}

/**
 * Initialize the git module with the vault's root directory handle.
 * Must be called after a vault is opened.
 */
export function initGitFS(rootHandle: FileSystemDirectoryHandle): void {
  fs = createFSAdapter(rootHandle);
}

export function isGitFSReady(): boolean {
  return fs !== null;
}

function ensureFS(): IsomorphicGitFS {
  if (!fs) throw new Error("Git FS not initialized. Open a vault first.");
  return fs;
}

// ============================================================
// Status
// ============================================================

type StatusRow = [string, 0 | 1, 0 | 1 | 2, 0 | 1 | 2 | 3];

/**
 * Get the full status of the working directory.
 * Returns FileStatus[] compatible with the existing app interface.
 */
export async function gitStatus(): Promise<FileStatus[]> {
  const _fs = ensureFS();

  let matrix: StatusRow[];
  try {
    matrix = await git.statusMatrix({
      fs: _fs,
      dir,
    });
  } catch (e) {
    console.error("statusMatrix failed:", e);
    throw e;
  }

  const results: FileStatus[] = [];

  for (const [filepath, head, workdir, stage] of matrix) {
    // Skip .git internals (shouldn't appear, but just in case)
    if (filepath.startsWith(".git/")) continue;

    // Status matrix meanings:
    // [HEAD, WORKDIR, STAGE]
    // [0, 2, 0] = new, untracked file (not staged)
    // [0, 2, 2] = new file, staged (added)
    // [0, 2, 3] = new file, staged then modified
    // [1, 1, 1] = unmodified
    // [1, 2, 1] = modified, unstaged
    // [1, 2, 2] = modified, staged
    // [1, 2, 3] = modified, staged then modified again
    // [1, 0, 0] = deleted, unstaged
    // [1, 0, 1] = deleted, staged
    // [1, 1, 0] = deleted from index but still in workdir?? (unusual)

    let status: FileStatus["status"];
    let staged = false;

    if (head === 0 && workdir === 2 && stage === 0) {
      status = "Untracked";
      staged = false;
    } else if (head === 0 && workdir === 2 && stage === 2) {
      status = "Added";
      staged = true;
    } else if (head === 0 && workdir === 2 && stage === 3) {
      status = "Added";
      staged = true; // staged but also modified since staging
    } else if (head === 1 && workdir === 1 && stage === 1) {
      // Unmodified — skip
      continue;
    } else if (head === 1 && workdir === 2 && stage === 1) {
      status = "Modified";
      staged = false;
    } else if (head === 1 && workdir === 2 && stage === 2) {
      status = "Modified";
      staged = true;
    } else if (head === 1 && workdir === 2 && stage === 3) {
      status = "Modified";
      staged = true; // staged but modified again
    } else if (head === 1 && workdir === 0 && stage === 0) {
      status = "Deleted";
      staged = false;
    } else if (head === 1 && workdir === 0 && stage === 1) {
      status = "Deleted";
      staged = true;
    } else if (head === 1 && workdir === 0) {
      status = "Deleted";
      staged = stage !== 1;
    } else {
      // Fallback
      status = "Modified";
      staged = stage !== 1 && stage !== 0;
    }

    results.push({ path: filepath, status, staged });
  }

  return results;
}

// ============================================================
// Staging
// ============================================================

export async function gitStageFile(filepath: string): Promise<void> {
  const _fs = ensureFS();

  // Check if the file was deleted
  try {
    await _fs.promises.stat(filepath);
    // File exists — add it
    await git.add({ fs: _fs, dir, filepath });
  } catch {
    // File doesn't exist — it was deleted, stage the removal
    await git.remove({ fs: _fs, dir, filepath });
  }
}

export async function gitUnstageFile(filepath: string): Promise<void> {
  const _fs = ensureFS();

  // To unstage, we reset the index entry to match HEAD
  // isomorphic-git doesn't have a direct "unstage" — we use resetIndex
  try {
    await git.resetIndex({ fs: _fs, dir, filepath });
  } catch {
    // If file isn't in HEAD (new file), remove from index
    await git.remove({ fs: _fs, dir, filepath });
  }
}

export async function gitStageAll(): Promise<void> {
  const _fs = ensureFS();

  const matrix: StatusRow[] = await git.statusMatrix({ fs: _fs, dir });

  for (const [filepath, head, workdir, stage] of matrix) {
    if (filepath.startsWith(".git/")) continue;

    // Skip unmodified
    if (head === 1 && workdir === 1 && stage === 1) continue;

    if (workdir === 0) {
      // File deleted from working directory
      await git.remove({ fs: _fs, dir, filepath });
    } else {
      await git.add({ fs: _fs, dir, filepath });
    }
  }
}

// ============================================================
// Commit
// ============================================================

export async function gitCommit(message: string): Promise<string> {
  const _fs = ensureFS();
  const author = getAuthorConfig();

  const sha = await git.commit({
    fs: _fs,
    dir,
    message,
    author: {
      name: author.name,
      email: author.email,
    },
  });

  return sha;
}

// ============================================================
// Branch operations
// ============================================================

export async function gitCurrentBranch(): Promise<string> {
  const _fs = ensureFS();
  try {
    const branch = await git.currentBranch({ fs: _fs, dir });
    return branch || "HEAD";
  } catch {
    return "";
  }
}

export async function gitBranches(): Promise<BranchInfo[]> {
  const _fs = ensureFS();
  try {
    const branches = await git.listBranches({ fs: _fs, dir });
    const current = await gitCurrentBranch();

    return branches.map((name) => ({
      name,
      is_head: name === current,
      upstream: null,
      ahead: 0,
      behind: 0,
    }));
  } catch {
    return [];
  }
}

export async function gitCreateBranch(name: string): Promise<void> {
  const _fs = ensureFS();
  await git.branch({ fs: _fs, dir, ref: name });
}

export async function gitCheckoutBranch(name: string): Promise<void> {
  const _fs = ensureFS();
  await git.checkout({ fs: _fs, dir, ref: name });
}

// ============================================================
// Push
// ============================================================

export async function gitPush(
  remote = "origin",
  options?: {
    url?: string;
    onAuth?: () => { username: string; password: string };
  },
): Promise<void> {
  const _fs = ensureFS();

  // Determine remote URL
  let url = options?.url;
  if (!url) {
    // Try to read from git config
    try {
      const config = await git.getConfig({ fs: _fs, dir, path: `remote.${remote}.url` });
      if (config) url = config;
    } catch {
      // ignore
    }
  }

  if (!url) {
    throw new Error(
      `No remote URL configured for '${remote}'. Add a remote first:\n` +
      `git remote add origin <url>`,
    );
  }

  const branch = await gitCurrentBranch();

  await git.push({
    fs: _fs,
    http,
    dir,
    remote,
    ref: branch,
    url,
    onAuth: options?.onAuth,
  });
}

// ============================================================
// Log
// ============================================================

export async function gitLog(maxCount = 50): Promise<CommitInfo[]> {
  const _fs = ensureFS();
  try {
    const commits = await git.log({ fs: _fs, dir, depth: maxCount });

    return commits.map((entry) => ({
      id: entry.oid,
      short_id: entry.oid.substring(0, 7),
      message: entry.commit.message.trim(),
      author: entry.commit.author.name,
      email: entry.commit.author.email,
      timestamp: entry.commit.author.timestamp,
    }));
  } catch {
    return [];
  }
}

export async function gitFileLog(
  filepath: string,
  maxCount = 50,
): Promise<CommitInfo[]> {
  const _fs = ensureFS();
  try {
    const commits = await git.log({ fs: _fs, dir, depth: maxCount });
    const fileCommits: CommitInfo[] = [];

    // Walk through commits and check if the file changed
    let prevOid: string | null = null;
    for (const entry of commits) {
      try {
        let currentOid: string | null = null;
        try {
          const result = await git.readBlob({
            fs: _fs,
            dir,
            oid: entry.oid,
            filepath,
          });
          currentOid = result.oid;
        } catch {
          // File doesn't exist in this commit
          currentOid = null;
        }

        if (currentOid !== prevOid) {
          fileCommits.push({
            id: entry.oid,
            short_id: entry.oid.substring(0, 7),
            message: entry.commit.message.trim(),
            author: entry.commit.author.name,
            email: entry.commit.author.email,
            timestamp: entry.commit.author.timestamp,
          });
        }
        prevOid = currentOid;
      } catch {
        // Skip problematic commits
      }

      if (fileCommits.length >= maxCount) break;
    }

    return fileCommits;
  } catch {
    return [];
  }
}

export async function gitFileAtCommit(
  commitId: string,
  filepath: string,
): Promise<string> {
  const _fs = ensureFS();
  const result = await git.readBlob({
    fs: _fs,
    dir,
    oid: commitId,
    filepath,
  });
  return new TextDecoder().decode(result.blob);
}

// ============================================================
// Diff (working directory vs HEAD)
// ============================================================

export async function gitDiff(): Promise<FileDiff[]> {
  const _fs = ensureFS();
  const diffs: FileDiff[] = [];

  const matrix: StatusRow[] = await git.statusMatrix({ fs: _fs, dir });

  for (const [filepath, head, workdir, _stage] of matrix) {
    if (filepath.startsWith(".git/")) continue;
    if (head === 1 && workdir === 1) continue; // unmodified

    try {
      let oldContent = "";
      let newContent = "";

      // Get HEAD version
      if (head === 1) {
        try {
          const headCommit = await git.resolveRef({ fs: _fs, dir, ref: "HEAD" });
          const blob = await git.readBlob({
            fs: _fs,
            dir,
            oid: headCommit,
            filepath,
          });
          oldContent = new TextDecoder().decode(blob.blob);
        } catch {
          oldContent = "";
        }
      }

      // Get working directory version
      if (workdir !== 0) {
        try {
          const data = await _fs.promises.readFile(filepath, {
            encoding: "utf8",
          });
          newContent = typeof data === "string" ? data : new TextDecoder().decode(data);
        } catch {
          newContent = "";
        }
      }

      // Generate simple diff
      const hunks = generateSimpleDiff(oldContent, newContent);
      if (hunks.length > 0) {
        diffs.push({ path: filepath, hunks });
      }
    } catch {
      // Skip files we can't diff
    }
  }

  return diffs;
}

/**
 * Generate a simple line-by-line diff between two strings.
 * Produces DiffHunk[] compatible with the existing API.
 */
function generateSimpleDiff(oldText: string, newText: string): DiffHunk[] {
  const oldLines = oldText.split("\n");
  const newLines = newText.split("\n");

  // Simple diff: find changed regions
  const hunks: DiffHunk[] = [];
  let i = 0;
  let j = 0;

  while (i < oldLines.length || j < newLines.length) {
    // Skip matching lines
    if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
      i++;
      j++;
      continue;
    }

    // Found a difference — collect the hunk
    const hunkOldStart = i + 1;
    const hunkNewStart = j + 1;
    const lines: DiffLine[] = [];

    // Add context (up to 3 lines before)
    const contextStart = Math.max(0, i - 3);
    for (let c = contextStart; c < i; c++) {
      lines.push({ content: oldLines[c], origin: " " });
    }

    // Collect differing lines
    // Simple approach: consume lines until we find a match again
    const oldDiffStart = i;
    const newDiffStart = j;

    // Look ahead to find next matching point
    let matchFound = false;
    let oldEnd = i;
    let newEnd = j;

    for (let look = 0; look < 50 && !matchFound; look++) {
      // Try matching from various offsets
      if (oldEnd < oldLines.length && newEnd < newLines.length) {
        if (oldLines[oldEnd] === newLines[newEnd]) {
          matchFound = true;
          break;
        }
      }
      // Advance both pointers
      if (oldEnd < oldLines.length) oldEnd++;
      if (newEnd < newLines.length) newEnd++;
    }

    // Emit removed lines
    for (let r = oldDiffStart; r < oldEnd; r++) {
      lines.push({ content: oldLines[r], origin: "-" });
    }
    // Emit added lines
    for (let a = newDiffStart; a < newEnd; a++) {
      lines.push({ content: newLines[a], origin: "+" });
    }

    if (lines.length > 0) {
      hunks.push({
        old_start: hunkOldStart,
        old_lines: oldEnd - oldDiffStart,
        new_start: hunkNewStart,
        new_lines: newEnd - newDiffStart,
        lines,
      });
    }

    i = oldEnd;
    j = newEnd;
  }

  return hunks;
}

// ============================================================
// Init
// ============================================================

export async function initVaultRepo(): Promise<void> {
  const _fs = ensureFS();
  await git.init({ fs: _fs, dir });
}

// ============================================================
// Check if .git exists
// ============================================================

export async function isGitRepo(): Promise<boolean> {
  const _fs = ensureFS();
  try {
    const entries = await _fs.promises.readdir(".");
    return entries.includes(".git");
  } catch {
    return false;
  }
}
