// ============================================================
// File System Access API adapter
// Browser-native file operations for CommitPaper
// ============================================================

import { buildSearchIndex, searchIndex, addToIndex } from "./search";

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
  status: "Modified" | "Added" | "Deleted" | "Renamed" | "Untracked" | "Conflicted";
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

// In-memory note index for wikilinks, backlinks, graph
interface NoteEntry {
  path: string;
  name: string; // filename without .md
  content: string;
  wikilinks: string[]; // target names
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
  create = false
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
  create = false
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

function getNoteName(path: string): string {
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

  // Build the note index
  await rebuildNoteIndex();

  return vaultConfig;
}

export function setRootHandle(handle: FileSystemDirectoryHandle) {
  rootHandle = handle;
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
          wikilinks: [],
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
      entry.wikilinks = extractWikilinks(content);
    } catch {
      // ignore unreadable files
    }
  }

  // Build search index
  buildSearchIndex(entries.map(e => ({ path: e.path, title: e.name, content: e.content })));
}

function extractWikilinks(content: string): string[] {
  const re = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
  const links: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    links.push(match[1].trim());
  }
  return links;
}

export async function initVaultRepo(): Promise<void> {
  // Can't init git repos from browser — no-op
  console.warn("Git init is not available in browser mode");
}

export async function getBacklinks(path: string): Promise<string[]> {
  const targetName = getNoteName(path);
  const backlinks: string[] = [];
  for (const entry of noteIndex.values()) {
    if (entry.path === path) continue;
    if (entry.wikilinks.some(l => l.toLowerCase() === targetName.toLowerCase())) {
      backlinks.push(entry.path);
    }
  }
  return backlinks;
}

export async function getNoteNames(): Promise<string[]> {
  return Array.from(noteIndex.values()).map(e => e.name);
}

export async function resolveWikilink(name: string): Promise<string | null> {
  const lower = name.toLowerCase();
  for (const entry of noteIndex.values()) {
    if (entry.name.toLowerCase() === lower) {
      return entry.path;
    }
  }
  return null;
}

export async function getGraphData(): Promise<GraphData> {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const backlinkCounts = new Map<string, number>();

  // Count backlinks
  for (const entry of noteIndex.values()) {
    for (const link of entry.wikilinks) {
      backlinkCounts.set(link.toLowerCase(), (backlinkCounts.get(link.toLowerCase()) || 0) + 1);
    }
  }

  for (const entry of noteIndex.values()) {
    nodes.push({
      id: entry.name,
      label: entry.name,
      path: entry.path,
      backlink_count: backlinkCounts.get(entry.name.toLowerCase()) || 0,
    });

    for (const link of entry.wikilinks) {
      edges.push({ source: entry.name, target: link });
    }
  }

  return { nodes, edges };
}

export async function getLocalGraph(path: string, depth = 2): Promise<GraphData> {
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
        if (edge.source.toLowerCase() === name) nextFrontier.add(edge.target.toLowerCase());
        if (edge.target.toLowerCase() === name) nextFrontier.add(edge.source.toLowerCase());
      }
    }
    frontier = nextFrontier;
  }
  // Add final frontier
  for (const name of frontier) visited.add(name);

  const nodes = fullGraph.nodes.filter(n => visited.has(n.id.toLowerCase()));
  const nodeIds = new Set(nodes.map(n => n.id.toLowerCase()));
  const edges = fullGraph.edges.filter(
    e => nodeIds.has(e.source.toLowerCase()) && nodeIds.has(e.target.toLowerCase())
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
      wikilinks: extractWikilinks(content),
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

export async function createNote(path: string): Promise<void> {
  await writeFile(path, "");
  // Add to note index
  const name = getNoteName(path);
  noteIndex.set(path, { path, name, content: "", wikilinks: [] });
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

export async function renameFile(oldPath: string, newPath: string): Promise<void> {
  // Browser FS API doesn't have a rename — we copy + delete
  try {
    const content = await readFile(oldPath);
    await writeFile(newPath, content);
    await deleteFile(oldPath);
    // Update note index
    noteIndex.delete(oldPath);
    const name = getNoteName(newPath);
    noteIndex.set(newPath, { path: newPath, name, content, wikilinks: extractWikilinks(content) });
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
  prefix: string
): Promise<FileTreeNode[]> {
  const entries: FileTreeNode[] = [];

  for await (const [name, handle] of dir.entries()) {
    // Skip hidden files/folders
    if (name.startsWith(".")) continue;
    if (name === "node_modules") continue;

    const path = prefix ? `${prefix}/${name}` : name;

    if (handle.kind === "directory") {
      const children = await buildTree(handle as FileSystemDirectoryHandle, path);
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

export async function saveBinaryFile(path: string, data: number[]): Promise<string> {
  const handle = await getFileHandle(path, true);
  const writable = await handle.createWritable();
  await writable.write(new Uint8Array(data));
  await writable.close();
  modifiedFiles.add(path);
  return path;
}

// ============================================================
// Git commands (read-only awareness from .git/)
// ============================================================

export async function gitStatus(): Promise<FileStatus[]> {
  // Return our tracked modified files as "Modified" + untracked
  return Array.from(modifiedFiles).map(path => ({
    path,
    status: "Modified" as const,
    staged: false,
  }));
}

export async function gitStageFile(_path: string): Promise<void> {
  console.warn("Git staging is not available in browser mode");
}

export async function gitUnstageFile(_path: string): Promise<void> {
  console.warn("Git unstaging is not available in browser mode");
}

export async function gitStageAll(): Promise<void> {
  console.warn("Git stage all is not available in browser mode");
}

export async function gitCommit(_message: string): Promise<string> {
  console.warn("Git commit is not available in browser mode");
  return "";
}

export async function gitCurrentBranch(): Promise<string> {
  if (!rootHandle) return "";
  try {
    const gitDir = await rootHandle.getDirectoryHandle(".git");
    const headFile = await gitDir.getFileHandle("HEAD");
    const file = await headFile.getFile();
    const text = await file.text();
    // Parse "ref: refs/heads/main\n"
    const match = text.trim().match(/^ref:\s*refs\/heads\/(.+)$/);
    if (match) return match[1];
    // Detached HEAD — return short hash
    return text.trim().substring(0, 8);
  } catch {
    return "";
  }
}

export async function gitBranches(): Promise<BranchInfo[]> {
  if (!rootHandle) return [];
  try {
    const currentBranch = await gitCurrentBranch();
    const gitDir = await rootHandle.getDirectoryHandle(".git");
    const refsDir = await gitDir.getDirectoryHandle("refs");
    const headsDir = await refsDir.getDirectoryHandle("heads");

    const branches: BranchInfo[] = [];
    for await (const [name, handle] of headsDir.entries()) {
      if (handle.kind === "file") {
        branches.push({
          name,
          is_head: name === currentBranch,
          upstream: null,
          ahead: 0,
          behind: 0,
        });
      }
    }
    return branches;
  } catch {
    return [];
  }
}

export async function gitCreateBranch(_name: string): Promise<void> {
  console.warn("Git branch creation is not available in browser mode");
}

export async function gitCheckoutBranch(_name: string): Promise<void> {
  console.warn("Git checkout is not available in browser mode");
}

export async function gitLog(_maxCount?: number): Promise<CommitInfo[]> {
  // Can't read git log from browser without parsing pack files
  return [];
}

export async function gitFileLog(_filePath: string, _maxCount?: number): Promise<CommitInfo[]> {
  return [];
}

export async function gitFileAtCommit(_commitId: string, _filePath: string): Promise<string> {
  throw new Error("File history is not available in browser mode");
}

export async function gitDiff(): Promise<FileDiff[]> {
  return [];
}

export async function gitPull(): Promise<string> {
  console.warn("Git pull is not available in browser mode");
  return "Git pull is not available in browser mode. Use your preferred Git tool.";
}

export async function gitPush(): Promise<void> {
  console.warn("Git push is not available in browser mode");
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
      const snapshot = JSON.stringify(tree.map(n => n.path));
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
