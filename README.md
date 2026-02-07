# CommitPaper

**Git-native personal knowledge management — in your browser.** An Obsidian-inspired web app where your notes are just files on your filesystem. No cloud accounts, no subscriptions, no proprietary formats.

Built with **React 19 + CodeMirror 6 + TypeScript + Vite** and the **File System Access API**.

---

## Features

- **Live WYSIWYG preview** — headings, bold, italic, strikethrough, highlights, images, and more render inline as you type
- **Wikilinks** (`[[note]]`) — link between notes with autocomplete, hover preview, and click-to-navigate
- **Backlinks panel** — see every note that links to the current one
- **Graph view** — visualise your knowledge graph with Cytoscape.js
- **Callouts** — `> [!note]`, `> [!warning]`, `> [!tip]`, etc. with coloured borders and icons (15 types)
- **Math rendering** — inline `$LaTeX$` and block `$$...$$` powered by KaTeX
- **Mermaid diagrams** — fenced ` ```mermaid ` blocks render as interactive diagrams
- **Note embedding** — `![[note-name]]` transcludes another note's content inline
- **Markdown preview** — toggle between source editor and full rendered preview with Ctrl+E
- **Interactive checkboxes** — `- [ ]` / `- [x]` render as clickable checkboxes
- **Daily notes** — one-click or Alt+D to create/open today's daily note
- **Templates** — create a `templates/` folder with variable substitution (`{{date}}`, `{{title}}`, etc.)
- **Tags** — `#tag` extraction from content and YAML frontmatter, browsable in sidebar
- **Properties editor** — visual key-value editor for YAML frontmatter
- **Command palette** — Ctrl+P to fuzzy search all notes or create a new one
- **Full-text search** — client-side search powered by MiniSearch with ranked results and snippets
- **File management** — drag & drop, right-click context menus, rename, delete, star notes
- **Auto-save** — changes saved automatically after 2 seconds of inactivity
- **Image paste** — paste images from clipboard, auto-saved to `attachments/`
- **Git status** — read-only git info (branch name, modified file count) displayed in the sidebar
- **PWA support** — install as a Progressive Web App for offline use
- **Dark theme** — Catppuccin Mocha colour scheme throughout

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

CommitPaper runs entirely in the browser. When you click **Open Vault**, the browser's `showDirectoryPicker()` API lets you select a folder. CommitPaper then reads and writes `.md` files directly on your filesystem — no server, no uploads, nothing leaves your machine.

- **File System Access API** replaces the traditional backend for all file operations
- **MiniSearch** provides client-side full-text search (replaces server-side Tantivy)
- **Polling** (every 3s) detects external file changes (replaces native file watching)
- **Git status** is read-only — branch name from `.git/HEAD`, modified file count. Use your terminal or Git client for commits, pushes, and pulls.

Your vault is just a folder. If you stop using CommitPaper, your notes are plain Markdown files right where you left them.

---

## Keyboard Shortcuts

| Shortcut       | Action                  |
| -------------- | ----------------------- |
| `Ctrl+S`       | Save                    |
| `Ctrl+P`       | Command palette         |
| `Ctrl+E`       | Toggle source / preview |
| `Ctrl+B`       | Toggle right panel      |
| `Alt+D`        | Today's daily note      |
| `Ctrl+F`       | Find in file            |
| `Ctrl+H`       | Find and replace        |
| `Ctrl+Z`       | Undo                    |
| `Ctrl+Shift+Z` | Redo                    |

---

## Project Structure

```
commitpaper/
├── public/              # Static assets, manifest, favicon
├── src/
│   ├── components/      # React components
│   │   ├── Editor/      # CodeMirror editor + 10 extensions
│   │   ├── Sidebar/     # File tree, git panel, search, tags, daily notes, templates
│   │   └── RightPanel/  # Outline, backlinks, properties, history, graph
│   ├── lib/
│   │   ├── api.ts       # File System Access API adapter (~400 lines)
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
| Editor      | CodeMirror 6           | Extensible code/text editor        |
| Types       | TypeScript 5           | Type safety                        |
| Build       | Vite 7                 | Fast HMR and builds                |
| State       | Zustand 5              | Minimal state management           |
| Graph       | Cytoscape.js           | Knowledge graph visualisation      |
| Math        | KaTeX                  | LaTeX rendering                    |
| Diagrams    | Mermaid                | Declarative diagrams               |
| Search      | MiniSearch             | Client-side full-text search       |
| File Access | File System Access API | Browser filesystem read/write      |
| PWA         | vite-plugin-pwa        | Offline support and installability |

---

## Git Integration (Read-Only)

The web version shows git status information but cannot perform git operations:

- **Branch name** — read from `.git/HEAD`
- **Modified file count** — tracked in-memory during editing
- **Guidance** — the Git panel shows terminal commands for committing and pushing

For full git operations, use your terminal:

```bash
cd your-vault
git add . && git commit -m "update notes"
git push
```

---

## License

MIT — free to use, modify, and distribute.
