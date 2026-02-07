import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { RangeSetBuilder, EditorSelection } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";

// ──────────────────────────────────────────────
// Live Preview: Obsidian-style inline rendering
// ──────────────────────────────────────────────

// --- Heading decorations ---
const headingDecos: Record<string, Decoration> = {};
for (let i = 1; i <= 6; i++) {
  headingDecos[`ATXHeading${i}`] = Decoration.line({
    class: `cm-heading cm-heading-${i}`,
  });
}
const headingMarkDeco = Decoration.mark({ class: "cm-heading-mark" });

// --- Inline format decorations ---
const boldDeco = Decoration.mark({ class: "cm-md-bold" });
const italicDeco = Decoration.mark({ class: "cm-md-italic" });
const codeInlineDeco = Decoration.mark({ class: "cm-md-code-inline" });
const strikeDeco = Decoration.mark({ class: "cm-md-strikethrough" });
const highlightDeco = Decoration.mark({ class: "cm-md-highlight" });
const blockquoteDeco = Decoration.line({ class: "cm-md-blockquote" });
const hrDeco = Decoration.line({ class: "cm-md-hr" });
const listItemDeco = Decoration.mark({ class: "cm-md-list-marker" });

// --- Horizontal rule widget ---
class HrWidget extends WidgetType {
  toDOM() {
    const el = document.createElement("hr");
    el.className = "cm-hr-widget";
    return el;
  }
  ignoreEvent() {
    return true;
  }
}

// --- Image widget ---
class ImageWidget extends WidgetType {
  constructor(
    readonly url: string,
    readonly alt: string,
  ) {
    super();
  }
  toDOM() {
    const wrap = document.createElement("div");
    wrap.className = "cm-image-widget";
    const img = document.createElement("img");
    img.src = this.url;
    img.alt = this.alt;
    img.style.maxWidth = "100%";
    img.style.borderRadius = "6px";
    img.onerror = () => {
      wrap.textContent = `[Image: ${this.alt}]`;
    };
    wrap.appendChild(img);
    return wrap;
  }
  ignoreEvent() {
    return true;
  }
  eq(other: ImageWidget) {
    return this.url === other.url;
  }
}

// --- Regex patterns ---
const BOLD_RE = /\*\*(.+?)\*\*|__(.+?)__/g;
const ITALIC_RE =
  /(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)|(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g;
const CODE_INLINE_RE = /`([^`]+)`/g;
const STRIKE_RE = /~~(.+?)~~/g;
const HIGHLIGHT_RE = /==(.+?)==/g;
const IMAGE_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;

function isInSelection(
  pos: number,
  endPos: number,
  selections: readonly { from: number; to: number }[],
) {
  for (const sel of selections) {
    // Cursor is inside or selection overlaps
    if (sel.from <= endPos && sel.to >= pos) return true;
  }
  return false;
}

function cursorOnLine(
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

function buildLivePreviewDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc;
  const selections = view.state.selection.ranges.map((r) => ({
    from: r.from,
    to: r.to,
  }));
  const tree = syntaxTree(view.state);

  // Collect decorations in an array, then sort by `from` position
  const decos: { from: number; to: number; deco: Decoration }[] = [];

  // Walk the syntax tree for headings and blockquotes
  tree.iterate({
    enter(node) {
      // Headings
      for (let i = 1; i <= 6; i++) {
        if (node.name === `ATXHeading${i}`) {
          const line = doc.lineAt(node.from);
          if (!cursorOnLine(line.from, line.to, selections)) {
            decos.push({
              from: line.from,
              to: line.from,
              deco: headingDecos[`ATXHeading${i}`],
            });
            // Hide the # marks
            const hashEnd = line.text.indexOf(" ");
            if (hashEnd > 0) {
              decos.push({
                from: line.from,
                to: line.from + hashEnd + 1,
                deco: headingMarkDeco,
              });
            }
          } else {
            // Still apply heading style, just don't hide marks
            decos.push({
              from: line.from,
              to: line.from,
              deco: headingDecos[`ATXHeading${i}`],
            });
          }
        }
      }

      // Blockquotes
      if (node.name === "Blockquote") {
        const startLine = doc.lineAt(node.from);
        const endLine = doc.lineAt(node.to);
        for (
          let lineNo = startLine.number;
          lineNo <= endLine.number;
          lineNo++
        ) {
          const line = doc.line(lineNo);
          decos.push({ from: line.from, to: line.from, deco: blockquoteDeco });
        }
      }
    },
  });

  // Process each line for inline formatting
  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    const text = line.text;

    // Horizontal rules
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(text.trim())) {
      if (!cursorOnLine(line.from, line.to, selections)) {
        decos.push({
          from: line.from,
          to: line.from,
          deco: hrDeco,
        });
      }
    }

    // Bold
    BOLD_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = BOLD_RE.exec(text)) !== null) {
      const start = line.from + match.index;
      const end = start + match[0].length;
      if (!isInSelection(start, end, selections)) {
        decos.push({ from: start, to: end, deco: boldDeco });
      }
    }

    // Italic
    ITALIC_RE.lastIndex = 0;
    while ((match = ITALIC_RE.exec(text)) !== null) {
      const start = line.from + match.index;
      const end = start + match[0].length;
      if (!isInSelection(start, end, selections)) {
        decos.push({ from: start, to: end, deco: italicDeco });
      }
    }

    // Inline code
    CODE_INLINE_RE.lastIndex = 0;
    while ((match = CODE_INLINE_RE.exec(text)) !== null) {
      const start = line.from + match.index;
      const end = start + match[0].length;
      if (!isInSelection(start, end, selections)) {
        decos.push({ from: start, to: end, deco: codeInlineDeco });
      }
    }

    // Strikethrough
    STRIKE_RE.lastIndex = 0;
    while ((match = STRIKE_RE.exec(text)) !== null) {
      const start = line.from + match.index;
      const end = start + match[0].length;
      if (!isInSelection(start, end, selections)) {
        decos.push({ from: start, to: end, deco: strikeDeco });
      }
    }

    // Highlight
    HIGHLIGHT_RE.lastIndex = 0;
    while ((match = HIGHLIGHT_RE.exec(text)) !== null) {
      const start = line.from + match.index;
      const end = start + match[0].length;
      if (!isInSelection(start, end, selections)) {
        decos.push({ from: start, to: end, deco: highlightDeco });
      }
    }

    // Images — render widget below line when cursor is NOT on line
    IMAGE_RE.lastIndex = 0;
    while ((match = IMAGE_RE.exec(text)) !== null) {
      const alt = match[1];
      const url = match[2];
      const start = line.from + match.index;
      const end = start + match[0].length;
      if (!cursorOnLine(line.from, line.to, selections)) {
        decos.push({
          from: end,
          to: end,
          deco: Decoration.widget({
            widget: new ImageWidget(url, alt),
            block: true,
          }),
        });
      }
    }
  }

  // Sort decorations by position (required by RangeSetBuilder)
  decos.sort((a, b) => {
    if (a.from !== b.from) return a.from - b.from;
    // Line decorations (to === from) should come first
    if (a.to === a.from && b.to !== b.from) return -1;
    if (b.to === b.from && a.to !== a.from) return 1;
    return a.to - b.to;
  });

  for (const d of decos) {
    if (d.from === d.to) {
      builder.add(d.from, d.to, d.deco);
    } else {
      builder.add(d.from, d.to, d.deco);
    }
  }

  return builder.finish();
}

export const livePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildLivePreviewDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = buildLivePreviewDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

export const livePreviewTheme = EditorView.baseTheme({
  // Headings
  ".cm-heading": {
    fontWeight: "700",
    lineHeight: "1.3",
  },
  ".cm-heading-1": { fontSize: "2em", color: "#cdd6f4" },
  ".cm-heading-2": { fontSize: "1.6em", color: "#cdd6f4" },
  ".cm-heading-3": { fontSize: "1.3em", color: "#cdd6f4" },
  ".cm-heading-4": { fontSize: "1.15em", color: "#bac2de" },
  ".cm-heading-5": { fontSize: "1.05em", color: "#bac2de" },
  ".cm-heading-6": { fontSize: "1em", color: "#a6adc8" },
  ".cm-heading-mark": {
    opacity: "0.3",
    fontSize: "0.7em",
  },

  // Bold / Italic / Strike
  ".cm-md-bold": { fontWeight: "700" },
  ".cm-md-italic": { fontStyle: "italic" },
  ".cm-md-strikethrough": { textDecoration: "line-through", opacity: "0.7" },
  ".cm-md-highlight": {
    backgroundColor: "rgba(249, 226, 175, 0.25)",
    borderRadius: "2px",
    padding: "0 2px",
  },

  // Inline code
  ".cm-md-code-inline": {
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    backgroundColor: "rgba(49, 50, 68, 0.8)",
    borderRadius: "3px",
    padding: "1px 4px",
    fontSize: "0.9em",
    color: "#f38ba8",
  },

  // Blockquote
  ".cm-md-blockquote": {
    borderLeft: "3px solid #89b4fa",
    paddingLeft: "12px",
    color: "#a6adc8",
    fontStyle: "italic",
  },

  // HR
  ".cm-md-hr": {
    overflow: "hidden",
  },
  ".cm-hr-widget": {
    border: "none",
    borderTop: "1px solid #585b70",
    margin: "8px 0",
  },

  // Images
  ".cm-image-widget": {
    padding: "8px 0",
  },
  ".cm-image-widget img": {
    maxWidth: "100%",
    borderRadius: "6px",
    boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
  },

  // List markers
  ".cm-md-list-marker": {
    color: "#89b4fa",
    fontWeight: "700",
  },
});
