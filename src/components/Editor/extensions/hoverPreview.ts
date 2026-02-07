import {
  EditorView,
  hoverTooltip,
} from "@codemirror/view";
import * as api from "../../../lib/api";

const WIKILINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

async function getHoverContent(target: string): Promise<string | null> {
  try {
    const resolved = await api.resolveWikilink(target);
    if (!resolved) return null;
    const content = await api.readFile(resolved);
    const lines = content.split("\n");
    let start = 0;
    if (lines[0]?.trim() === "---") {
      for (let i = 1; i < lines.length; i++) {
        if (lines[i]?.trim() === "---") {
          start = i + 1;
          break;
        }
      }
    }
    const preview = lines
      .slice(start, start + 15)
      .join("\n")
      .trim();
    return preview || "(empty note)";
  } catch {
    return null;
  }
}

export const wikilinkHoverPreview = hoverTooltip(
  async (view, pos, side) => {
    const line = view.state.doc.lineAt(pos);
    const text = line.text;

    WIKILINK_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = WIKILINK_RE.exec(text)) !== null) {
      const start = line.from + match.index;
      const end = start + match[0].length;

      if (pos >= start && pos <= end) {
        const target = match[1].trim();
        const content = await getHoverContent(target);
        if (!content) return null;

        return {
          pos: start,
          end,
          above: true,
          create() {
            const dom = document.createElement("div");
            dom.className = "cm-hover-preview";

            const title = document.createElement("div");
            title.className = "cm-hover-preview-title";
            title.textContent = target;
            dom.appendChild(title);

            const body = document.createElement("div");
            body.className = "cm-hover-preview-body";
            body.textContent = content;
            dom.appendChild(body);

            return { dom };
          },
        };
      }
    }
    return null;
  },
  { hoverTime: 400 },
);

export const hoverPreviewTheme = EditorView.baseTheme({
  ".cm-hover-preview": {
    backgroundColor: "#1e1e2e",
    border: "1px solid #313244",
    borderRadius: "8px",
    padding: "12px",
    maxWidth: "400px",
    maxHeight: "300px",
    overflow: "auto",
    boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
    fontSize: "13px",
    lineHeight: "1.5",
  },
  ".cm-hover-preview-title": {
    fontWeight: "700",
    color: "#89b4fa",
    marginBottom: "8px",
    paddingBottom: "6px",
    borderBottom: "1px solid #313244",
    fontSize: "14px",
  },
  ".cm-hover-preview-body": {
    color: "#cdd6f4",
    whiteSpace: "pre-wrap",
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "12px",
    opacity: "0.9",
  },
  ".cm-tooltip": {
    overflow: "visible !important",
  },
});
