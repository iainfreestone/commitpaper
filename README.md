# CommitPaper

**Local-first personal knowledge management — in your browser.** An Obsidian-inspired web app where your notes are just files on your filesystem. No cloud accounts, no subscriptions, no proprietary formats. Works with any folder on your computer — sync across devices with Dropbox, Google Drive, OneDrive, or Git.

Built with **React 19 + Milkdown/Crepe + TypeScript + Vite** and the **File System Access API**.

---

## Features

- **Live WYSIWYG editor** — headings, bold, italic, strikethrough, highlights, images, and more render inline as you type (powered by Milkdown/Crepe)
- **Rich & Raw modes** — toggle between the WYSIWYG editor and a plain-text raw editor with Ctrl+E
- **Note linking** — insert links to other notes via a built-in note picker; click to navigate
- **Backlinks panel** — see every note that links to the current one
- **Graph view** — visualise your knowledge graph with Cytoscape.js
- **Callouts** — `> [!note]`, `> [!warning]`, `> [!tip]`, etc. with coloured borders and icons (15 types)
- **Math rendering** — inline `$LaTeX$` and block `$$...$$` powered by KaTeX
- **Mermaid diagrams** — fenced ` ```mermaid ` blocks render as interactive diagrams
- **Note embedding** — `![[note-name]]` or `![embed](note.md)` transcludes another note's content inline
- **Interactive checkboxes** — `- [ ]` / `- [x]` render as clickable checkboxes
- **Command palette** — Ctrl+P to fuzzy search all notes or create a new one
- **Full-text search** — client-side search powered by MiniSearch with ranked results and snippets
- **File management** — drag & drop, right-click context menus, rename, delete, star notes
- **Auto-save** — changes saved automatically after 2 seconds of inactivity
- **Image paste** — paste images from clipboard, auto-saved to `attachments/`
- **Full Git integration** — stage, commit, push, branch, and view history directly from the app using isomorphic-git
- **8 themes** — Catppuccin Mocha, Catppuccin Latte, Nord Dark, Nord Light, Frame Dark, Frame Light, Crepe Dark, Crepe Light
- **Properties editor** — visual key-value editor for YAML frontmatter
- **Outline panel** — heading-based document outline for quick navigation
- **File history** — view git log per-file and see file contents at any commit
- **PWA support** — install as a Progressive Web App for offline use

---

## Browser Requirements

The File System Access API is required for direct filesystem read/write:

| Browser    | Supported        |
| ---------- | ---------------- |
| Chrome 86+ | ✅               |
| Edge 86+   | ✅               |
| Firefox    | ❌ Not supported |
| Safari     | ❌ Not supported |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) 18+

### Install

```bash
git clone https://github.com/IainMcl/commitpaper.git
cd commitpaper
npm install
```

### Development

```bash
npm run dev
```

Opens at [http://localhost:5180](http://localhost:5180). Hot-reload is enabled.

### Production Build

```bash
npm run build
```

Output is in `dist/`. Serve with any static file server.

---

## How It Works

CommitPaper runs entirely in the browser. When you click **Open Vault**, the browser's `showDirectoryPicker()` API lets you select any folder on your computer. CommitPaper then reads and writes `.md` files directly on your filesystem — no server, no uploads, nothing leaves your machine.

- **File System Access API** handles all file operations directly in the browser
- **MiniSearch** provides client-side full-text search
- **Polling** (every 3s) detects external file changes
- **isomorphic-git** provides full Git operations (stage, commit, push, branch) in-browser

Your vault is just a folder. It doesn't need to be a Git repo — but if it is, you get full version control from within the app. If you stop using CommitPaper, your notes are plain Markdown files right where you left them.

---

## Keyboard Shortcuts

| Shortcut       | Action             |
| -------------- | ------------------ |
| `Ctrl+S`       | Save               |
| `Ctrl+P`       | Command palette    |
| `Ctrl+E`       | Toggle Rich/Raw    |
| `Ctrl+\`       | Toggle right panel |
| `Ctrl+B`       | Bold               |
| `Ctrl+I`       | Italic             |
| `Ctrl+K`       | Insert link        |
| `Ctrl+1–4`     | Heading level 1–4  |
| `Ctrl+Shift+8` | Bullet list        |
| `Ctrl+Shift+7` | Numbered list      |
| `Ctrl+Shift+9` | Checkbox           |
| `Ctrl+Z`       | Undo               |
| `Ctrl+Shift+Z` | Redo               |

---

## Project Structure

```
commitpaper/
├── public/              # Static assets, manifest, favicon
├── src/
│   ├── components/      # React components
│   │   ├── Editor/      # Milkdown/Crepe WYSIWYG editor + ProseMirror plugins
│   │   ├── Sidebar/     # File tree, git panel, search
│   │   └── RightPanel/  # Outline, backlinks, properties, history, graph
│   ├── lib/
│   │   ├── api.ts       # File System Access API adapter
│   │   ├── git.ts       # isomorphic-git wrapper
│   │   └── search.ts    # MiniSearch wrapper
│   ├── pages/
│   │   └── LandingPage.tsx
│   ├── stores/          # Zustand state management
│   ├── styles/          # Global CSS
│   ├── types/           # TypeScript type declarations
│   ├── App.tsx          # Main app component
│   └── main.tsx         # Entry point with router
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## Tech Stack

| Layer       | Technology             | Purpose                            |
| ----------- | ---------------------- | ---------------------------------- |
| UI          | React 19               | Component-driven rendering         |
| Editor      | Milkdown/Crepe         | ProseMirror-based WYSIWYG editor   |
| Types       | TypeScript 5           | Type safety                        |
| Build       | Vite 7                 | Fast HMR and builds                |
| State       | Zustand 5              | Minimal state management           |
| Graph       | Cytoscape.js           | Knowledge graph visualisation      |
| Math        | KaTeX                  | LaTeX rendering                    |
| Diagrams    | Mermaid                | Declarative diagrams               |
| Search      | MiniSearch             | Client-side full-text search       |
| Git         | isomorphic-git         | In-browser Git operations          |
| File Access | File System Access API | Browser filesystem read/write      |
| PWA         | vite-plugin-pwa        | Offline support and installability |

---

## Git Integration

CommitPaper works with any folder — Git is not required. But if your vault is a Git repo, you get full version control from within the app:

- **Branch name** — displayed in the sidebar and status bar
- **Modified file count** — see how many files have changed at a glance
- **Stage & unstage** — select which files to include in a commit
- **Commit** — write commit messages and commit directly from the UI
- **Push** — push commits to your remote (GitHub, GitLab, etc.)
- **Branch management** — create, list, and switch branches
- **Commit log** — browse full commit history
- **File history** — view any file at any point in its git history
- **Line-by-line diff** — see exactly what changed

All powered by [isomorphic-git](https://isomorphic-git.org/), running entirely in the browser.

---

## License

MIT — free to use, modify, and distribute.
