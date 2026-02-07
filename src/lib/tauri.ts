import { invoke } from "@tauri-apps/api/core";

// ============================================================
// Types matching the Rust models
// ============================================================

export interface VaultConfig {
  path: string;
  name: string;
  is_git_repo: boolean;
}

export interface FileTreeNode {
  type: "file" | "folder";
  name: string;
  path: string;
  extension?: string;
  children?: FileTreeNode[];
}

export interface FileStatus {
  path: string;
  status:
    | "Modified"
    | "Added"
    | "Deleted"
    | "Renamed"
    | "Untracked"
    | "Conflicted";
  staged: boolean;
}

export interface BranchInfo {
  name: string;
  is_head: boolean;
  upstream: string | null;
  ahead: number;
  behind: number;
}

export interface CommitInfo {
  id: string;
  short_id: string;
  message: string;
  author: string;
  email: string;
  timestamp: number;
}

export interface FileDiff {
  path: string;
  hunks: DiffHunk[];
}

export interface DiffHunk {
  old_start: number;
  old_lines: number;
  new_start: number;
  new_lines: number;
  lines: DiffLine[];
}

export interface DiffLine {
  content: string;
  origin: string;
}

export interface ConflictFile {
  path: string;
  ours: string | null;
  theirs: string | null;
  ancestor: string | null;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphNode {
  id: string;
  label: string;
  path: string;
  backlink_count: number;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface SearchResult {
  path: string;
  title: string;
  snippet: string;
  score: number;
}

// ============================================================
// Vault commands
// ============================================================

export const openVault = (path: string) =>
  invoke<VaultConfig>("open_vault", { path });

export const initVaultRepo = () => invoke<void>("init_vault_repo");

export const getBacklinks = (path: string) =>
  invoke<string[]>("get_backlinks", { path });

export const getNoteNames = () => invoke<string[]>("get_note_names");

export const resolveWikilink = (name: string) =>
  invoke<string | null>("resolve_wikilink", { name });

export const getGraphData = () => invoke<GraphData>("get_graph_data");

export const getLocalGraph = (path: string, depth?: number) =>
  invoke<GraphData>("get_local_graph", { path, depth });

export const reindexFile = (path: string) =>
  invoke<void>("reindex_file", { path });

// ============================================================
// File commands
// ============================================================

export const readFile = (path: string) => invoke<string>("read_file", { path });

export const writeFile = (path: string, content: string) =>
  invoke<void>("write_file", { path, content });

export const createNote = (path: string) =>
  invoke<void>("create_note", { path });

export const deleteFile = (path: string) =>
  invoke<void>("delete_file", { path });

export const renameFile = (oldPath: string, newPath: string) =>
  invoke<void>("rename_file", { oldPath, newPath });

export const createFolder = (path: string) =>
  invoke<void>("create_folder", { path });

export const getFileTree = () => invoke<FileTreeNode[]>("get_file_tree");

export const saveBinaryFile = (path: string, data: number[]) =>
  invoke<string>("save_binary_file", { path, data });

// ============================================================
// Git commands
// ============================================================

export const gitStatus = () => invoke<FileStatus[]>("git_status");

export const gitStageFile = (path: string) =>
  invoke<void>("git_stage_file", { path });

export const gitUnstageFile = (path: string) =>
  invoke<void>("git_unstage_file", { path });

export const gitStageAll = () => invoke<void>("git_stage_all");

export const gitCommit = (message: string) =>
  invoke<string>("git_commit", { message });

export const gitCurrentBranch = () => invoke<string>("git_current_branch");

export const gitBranches = () => invoke<BranchInfo[]>("git_branches");

export const gitCreateBranch = (name: string) =>
  invoke<void>("git_create_branch", { name });

export const gitCheckoutBranch = (name: string) =>
  invoke<void>("git_checkout_branch", { name });

export const gitLog = (maxCount?: number) =>
  invoke<CommitInfo[]>("git_log", { maxCount });

export const gitFileLog = (filePath: string, maxCount?: number) =>
  invoke<CommitInfo[]>("git_file_log", { filePath, maxCount });

export const gitFileAtCommit = (commitId: string, filePath: string) =>
  invoke<string>("git_file_at_commit", { commitId, filePath });

export const gitDiff = () => invoke<FileDiff[]>("git_diff");

export const gitPull = () => invoke<string>("git_pull");

export const gitPush = () => invoke<void>("git_push");

export const gitConflicts = () => invoke<ConflictFile[]>("git_conflicts");

// ============================================================
// Search commands
// ============================================================

export const searchNotes = (query: string) =>
  invoke<SearchResult[]>("search_notes", { query });
