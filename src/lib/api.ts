// ============================================================
// File System Access API adapter
// Browser-native file operations for CommitPaper
// ============================================================

import { buildSearchIndex, searchIndex, addToIndex } from "./search";
import * as gitOps from "./git";

// ============================================================
// Types
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
// Internal state
// ============================================================

let rootHandle: FileSystemDirectoryHandle | null = null;
let vaultConfig: VaultConfig | null = null;

// ============================================================
// IndexedDB persistence for vault handles
// ============================================================

const DB_NAME = "commitpaper";
const DB_VERSION = 1;
const STORE_NAME = "vault-handles";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Persist the last-opened directory handle so we can restore it on next visit */
export async function persistVaultHandle(
  handle: FileSystemDirectoryHandle,
): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(handle, "last-vault");
    // Also maintain a recent list (up to 5)
    const getReq = tx.objectStore(STORE_NAME).get("recent-vaults");
    getReq.onsuccess = () => {
      const recent: { name: string; handle: FileSystemDirectoryHandle }[] =
        getReq.result || [];
      // Remove if already in list
      const filtered = recent.filter((r) => r.name !== handle.name);
      filtered.unshift({ name: handle.name, handle });
      // Keep max 5
      const trimmed = filtered.slice(0, 5);
      tx.objectStore(STORE_NAME).put(trimmed, "recent-vaults");
    };
    db.close();
  } catch (e) {
    console.warn("Failed to persist vault handle:", e);
  }
}

/** Try to restore the last-opened directory handle */
export async function restoreVaultHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get("last-vault");
      req.onsuccess = () => {
        db.close();
        resolve(req.result || null);
      };
      req.onerror = () => {
        db.close();
        resolve(null);
      };
    });
  } catch {
    return null;
  }
}

/** Get the list of recently opened vault handles */
export async function getRecentVaults(): Promise<
  { name: string; handle: FileSystemDirectoryHandle }[]
> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get("recent-vaults");
      req.onsuccess = () => {
        db.close();
        resolve(req.result || []);
      };
      req.onerror = () => {
        db.close();
        resolve([]);
      };
    });
  } catch {
    return [];
  }
}

/** Verify we still have permission (or re-request it) */
export async function verifyPermission(
  handle: FileSystemDirectoryHandle,
): Promise<boolean> {
  try {
    if ((await handle.queryPermission({ mode: "readwrite" })) === "granted") {
      return true;
    }
    if ((await handle.requestPermission({ mode: "readwrite" })) === "granted") {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// In-memory note index for links, backlinks, graph
interface NoteEntry {
  path: string;
  name: string; // filename without .md
  content: string;
  links: string[]; // target paths (from standard markdown links)
}

let noteIndex: Map<string, NoteEntry> = new Map();
// Track files we've modified (for git status indicator)
let modifiedFiles: Set<string> = new Set();

// ============================================================
// Helpers
// ============================================================

export function getRootHandle(): FileSystemDirectoryHandle | null {
  return rootHandle;
}

async function getFileHandle(
  path: string,
  create = false,
): Promise<FileSystemFileHandle> {
  if (!rootHandle) throw new Error("No vault open");
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  let dir = rootHandle;
  for (let i = 0; i < parts.length - 1; i++) {
    dir = await dir.getDirectoryHandle(parts[i], { create });
  }
  return dir.getFileHandle(parts[parts.length - 1], { create });
}

async function getDirHandle(
  path: string,
  create = false,
): Promise<FileSystemDirectoryHandle> {
  if (!rootHandle) throw new Error("No vault open");
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  let dir = rootHandle;
  for (const part of parts) {
    dir = await dir.getDirectoryHandle(part, { create });
  }
  return dir;
}

function getExtension(name: string): string | undefined {
  const idx = name.lastIndexOf(".");
  return idx > 0 ? name.substring(idx + 1) : undefined;
}

export function getNoteName(path: string): string {
  return (path.split("/").pop() || path).replace(/\.md$/i, "");
}

// ============================================================
// Vault commands
// ============================================================

export async function openVault(path: string): Promise<VaultConfig> {
  // In browser, `path` is ignored — we use showDirectoryPicker()
  // This is called after the handle is already set
  if (!rootHandle) throw new Error("No directory handle set");

  const name = rootHandle.name;

  // Check if it's a git repo by looking for .git folder
  let isGitRepo = false;
  try {
    await rootHandle.getDirectoryHandle(".git");
    isGitRepo = true;
  } catch {
    isGitRepo = false;
  }

  vaultConfig = { path: name, name, is_git_repo: isGitRepo };

  // Initialize isomorphic-git FS adapter
  gitOps.initGitFS(rootHandle);

  // Build the note index
  await rebuildNoteIndex();

  return vaultConfig;
}

export function setRootHandle(handle: FileSystemDirectoryHandle) {
  rootHandle = handle;
  persistVaultHandle(handle);
}

async function rebuildNoteIndex() {
  noteIndex.clear();
  const tree = await getFileTree();

  const collectFiles = (nodes: FileTreeNode[]) => {
    for (const node of nodes) {
      if (node.type === "file" && node.extension === "md") {
        // Will be populated lazily or on read
        noteIndex.set(node.path, {
          path: node.path,
          name: getNoteName(node.path),
          content: "",
          links: [],
        });
      }
      if (node.children) collectFiles(node.children);
    }
  };
  collectFiles(tree);

  // Read all notes to build wikilink index and search index
  const entries = Array.from(noteIndex.values());
  for (const entry of entries) {
    try {
      const content = await readFile(entry.path);
      entry.content = content;
      entry.links = extractLinks(content);
    } catch {
      // ignore unreadable files
    }
  }

  // Build search index
  buildSearchIndex(
    entries.map((e) => ({ path: e.path, title: e.name, content: e.content })),
  );
}

/**
 * Extract internal markdown links from content.
 * Matches [text](path) where path ends with .md or has no extension (treated as note link).
 * Ignores image links ![alt](src) and external URLs (http://, https://).
 */
function extractLinks(content: string): string[] {
  // Match [text](href) but not ![text](href)
  const re = /(?<!!)\[([^\]]+)\]\(([^)]+)\)/g;
  const links: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    const href = match[2].trim();
    // Skip external URLs
    if (href.startsWith("http://") || href.startsWith("https://")) continue;
    // Skip anchors-only
    if (href.startsWith("#")) continue;
    links.push(href);
  }
  return links;
}

export async function initVaultRepo(): Promise<void> {
  await gitOps.initVaultRepo();
  // Update vault config to reflect new git repo
  if (vaultConfig) {
    vaultConfig.is_git_repo = true;
  }
}

export async function getBacklinks(path: string): Promise<string[]> {
  const targetName = getNoteName(path);
  const backlinks: string[] = [];
  for (const entry of noteIndex.values()) {
    if (entry.path === path) continue;
    // Check if any link in this entry points to the target.
    // Links can be full paths ("notes/foo.md") or just filenames ("foo.md").
    const matches = entry.links.some((link) => {
      const linkLower = link.toLowerCase();
      const pathLower = path.toLowerCase();
      // Exact path match
      if (linkLower === pathLower) return true;
      // Filename-only match (e.g. "foo.md" matches "notes/foo.md")
      const linkName = getNoteName(link);
      if (linkName.toLowerCase() === targetName.toLowerCase()) return true;
      return false;
    });
    if (matches) {
      backlinks.push(entry.path);
    }
  }
  return backlinks;
}

export async function getNoteNames(): Promise<string[]> {
  return Array.from(noteIndex.values()).map((e) => e.name);
}

export async function resolveWikilink(name: string): Promise<string | null> {
  // Resolve a note name (or path) to a full vault-relative path.
  // Works with both bare names ("My Note") and paths ("notes/My Note.md").
  const lower = name.toLowerCase().replace(/\.md$/i, "");
  for (const entry of noteIndex.values()) {
    if (entry.name.toLowerCase() === lower) {
      return entry.path;
    }
    if (entry.path.toLowerCase() === name.toLowerCase()) {
      return entry.path;
    }
  }
  return null;
}

export async function getGraphData(): Promise<GraphData> {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const backlinkCounts = new Map<string, number>();

  // Count backlinks — normalize link targets to note names
  for (const entry of noteIndex.values()) {
    for (const link of entry.links) {
      const targetName = getNoteName(link).toLowerCase();
      backlinkCounts.set(targetName, (backlinkCounts.get(targetName) || 0) + 1);
    }
  }

  for (const entry of noteIndex.values()) {
    nodes.push({
      id: entry.name,
      label: entry.name,
      path: entry.path,
      backlink_count: backlinkCounts.get(entry.name.toLowerCase()) || 0,
    });

    for (const link of entry.links) {
      edges.push({ source: entry.name, target: getNoteName(link) });
    }
  }

  return { nodes, edges };
}

export async function getLocalGraph(
  path: string,
  depth = 2,
): Promise<GraphData> {
  const fullGraph = await getGraphData();
  const centerName = getNoteName(path);

  // BFS to find nodes within depth
  const visited = new Set<string>();
  let frontier = new Set([centerName.toLowerCase()]);

  for (let d = 0; d < depth; d++) {
    const nextFrontier = new Set<string>();
    for (const name of frontier) {
      if (visited.has(name)) continue;
      visited.add(name);
      // Find edges from/to this node
      for (const edge of fullGraph.edges) {
        if (edge.source.toLowerCase() === name)
          nextFrontier.add(edge.target.toLowerCase());
        if (edge.target.toLowerCase() === name)
          nextFrontier.add(edge.source.toLowerCase());
      }
    }
    frontier = nextFrontier;
  }
  // Add final frontier
  for (const name of frontier) visited.add(name);

  const nodes = fullGraph.nodes.filter((n) => visited.has(n.id.toLowerCase()));
  const nodeIds = new Set(nodes.map((n) => n.id.toLowerCase()));
  const edges = fullGraph.edges.filter(
    (e) =>
      nodeIds.has(e.source.toLowerCase()) &&
      nodeIds.has(e.target.toLowerCase()),
  );

  return { nodes, edges };
}

export async function reindexFile(path: string): Promise<void> {
  try {
    const content = await readFile(path);
    const name = getNoteName(path);
    const entry: NoteEntry = {
      path,
      name,
      content,
      links: extractLinks(content),
    };
    noteIndex.set(path, entry);
    addToIndex({ path, title: name, content });
  } catch {
    // ignore
  }
}

// ============================================================
// File commands
// ============================================================

export async function readFile(path: string): Promise<string> {
  const handle = await getFileHandle(path);
  const file = await handle.getFile();
  return file.text();
}

export async function writeFile(path: string, content: string): Promise<void> {
  const handle = await getFileHandle(path, true);
  const writable = await handle.createWritable();
  await writable.write(content);
  await writable.close();
  modifiedFiles.add(path);
}

export async function createNote(
  path: string,
  initialContent?: string,
): Promise<void> {
  const content = initialContent ?? "";
  await writeFile(path, content);
  // Add to note index
  const name = getNoteName(path);
  noteIndex.set(path, {
    path,
    name,
    content,
    links: extractLinks(content),
  });
}

/** Check whether a file exists at the given path */
export async function fileExists(path: string): Promise<boolean> {
  try {
    await getFileHandle(path);
    return true;
  } catch {
    return false;
  }
}

/**
 * Return the next available "untitled" filename in the given directory.
 * e.g. "untitled.md", "untitled 1.md", "untitled 2.md", ...
 * @param dir — directory prefix like "" (root) or "folder/" (must end with /)
 */
export async function getNextUntitledName(dir = ""): Promise<string> {
  const base = `${dir}untitled.md`;
  if (!(await fileExists(base))) return base;
  let i = 1;
  while (true) {
    const candidate = `${dir}untitled ${i}.md`;
    if (!(await fileExists(candidate))) return candidate;
    i++;
  }
}

export async function deleteFile(path: string): Promise<void> {
  if (!rootHandle) throw new Error("No vault open");
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  let dir = rootHandle;
  for (let i = 0; i < parts.length - 1; i++) {
    dir = await dir.getDirectoryHandle(parts[i]);
  }
  await dir.removeEntry(parts[parts.length - 1], { recursive: true });
  noteIndex.delete(path);
  modifiedFiles.add(path);
}

export async function renameFile(
  oldPath: string,
  newPath: string,
): Promise<void> {
  // Browser FS API doesn't have a rename — we copy + delete
  try {
    const content = await readFile(oldPath);
    await writeFile(newPath, content);
    await deleteFile(oldPath);
    // Update note index
    noteIndex.delete(oldPath);
    const name = getNoteName(newPath);
    noteIndex.set(newPath, {
      path: newPath,
      name,
      content,
      links: extractLinks(content),
    });
  } catch {
    throw new Error(`Failed to rename ${oldPath} to ${newPath}`);
  }
}

export async function createFolder(path: string): Promise<void> {
  await getDirHandle(path, true);
}

export async function getFileTree(): Promise<FileTreeNode[]> {
  if (!rootHandle) return [];
  return buildTree(rootHandle, "");
}

async function buildTree(
  dir: FileSystemDirectoryHandle,
  prefix: string,
): Promise<FileTreeNode[]> {
  const entries: FileTreeNode[] = [];

  for await (const [name, handle] of dir.entries()) {
    // Skip hidden files/folders
    if (name.startsWith(".")) continue;
    if (name === "node_modules") continue;

    const path = prefix ? `${prefix}/${name}` : name;

    if (handle.kind === "directory") {
      const children = await buildTree(
        handle as FileSystemDirectoryHandle,
        path,
      );
      entries.push({ type: "folder", name, path, children });
    } else {
      entries.push({
        type: "file",
        name,
        path,
        extension: getExtension(name),
      });
    }
  }

  // Sort: folders first, then alphabetical
  entries.sort((a, b) => {
    if (a.type !== b.type) return a.type === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });

  return entries;
}

export async function saveBinaryFile(
  path: string,
  data: number[],
): Promise<string> {
  const handle = await getFileHandle(path, true);
  const writable = await handle.createWritable();
  await writable.write(new Uint8Array(data));
  await writable.close();
  modifiedFiles.add(path);
  return path;
}

// ============================================================
// Git commands (powered by isomorphic-git)
// ============================================================

export async function gitStatus(): Promise<FileStatus[]> {
  if (!vaultConfig?.is_git_repo) return [];
  try {
    return await gitOps.gitStatus();
  } catch (e) {
    console.warn("gitStatus error:", e);
    return [];
  }
}

export async function gitStageFile(path: string): Promise<void> {
  await gitOps.gitStageFile(path);
}

export async function gitUnstageFile(path: string): Promise<void> {
  await gitOps.gitUnstageFile(path);
}

export async function gitStageAll(): Promise<void> {
  await gitOps.gitStageAll();
}

export async function gitCommit(message: string): Promise<string> {
  return await gitOps.gitCommit(message);
}

export async function gitCurrentBranch(): Promise<string> {
  if (!vaultConfig?.is_git_repo) return "";
  try {
    return await gitOps.gitCurrentBranch();
  } catch {
    return "";
  }
}

export async function gitBranches(): Promise<BranchInfo[]> {
  if (!vaultConfig?.is_git_repo) return [];
  try {
    return await gitOps.gitBranches();
  } catch {
    return [];
  }
}

export async function gitCreateBranch(name: string): Promise<void> {
  await gitOps.gitCreateBranch(name);
}

export async function gitCheckoutBranch(name: string): Promise<void> {
  await gitOps.gitCheckoutBranch(name);
}

export async function gitLog(maxCount?: number): Promise<CommitInfo[]> {
  if (!vaultConfig?.is_git_repo) return [];
  try {
    return await gitOps.gitLog(maxCount);
  } catch {
    return [];
  }
}

export async function gitFileLog(
  filePath: string,
  maxCount?: number,
): Promise<CommitInfo[]> {
  if (!vaultConfig?.is_git_repo) return [];
  try {
    return await gitOps.gitFileLog(filePath, maxCount);
  } catch {
    return [];
  }
}

export async function gitFileAtCommit(
  commitId: string,
  filePath: string,
): Promise<string> {
  return await gitOps.gitFileAtCommit(commitId, filePath);
}

export async function gitDiff(): Promise<FileDiff[]> {
  if (!vaultConfig?.is_git_repo) return [];
  try {
    return await gitOps.gitDiff();
  } catch {
    return [];
  }
}

export async function gitPull(): Promise<string> {
  return "Git pull requires remote configuration. Use your terminal for now.";
}

export async function gitPush(): Promise<void> {
  await gitOps.gitPush();
}

export async function gitConflicts(): Promise<ConflictFile[]> {
  return [];
}

// ============================================================
// Search commands
// ============================================================

export async function searchNotes(query: string): Promise<SearchResult[]> {
  return searchIndex(query);
}

// ============================================================
// File watching (polling)
// ============================================================

let pollTimer: ReturnType<typeof setInterval> | null = null;
let lastTreeSnapshot: string = "";

export function startFileWatching(onChange: () => void) {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    try {
      const tree = await getFileTree();
      const snapshot = JSON.stringify(tree.map((n) => n.path));
      if (snapshot !== lastTreeSnapshot) {
        lastTreeSnapshot = snapshot;
        onChange();
      }
    } catch {
      // ignore
    }
  }, 3000);
}

export function stopFileWatching() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

// ============================================================
// Modified files tracking
// ============================================================

export function getModifiedFileCount(): number {
  return modifiedFiles.size;
}

export function clearModifiedFiles() {
  modifiedFiles.clear();
}
