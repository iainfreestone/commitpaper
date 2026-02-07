import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import * as api from "../../../lib/tauri";

// ──────────────────────────────────────────────
// Note Embedding / Transclusion
// Syntax:  ![[note-name]]
// Renders the content of the referenced note inline
// ──────────────────────────────────────────────

const EMBED_RE = /!\[\[([^\]]+)\]\]/g;

// Cache for embedded content
const embedCache = new Map<string, { content: string; ts: number }>();
const CACHE_TTL = 5000; // 5s

async function fetchEmbedContent(name: string): Promise<string> {
  const cached = embedCache.get(name);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.content;
  }

  try {
    const path = await api.resolveWikilink(name);
    if (!path) return `Note not found: ${name}`;

    const content = await api.readFile(path);

    // Strip frontmatter
    let body = content;
    if (body.trimStart().startsWith("---")) {
      const endFm = body.indexOf("\n---", 3);
      if (endFm > 0) {
        body = body.substring(endFm + 4).trimStart();
      }
    }

    // Limit to first 30 lines
    const lines = body.split("\n").slice(0, 30);
    if (body.split("\n").length > 30) {
      lines.push("…");
    }
    const result = lines.join("\n");
    embedCache.set(name, { content: result, ts: Date.now() });
    return result;
  } catch {
    return `Error loading: ${name}`;
  }
}

class EmbedWidget extends WidgetType {
  constructor(readonly noteName: string) {
    super();
  }

  toDOM(view: EditorView) {
    const wrap = document.createElement("div");
    wrap.className = "cm-embed-widget";

    const header = document.createElement("div");
    header.className = "cm-embed-header";
    header.textContent = `📎 ${this.noteName}`;
    wrap.appendChild(header);

    const body = document.createElement("div");
    body.className = "cm-embed-body";
    body.textContent = "Loading…";
    wrap.appendChild(body);

    // Fetch content async
    fetchEmbedContent(this.noteName).then((content) => {
      body.textContent = content;
    });

    // Click header to navigate
    header.style.cursor = "pointer";
    header.addEventListener("click", async () => {
      try {
        const path = await api.resolveWikilink(this.noteName);
        if (path) {
          const { useEditorStore } =
            await import("../../../stores/editorStore");
          useEditorStore.getState().openFile(path);
        }
      } catch {
        // ignore
      }
    });

    return wrap;
  }

  eq(other: EmbedWidget) {
    return this.noteName === other.noteName;
  }

  ignoreEvent(e: Event) {
    return e.type !== "click";
  }
}

function isOnLine(
  lineFrom: number,
  lineTo: number,
  selections: readonly { from: number; to: number }[],
) {
  for (const sel of selections) {
    if (sel.from >= lineFrom && sel.from <= lineTo) return true;
    if (sel.to >= lineFrom && sel.to <= lineTo) return true;
  }
  return false;
}

function buildEmbedDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc;
  const selections = view.state.selection.ranges.map((r) => ({
    from: r.from,
    to: r.to,
  }));

  const decos: { from: number; to: number; deco: Decoration }[] = [];

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    EMBED_RE.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = EMBED_RE.exec(line.text)) !== null) {
      const start = line.from + match.index;
      const end = start + match[0].length;
      const noteName = match[1].trim();

      // Only render when cursor is not on this line
      if (!isOnLine(line.from, line.to, selections)) {
        // Replace the ![[...]] text with the embed widget
        decos.push({
          from: start,
          to: end,
          deco: Decoration.replace({
            widget: new EmbedWidget(noteName),
            block: true,
          }),
        });
      }
    }
  }

  decos.sort((a, b) => a.from - b.from || a.to - b.to);

  for (const d of decos) {
    builder.add(d.from, d.to, d.deco);
  }

  return builder.finish();
}

export const embedPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildEmbedDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildEmbedDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

export const embedTheme = EditorView.baseTheme({
  ".cm-embed-widget": {
    border: "1px solid #313244",
    borderRadius: "6px",
    margin: "4px 0",
    overflow: "hidden",
    background: "rgba(49, 50, 68, 0.3)",
  },
  ".cm-embed-header": {
    padding: "6px 12px",
    background: "rgba(49, 50, 68, 0.6)",
    borderBottom: "1px solid #313244",
    fontSize: "12px",
    fontWeight: "600",
    color: "#89b4fa",
  },
  ".cm-embed-header:hover": {
    color: "#74c7ec",
    textDecoration: "underline",
  },
  ".cm-embed-body": {
    padding: "8px 12px",
    fontSize: "13px",
    lineHeight: "1.5",
    color: "#a6adc8",
    whiteSpace: "pre-wrap",
    maxHeight: "300px",
    overflowY: "auto",
  },
});
