import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import mermaid from "mermaid";

// ──────────────────────────────────────────────
// Mermaid Diagram Rendering
// Renders ```mermaid ... ``` code blocks
// ──────────────────────────────────────────────

let mermaidInitialized = false;

function ensureMermaidInit() {
  if (!mermaidInitialized) {
    mermaid.initialize({
      startOnLoad: false,
      theme: "dark",
      themeVariables: {
        darkMode: true,
        background: "#1e1e2e",
        primaryColor: "#89b4fa",
        primaryTextColor: "#cdd6f4",
        primaryBorderColor: "#585b70",
        lineColor: "#a6adc8",
        secondaryColor: "#313244",
        tertiaryColor: "#45475a",
      },
      securityLevel: "loose",
      fontFamily: "var(--font-sans)",
    });
    mermaidInitialized = true;
  }
}

let mermaidIdCounter = 0;

class MermaidWidget extends WidgetType {
  private rendered = false;

  constructor(readonly code: string) {
    super();
  }

  toDOM() {
    const wrap = document.createElement("div");
    wrap.className = "cm-mermaid-widget";

    const inner = document.createElement("div");
    inner.className = "cm-mermaid-inner";
    inner.textContent = "Rendering diagram…";
    wrap.appendChild(inner);

    // Render asynchronously
    ensureMermaidInit();
    const id = `mermaid-${Date.now()}-${mermaidIdCounter++}`;

    mermaid
      .render(id, this.code)
      .then(({ svg }) => {
        inner.innerHTML = svg;
        this.rendered = true;
      })
      .catch((err) => {
        inner.textContent = `Mermaid error: ${err.message || err}`;
        inner.style.color = "#f38ba8";
        inner.style.fontSize = "12px";
      });

    return wrap;
  }

  eq(other: MermaidWidget) {
    return this.code === other.code;
  }

  ignoreEvent() {
    return true;
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

function buildMermaidDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc;
  const selections = view.state.selection.ranges.map((r) => ({
    from: r.from,
    to: r.to,
  }));

  const decos: { from: number; to: number; deco: Decoration }[] = [];

  let i = 1;
  while (i <= doc.lines) {
    const line = doc.line(i);
    const trimmed = line.text.trim();

    if (trimmed === "```mermaid") {
      // Find closing ```
      let endIdx = -1;
      for (let j = i + 1; j <= doc.lines; j++) {
        if (doc.line(j).text.trim() === "```") {
          endIdx = j;
          break;
        }
      }

      if (endIdx > 0) {
        const blockFrom = line.from;
        const blockTo = doc.line(endIdx).to;

        if (!isOnLine(blockFrom, blockTo, selections)) {
          // Collect mermaid code
          const codeLines: string[] = [];
          for (let j = i + 1; j < endIdx; j++) {
            codeLines.push(doc.line(j).text);
          }
          const code = codeLines.join("\n").trim();

          if (code) {
            // Hide all lines
            for (let j = i; j <= endIdx; j++) {
              decos.push({
                from: doc.line(j).from,
                to: doc.line(j).from,
                deco: Decoration.line({ class: "cm-mermaid-source" }),
              });
            }

            // Add rendered widget
            decos.push({
              from: line.from,
              to: line.from,
              deco: Decoration.widget({
                widget: new MermaidWidget(code),
                block: true,
              }),
            });
          }
        }

        i = endIdx + 1;
        continue;
      }
    }

    i++;
  }

  decos.sort((a, b) => a.from - b.from || a.to - b.to);

  for (const d of decos) {
    builder.add(d.from, d.to, d.deco);
  }

  return builder.finish();
}

export const mermaidPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildMermaidDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildMermaidDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

export const mermaidTheme = EditorView.baseTheme({
  ".cm-mermaid-widget": {
    padding: "12px",
    background: "rgba(49, 50, 68, 0.4)",
    borderRadius: "6px",
    margin: "4px 0",
    textAlign: "center",
    overflowX: "auto",
  },
  ".cm-mermaid-inner svg": {
    maxWidth: "100%",
  },
  ".cm-mermaid-source": {
    fontSize: "0",
    lineHeight: "0",
    height: "0",
    overflow: "hidden",
  },
});
