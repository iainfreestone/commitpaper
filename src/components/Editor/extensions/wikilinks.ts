import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";

const WIKILINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

export const wikilinkTheme = EditorView.baseTheme({
  ".cm-wikilink": {
    color: "#89b4fa",
    cursor: "pointer",
    borderBottom: "1px solid rgba(137, 180, 250, 0.3)",
    "&:hover": {
      borderBottomColor: "#89b4fa",
    },
  },
  ".cm-wikilink-bracket": {
    color: "#6c7086",
    fontSize: "0.9em",
  },
});

const wikilinkMark = Decoration.mark({ class: "cm-wikilink" });
const bracketMark = Decoration.mark({ class: "cm-wikilink-bracket" });

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc;

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    const text = line.text;
    let match: RegExpExecArray | null;

    WIKILINK_RE.lastIndex = 0;
    while ((match = WIKILINK_RE.exec(text)) !== null) {
      const start = line.from + match.index;
      const end = start + match[0].length;
      builder.add(start, start + 2, bracketMark);
      builder.add(start + 2, end - 2, wikilinkMark);
      builder.add(end - 2, end, bracketMark);
    }
  }

  return builder.finish();
}

export const wikilinkPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDecorations(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
    eventHandlers: {
      click: (e, view) => {
        // Require Ctrl (or Cmd on Mac) to follow wikilinks
        if (!e.ctrlKey && !e.metaKey) return false;

        const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
        if (pos === null) return false;

        const line = view.state.doc.lineAt(pos);
        const text = line.text;

        WIKILINK_RE.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = WIKILINK_RE.exec(text)) !== null) {
          const start = line.from + match.index;
          const end = start + match[0].length;

          if (pos >= start && pos <= end) {
            const target = match[1].trim();
            const event = new CustomEvent("wikilink-click", {
              detail: { target },
            });
            window.dispatchEvent(event);
            return true;
          }
        }
        return false;
      },
    },
  },
);
