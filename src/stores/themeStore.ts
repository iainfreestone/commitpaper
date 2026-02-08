import { create } from "zustand";

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

const STORAGE_KEY = "commitpaper-theme";

function loadSavedTheme(): ThemeId {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && themes.some((t) => t.id === saved)) {
      return saved as ThemeId;
    }
  } catch {}
  return "catppuccin-mocha";
}

function applyThemeToDOM(themeId: ThemeId) {
  document.documentElement.setAttribute("data-theme", themeId);
  try {
    localStorage.setItem(STORAGE_KEY, themeId);
  } catch {}
}

interface ThemeStore {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
}

// Apply the initial theme immediately (before React renders)
applyThemeToDOM(loadSavedTheme());

export const useThemeStore = create<ThemeStore>((set) => ({
  theme: loadSavedTheme(),
  setTheme: (theme: ThemeId) => {
    applyThemeToDOM(theme);
    set({ theme });
  },
}));
