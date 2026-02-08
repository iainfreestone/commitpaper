import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";

// ──────────────────────────────────────────────
// Live Preview: Obsidian-style inline rendering
// Single unified view — raw markdown is revealed
// only when the cursor is on that line.
// ──────────────────────────────────────────────

// --- Heading decorations ---
const headingDecos: Record<string, Decoration> = {};
for (let i = 1; i <= 6; i++) {
  headingDecos[`ATXHeading${i}`] = Decoration.line({
    class: `cm-heading cm-heading-${i}`,
  });
}
const headingMarkHide = Decoration.replace({ class: "cm-heading-mark" });

// --- Inline format decorations ---
const boldDeco = Decoration.mark({ class: "cm-md-bold" });
const italicDeco = Decoration.mark({ class: "cm-md-italic" });
const codeInlineDeco = Decoration.mark({ class: "cm-md-code-inline" });
const strikeDeco = Decoration.mark({ class: "cm-md-strikethrough" });
const highlightDeco = Decoration.mark({ class: "cm-md-highlight" });
const blockquoteDeco = Decoration.line({ class: "cm-md-blockquote" });
const hrDeco = Decoration.line({ class: "cm-md-hr" });
const syntaxHide = Decoration.replace({});
const linkTextDeco = Decoration.mark({ class: "cm-md-link-text" });
const listBulletDeco = Decoration.mark({ class: "cm-md-list-bullet" });

// --- Link widget (for hiding [text](url) syntax) ---
class LinkWidget extends WidgetType {
  constructor(
    readonly text: string,
    readonly url: string,
  ) {
    super();
  }
  toDOM() {
    const a = document.createElement("a");
    a.className = "cm-md-link-rendered";
    a.textContent = this.text;
    a.title = this.url;
    a.href = this.url;
    a.addEventListener("click", (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        window.open(this.url, "_blank");
      }
    });
    return a;
  }
  ignoreEvent() {
    return false;
  }
  eq(other: LinkWidget) {
    return this.text === other.text && this.url === other.url;
  }
}

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
const LINK_RE = /(?<!!)\[([^\]]+)\]\(([^)]+)\)/g;
const BLOCKQUOTE_MARKER_RE = /^(\s*>+\s?)/;
const LIST_BULLET_RE = /^(\s*)([-*+]|\d+[.)])\s/;

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

function isInSelection(
  pos: number,
  endPos: number,
  selections: readonly { from: number; to: number }[],
) {
  for (const sel of selections) {
    if (sel.from <= endPos && sel.to >= pos) return true;
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

  const decos: { from: number; to: number; deco: Decoration }[] = [];

  // ── Syntax tree walk ──
  tree.iterate({
    enter(node) {
      // Headings
      for (let i = 1; i <= 6; i++) {
        if (node.name === `ATXHeading${i}`) {
          const line = doc.lineAt(node.from);
          // Always apply heading style
          decos.push({
            from: line.from,
            to: line.from,
            deco: headingDecos[`ATXHeading${i}`],
          });
          // Hide # marks when cursor is not on the line
          if (!cursorOnLine(line.from, line.to, selections)) {
            const hashEnd = line.text.indexOf(" ");
            if (hashEnd > 0) {
              decos.push({
                from: line.from,
                to: line.from + hashEnd + 1,
                deco: headingMarkHide,
              });
            }
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
          // Hide the > marker when cursor not on line
          if (!cursorOnLine(line.from, line.to, selections)) {
            const bqMatch = BLOCKQUOTE_MARKER_RE.exec(line.text);
            if (bqMatch) {
              decos.push({
                from: line.from,
                to: line.from + bqMatch[0].length,
                deco: syntaxHide,
              });
            }
          }
        }
      }
    },
  });

  // ── Per-line inline formatting ──
  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    const text = line.text;
    const onLine = cursorOnLine(line.from, line.to, selections);

    // Horizontal rules
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(text.trim())) {
      if (!onLine) {
        decos.push({ from: line.from, to: line.from, deco: hrDeco });
      }
    }

    // List bullets — style them subtly when not editing
    const listMatch = LIST_BULLET_RE.exec(text);
    if (listMatch && !onLine) {
      const bulletStart = line.from + listMatch[1].length;
      const bulletEnd = bulletStart + listMatch[2].length;
      decos.push({ from: bulletStart, to: bulletEnd, deco: listBulletDeco });
    }

    // Bold — hide ** markers, apply bold style to content
    BOLD_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = BOLD_RE.exec(text)) !== null) {
      const start = line.from + match.index;
      const end = start + match[0].length;
      const markerLen = match[0].startsWith("**") ? 2 : 2; // ** or __
      if (!isInSelection(start, end, selections)) {
        // Hide opening marker
        decos.push({ from: start, to: start + markerLen, deco: syntaxHide });
        // Style the content
        decos.push({
          from: start + markerLen,
          to: end - markerLen,
          deco: boldDeco,
        });
        // Hide closing marker
        decos.push({ from: end - markerLen, to: end, deco: syntaxHide });
      } else {
        // Cursor on this range — still apply style but show markers
        decos.push({ from: start, to: end, deco: boldDeco });
      }
    }

    // Italic — hide * markers, apply italic style
    ITALIC_RE.lastIndex = 0;
    while ((match = ITALIC_RE.exec(text)) !== null) {
      const start = line.from + match.index;
      const end = start + match[0].length;
      if (!isInSelection(start, end, selections)) {
        decos.push({ from: start, to: start + 1, deco: syntaxHide });
        decos.push({ from: start + 1, to: end - 1, deco: italicDeco });
        decos.push({ from: end - 1, to: end, deco: syntaxHide });
      } else {
        decos.push({ from: start, to: end, deco: italicDeco });
      }
    }

    // Inline code — hide backticks, style content
    CODE_INLINE_RE.lastIndex = 0;
    while ((match = CODE_INLINE_RE.exec(text)) !== null) {
      const start = line.from + match.index;
      const end = start + match[0].length;
      if (!isInSelection(start, end, selections)) {
        decos.push({ from: start, to: start + 1, deco: syntaxHide });
        decos.push({ from: start + 1, to: end - 1, deco: codeInlineDeco });
        decos.push({ from: end - 1, to: end, deco: syntaxHide });
      } else {
        decos.push({ from: start, to: end, deco: codeInlineDeco });
      }
    }

    // Strikethrough — hide ~~ markers
    STRIKE_RE.lastIndex = 0;
    while ((match = STRIKE_RE.exec(text)) !== null) {
      const start = line.from + match.index;
      const end = start + match[0].length;
      if (!isInSelection(start, end, selections)) {
        decos.push({ from: start, to: start + 2, deco: syntaxHide });
        decos.push({ from: start + 2, to: end - 2, deco: strikeDeco });
        decos.push({ from: end - 2, to: end, deco: syntaxHide });
      } else {
        decos.push({ from: start, to: end, deco: strikeDeco });
      }
    }

    // Highlight — hide == markers
    HIGHLIGHT_RE.lastIndex = 0;
    while ((match = HIGHLIGHT_RE.exec(text)) !== null) {
      const start = line.from + match.index;
      const end = start + match[0].length;
      if (!isInSelection(start, end, selections)) {
        decos.push({ from: start, to: start + 2, deco: syntaxHide });
        decos.push({ from: start + 2, to: end - 2, deco: highlightDeco });
        decos.push({ from: end - 2, to: end, deco: syntaxHide });
      } else {
        decos.push({ from: start, to: end, deco: highlightDeco });
      }
    }

    // Links [text](url) — replace with styled text when cursor not on line
    LINK_RE.lastIndex = 0;
    while ((match = LINK_RE.exec(text)) !== null) {
      const start = line.from + match.index;
      const end = start + match[0].length;
      const linkText = match[1];
      const linkUrl = match[2];
      if (!isInSelection(start, end, selections)) {
        // Replace the entire [text](url) with just the styled text
        decos.push({
          from: start,
          to: end,
          deco: Decoration.replace({
            widget: new LinkWidget(linkText, linkUrl),
          }),
        });
      }
    }

    // Images — render widget below line when cursor is NOT on line
    IMAGE_RE.lastIndex = 0;
    while ((match = IMAGE_RE.exec(text)) !== null) {
      const alt = match[1];
      const url = match[2];
      const start = line.from + match.index;
      const end = start + match[0].length;
      if (!onLine) {
        // Hide the raw markdown syntax
        decos.push({ from: start, to: end, deco: syntaxHide });
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
    builder.add(d.from, d.to, d.deco);
  }

  return builder.finish();
}

const livePreviewPluginRef = ViewPlugin.fromClass(
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
);

// Block decorations (images, line decorations) must be provided via the facet
export const livePreviewPlugin = [
  livePreviewPluginRef,
  EditorView.decorations.of(
    (view: EditorView) =>
      view.plugin(livePreviewPluginRef)?.decorations ?? Decoration.none,
  ),
];

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

  // Links
  ".cm-md-link-rendered": {
    color: "#89b4fa",
    textDecoration: "none",
    cursor: "pointer",
    borderBottom: "1px solid rgba(137, 180, 250, 0.3)",
    "&:hover": {
      borderBottomColor: "#89b4fa",
    },
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

  // List bullets
  ".cm-md-list-bullet": {
    color: "#89b4fa",
    fontWeight: "700",
  },
});
