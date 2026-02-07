import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import katex from "katex";

// ──────────────────────────────────────────────
// KaTeX Math Rendering
// Inline:  $...$
// Block:   $$...$$  (multi-line)
// ──────────────────────────────────────────────

// Inline math widget
class InlineMathWidget extends WidgetType {
  constructor(readonly tex: string) {
    super();
  }

  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-math-inline";
    try {
      katex.render(this.tex, span, {
        throwOnError: false,
        displayMode: false,
        output: "html",
      });
    } catch {
      span.textContent = this.tex;
      span.style.color = "#f38ba8";
    }
    return span;
  }

  eq(other: InlineMathWidget) {
    return this.tex === other.tex;
  }

  ignoreEvent() {
    return true;
  }
}

// Block math widget
class BlockMathWidget extends WidgetType {
  constructor(readonly tex: string) {
    super();
  }

  toDOM() {
    const div = document.createElement("div");
    div.className = "cm-math-block";
    try {
      katex.render(this.tex, div, {
        throwOnError: false,
        displayMode: true,
        output: "html",
      });
    } catch {
      div.textContent = this.tex;
      div.style.color = "#f38ba8";
    }
    return div;
  }

  eq(other: BlockMathWidget) {
    return this.tex === other.tex;
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

// Inline math regex: $...$ (not $$)
const INLINE_MATH_RE = /(?<!\$)\$(?!\$)(.+?)(?<!\$)\$(?!\$)/g;

function buildMathDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc;
  const selections = view.state.selection.ranges.map((r) => ({
    from: r.from,
    to: r.to,
  }));

  const decos: { from: number; to: number; deco: Decoration }[] = [];

  // --- Block math: $$ ... $$ ---
  let i = 1;
  while (i <= doc.lines) {
    const line = doc.line(i);
    if (line.text.trim() === "$$") {
      // Find closing $$
      let endIdx = -1;
      for (let j = i + 1; j <= doc.lines; j++) {
        if (doc.line(j).text.trim() === "$$") {
          endIdx = j;
          break;
        }
      }

      if (endIdx > 0) {
        const blockFrom = line.from;
        const blockTo = doc.line(endIdx).to;

        if (!isOnLine(blockFrom, blockTo, selections)) {
          // Collect the TeX content
          const texLines: string[] = [];
          for (let j = i + 1; j < endIdx; j++) {
            texLines.push(doc.line(j).text);
          }
          const tex = texLines.join("\n");

          // Hide all lines of the block
          for (let j = i; j <= endIdx; j++) {
            decos.push({
              from: doc.line(j).from,
              to: doc.line(j).from,
              deco: Decoration.line({ class: "cm-math-block-source" }),
            });
          }

          // Add rendered widget after the opening $$
          decos.push({
            from: line.from,
            to: line.from,
            deco: Decoration.widget({
              widget: new BlockMathWidget(tex),
              block: true,
            }),
          });
        }

        i = endIdx + 1;
        continue;
      }
    }

    // --- Inline math ---
    INLINE_MATH_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = INLINE_MATH_RE.exec(line.text)) !== null) {
      const start = line.from + match.index;
      const end = start + match[0].length;
      const tex = match[1];

      if (!isOnLine(start, end, selections)) {
        // Replace inline math with rendered widget
        decos.push({
          from: start,
          to: end,
          deco: Decoration.replace({
            widget: new InlineMathWidget(tex),
          }),
        });
      }
    }

    i++;
  }

  // Sort by position
  decos.sort((a, b) => a.from - b.from || a.to - b.to);

  for (const d of decos) {
    builder.add(d.from, d.to, d.deco);
  }

  return builder.finish();
}

export const mathPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildMathDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildMathDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

export const mathTheme = EditorView.baseTheme({
  ".cm-math-inline": {
    padding: "0 2px",
  },
  ".cm-math-inline .katex": {
    fontSize: "1.05em",
  },
  ".cm-math-block": {
    padding: "12px 16px",
    textAlign: "center",
    background: "rgba(49, 50, 68, 0.4)",
    borderRadius: "6px",
    margin: "4px 0",
    overflowX: "auto",
  },
  ".cm-math-block .katex": {
    fontSize: "1.2em",
  },
  ".cm-math-block-source": {
    fontSize: "0",
    lineHeight: "0",
    height: "0",
    overflow: "hidden",
  },
});
