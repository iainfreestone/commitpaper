import { create } from "zustand";
import { getSettings, updateSettings } from "../lib/settings";

export type ThemeId =
  | "catppuccin-mocha"
  | "catppuccin-latte"
  | "nord-dark"
  | "nord-light"
  | "frame-dark"
  | "frame-light"
  | "crepe-dark"
  | "crepe-light";

export interface ThemeMeta {
  id: ThemeId;
  label: string;
  isDark: boolean;
}

export const themes: ThemeMeta[] = [
  { id: "catppuccin-mocha", label: "Catppuccin Mocha", isDark: true },
  { id: "catppuccin-latte", label: "Catppuccin Latte", isDark: false },
  { id: "nord-dark", label: "Nord Dark", isDark: true },
  { id: "nord-light", label: "Nord Light", isDark: false },
  { id: "frame-dark", label: "Frame Dark", isDark: true },
  { id: "frame-light", label: "Frame Light", isDark: false },
  { id: "crepe-dark", label: "Crepe Dark", isDark: true },
  { id: "crepe-light", label: "Crepe Light", isDark: false },
];

function isValidTheme(id: string): id is ThemeId {
  return themes.some((t) => t.id === id);
}

function applyThemeToDOM(themeId: ThemeId) {
  document.documentElement.setAttribute("data-theme", themeId);
}

interface ThemeStore {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
}

// Apply a default theme immediately so the page isn't un-themed before vault loads.
// The real saved theme is applied once the vault settings are loaded.
const initialTheme: ThemeId = (() => {
  // Try localStorage first as a fast fallback (will be cleared after migration)
  try {
    const saved = localStorage.getItem("commitpaper-theme");
    if (saved && isValidTheme(saved)) return saved;
  } catch {}
  return "catppuccin-mocha";
})();
applyThemeToDOM(initialTheme);

export const useThemeStore = create<ThemeStore>((set) => ({
  theme: initialTheme,
  setTheme: (theme: ThemeId) => {
    applyThemeToDOM(theme);
    updateSettings({ theme });
    set({ theme });
  },
}));

// Listen for vault settings being loaded and apply the saved theme
window.addEventListener("vault-settings-loaded", (e: Event) => {
  const settings = (e as CustomEvent).detail;
  const themeId = settings?.theme;
  if (themeId && isValidTheme(themeId)) {
    applyThemeToDOM(themeId);
    useThemeStore.setState({ theme: themeId });
  }
});
