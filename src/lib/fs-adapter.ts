// ============================================================
// File System Access API → isomorphic-git FS adapter
// Maps the isomorphic-git `fs` interface to browser-native
// FileSystem Access API handles.
// ============================================================

/**
 * isomorphic-git expects an `fs` object with callback-style methods.
 * We implement the promises API and wrap it with `fs.promises`.
 *
 * Required methods:
 *   readFile, writeFile, unlink, readdir, mkdir, rmdir, stat, lstat
 *
 * The adapter operates on a FileSystemDirectoryHandle (the vault root).
 */

export interface FsPromises {
  readFile(
    path: string,
    options?: { encoding?: string },
  ): Promise<Uint8Array | string>;
  writeFile(
    path: string,
    data: Uint8Array | string,
    options?: { encoding?: string; mode?: number },
  ): Promise<void>;
  unlink(path: string): Promise<void>;
  readdir(path: string): Promise<string[]>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  rmdir(path: string, options?: { recursive?: boolean }): Promise<void>;
  stat(path: string): Promise<FsStat>;
  lstat(path: string): Promise<FsStat>;
  rename(oldPath: string, newPath: string): Promise<void>;
  symlink(target: string, path: string): Promise<void>;
  readlink(path: string): Promise<string>;
}

export interface FsStat {
  type: string;
  size: number;
  mode: number;
  mtimeMs: number;
  ctimeMs?: number;
  isFile(): boolean;
  isDirectory(): boolean;
  isSymbolicLink(): boolean;
  uid: number;
  gid: number;
  dev: number;
  ino: number;
}

export interface IsomorphicGitFS {
  promises: FsPromises;
}

function createErrnoError(code: string, syscall: string, path: string): Error {
  const err = new Error(`${code}: ${syscall} '${path}'`) as Error & {
    code: string;
    errno: number;
  };
  err.code = code;
  err.errno =
    code === "ENOENT"
      ? -2
      : code === "ENOTDIR"
        ? -20
        : code === "EEXIST"
          ? -17
          : -1;
  return err;
}

function normalizePath(p: string): string {
  // Remove leading slashes (all of them), normalize separators
  let normalized = p
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
  // '.' and '' both mean root
  if (normalized === "." || normalized === "") return "";
  // Remove leading './' prefix(es) and collapse '//' to '/'
  normalized = normalized.replace(/^(\.\/)+/g, "").replace(/\/+/g, "/");
  // Remove trailing '/.' segments
  normalized = normalized.replace(/\/\.$/g, "");
  // If it became empty or '.', it's root
  if (normalized === "." || normalized === "") return "";
  return normalized;
}

function splitPath(p: string): string[] {
  return normalizePath(p).split("/").filter(Boolean);
}

function makeStat(type: "file" | "dir", size: number, mtime: number): FsStat {
  return {
    type,
    size,
    mode: type === "file" ? 0o100644 : 0o40755,
    mtimeMs: mtime,
    ctimeMs: mtime,
    uid: 1000,
    gid: 1000,
    dev: 0,
    ino: 0,
    isFile: () => type === "file",
    isDirectory: () => type === "dir",
    isSymbolicLink: () => false,
  };
}

/**
 * Navigate to a directory handle given a path relative to root.
 * If `create` is true, creates intermediate directories.
 */
async function getDirHandle(
  root: FileSystemDirectoryHandle,
  parts: string[],
  create = false,
): Promise<FileSystemDirectoryHandle> {
  let dir = root;
  for (const part of parts) {
    dir = await dir.getDirectoryHandle(part, { create });
  }
  return dir;
}

/**
 * Creates an isomorphic-git compatible FS adapter backed by
 * the File System Access API.
 */
export function createFSAdapter(
  rootHandle: FileSystemDirectoryHandle,
): IsomorphicGitFS {
  const promises: FsPromises = {
    async readFile(
      path: string,
      options?: { encoding?: string },
    ): Promise<Uint8Array | string> {
      const parts = splitPath(path);
      const fileName = parts.pop();
      if (!fileName) {
        throw createErrnoError("ENOENT", "open", path);
      }
      try {
        const dir = await getDirHandle(rootHandle, parts);
        const fileHandle = await dir.getFileHandle(fileName);
        const file = await fileHandle.getFile();

        if (options?.encoding === "utf8" || options?.encoding === "utf-8") {
          return await file.text();
        }
        const buffer = await file.arrayBuffer();
        return new Uint8Array(buffer);
      } catch (e) {
        console.warn(`[fs-adapter] readFile failed for path: '${path}'`, e);
        throw createErrnoError("ENOENT", "open", path);
      }
    },

    async writeFile(
      path: string,
      data: Uint8Array | string,
      _options?: { encoding?: string; mode?: number },
    ): Promise<void> {
      const parts = splitPath(path);
      const fileName = parts.pop()!;
      // Create parent directories if they don't exist
      const dir = await getDirHandle(rootHandle, parts, true);
      const fileHandle = await dir.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      if (typeof data === "string") {
        await writable.write(data);
      } else {
        // Convert Uint8Array to Blob for compatibility
        await writable.write(new Blob([data.buffer as ArrayBuffer]));
      }
      await writable.close();
    },

    async unlink(path: string): Promise<void> {
      const parts = splitPath(path);
      const fileName = parts.pop()!;
      try {
        const dir = await getDirHandle(rootHandle, parts);
        await dir.removeEntry(fileName);
      } catch {
        throw createErrnoError("ENOENT", "unlink", path);
      }
    },

    async readdir(path: string): Promise<string[]> {
      const parts = splitPath(path);
      let dir: FileSystemDirectoryHandle;
      try {
        if (parts.length === 0) {
          dir = rootHandle;
        } else {
          dir = await getDirHandle(rootHandle, parts);
        }
      } catch {
        throw createErrnoError("ENOENT", "scandir", path);
      }

      const entries: string[] = [];
      for await (const [name] of dir.entries()) {
        entries.push(name);
      }
      return entries;
    },

    async mkdir(
      path: string,
      options?: { recursive?: boolean },
    ): Promise<void> {
      const parts = splitPath(path);
      if (options?.recursive) {
        // Create each segment
        await getDirHandle(rootHandle, parts, true);
      } else {
        // Create just the last segment, parent must exist
        const dirName = parts.pop()!;
        const parent = parts.length
          ? await getDirHandle(rootHandle, parts)
          : rootHandle;
        await parent.getDirectoryHandle(dirName, { create: true });
      }
    },

    async rmdir(
      path: string,
      options?: { recursive?: boolean },
    ): Promise<void> {
      const parts = splitPath(path);
      const dirName = parts.pop()!;
      const parent = parts.length
        ? await getDirHandle(rootHandle, parts)
        : rootHandle;
      await parent.removeEntry(dirName, {
        recursive: options?.recursive ?? false,
      });
    },

    async stat(path: string): Promise<FsStat> {
      const normalized = normalizePath(path);
      const parts = normalized.split("/").filter(Boolean);

      // Root directory (handles '.', '/', '', '/.' etc.)
      if (parts.length === 0) {
        return makeStat("dir", 0, Date.now());
      }

      const name = parts.pop()!;
      let parent: FileSystemDirectoryHandle;
      try {
        parent = parts.length
          ? await getDirHandle(rootHandle, parts)
          : rootHandle;
      } catch (e) {
        console.warn(
          `[fs-adapter] stat: parent dir not found for '${path}' (normalized: '${normalized}')`,
          e,
        );
        throw createErrnoError("ENOENT", "stat", path);
      }

      // Try as file first
      try {
        const fileHandle = await parent.getFileHandle(name);
        const file = await fileHandle.getFile();
        return makeStat("file", file.size, file.lastModified);
      } catch {
        // Not a file, try as directory
      }

      try {
        await parent.getDirectoryHandle(name);
        return makeStat("dir", 0, Date.now());
      } catch {
        throw createErrnoError("ENOENT", "stat", path);
      }
    },

    async lstat(path: string): Promise<FsStat> {
      // No symlink support in File System Access API — same as stat
      try {
        return await promises.stat(path);
      } catch (e) {
        console.warn(`[fs-adapter] lstat failed for path: '${path}'`, e);
        throw e;
      }
    },

    async rename(oldPath: string, newPath: string): Promise<void> {
      // File System Access API doesn't have rename — read, write, delete
      const data = await promises.readFile(oldPath);
      await promises.writeFile(newPath, data);
      await promises.unlink(oldPath);
    },

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async symlink(_target: string, _path: string): Promise<void> {
      // Symlinks not supported in browser FS API
      throw new Error("Symlinks are not supported in the browser");
    },

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async readlink(_path: string): Promise<string> {
      throw new Error("Symlinks are not supported in the browser");
    },
  };

  return { promises };
}
