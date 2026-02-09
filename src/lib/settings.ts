// ============================================================
// Vault Settings — persisted to .commitpaper/settings.json
// ============================================================

import { getRootHandle } from "./api";

const SETTINGS_DIR = ".commitpaper";
const SETTINGS_FILE = "settings.json";

/** All known settings with their defaults */
export interface VaultSettings {
  theme: string;
  editorWidth: "readable" | "full";
  fontSize: number;
  lineNumbers: boolean;
  starred: string[];
  gitAuthor: { name: string; email: string };
}

const DEFAULTS: VaultSettings = {
  theme: "catppuccin-mocha",
  editorWidth: "readable",
  fontSize: 15,
  lineNumbers: false,
  starred: [],
  gitAuthor: { name: "CommitPaper User", email: "user@commitpaper.local" },
};

/** Currently loaded settings (in memory) */
let current: VaultSettings = { ...DEFAULTS };

/** Get the current in-memory settings snapshot */
export function getSettings(): VaultSettings {
  return current;
}

/** Read settings from .commitpaper/settings.json in the vault */
export async function loadSettings(): Promise<VaultSettings> {
  const root = getRootHandle();
  if (!root) {
    current = { ...DEFAULTS };
    return current;
  }

  try {
    const dir = await root.getDirectoryHandle(SETTINGS_DIR);
    const fileHandle = await dir.getFileHandle(SETTINGS_FILE);
    const file = await fileHandle.getFile();
    const text = await file.text();
    const parsed = JSON.parse(text);

    // Merge with defaults so new keys get default values
    current = { ...DEFAULTS, ...parsed };
  } catch {
    // File doesn't exist yet — use defaults
    current = { ...DEFAULTS };

    // Migrate from localStorage if available
    migrateFromLocalStorage();
  }

  return current;
}

/** Save the current settings to .commitpaper/settings.json */
export async function saveSettings(): Promise<void> {
  const root = getRootHandle();
  if (!root) return;

  try {
    const dir = await root.getDirectoryHandle(SETTINGS_DIR, { create: true });
    const fileHandle = await dir.getFileHandle(SETTINGS_FILE, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(current, null, 2));
    await writable.close();
  } catch (err) {
    console.warn("Failed to save settings:", err);
  }
}

/** Update one or more settings and persist */
export async function updateSettings(
  partial: Partial<VaultSettings>,
): Promise<void> {
  current = { ...current, ...partial };
  await saveSettings();
}

/** One-time migration from localStorage to settings file */
function migrateFromLocalStorage(): void {
  try {
    const theme = localStorage.getItem("commitpaper-theme");
    if (theme) current.theme = theme;

    const editorWidth = localStorage.getItem("commitpaper-editor-width");
    if (editorWidth === "readable" || editorWidth === "full")
      current.editorWidth = editorWidth;

    const starred = localStorage.getItem("commitpaper-starred");
    if (starred) {
      const parsed = JSON.parse(starred);
      if (Array.isArray(parsed)) current.starred = parsed;
    }

    const gitAuthor = localStorage.getItem("commitpaper-git-author");
    if (gitAuthor) {
      const parsed = JSON.parse(gitAuthor);
      if (parsed?.name && parsed?.email) current.gitAuthor = parsed;
    }
  } catch {
    // Ignore migration errors
  }
}

/** Clean up old localStorage keys after successful migration+save */
export function clearLegacyLocalStorage(): void {
  try {
    localStorage.removeItem("commitpaper-theme");
    localStorage.removeItem("commitpaper-editor-width");
    localStorage.removeItem("commitpaper-starred");
    localStorage.removeItem("commitpaper-git-author");
  } catch {
    // Ignore
  }
}
