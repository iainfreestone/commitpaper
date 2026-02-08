import {
  Decoration,
  DecorationSet,
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";

// ──────────────────────────────────────────────
// Callouts / Admonitions  (Obsidian-style)
// Syntax:  > [!type] Optional title
//          > content line …
// Types: note, tip, info, warning, danger, bug, example, quote, abstract, todo, success, question, failure
// ──────────────────────────────────────────────

const CALLOUT_START_RE = /^>\s*\[!(\w+)\]([+-])?\s*(.*)/;
const CALLOUT_CONT_RE = /^>\s?(.*)/;

interface CalloutInfo {
  type: string;
  title: string;
  foldable: boolean;
  collapsed: boolean;
  startLine: number;
  endLine: number;
}

const CALLOUT_ICONS: Record<string, string> = {
  note: "📝",
  tip: "💡",
  info: "ℹ️",
  warning: "⚠️",
  danger: "🔴",
  bug: "🐛",
  example: "📋",
  quote: "💬",
  abstract: "📄",
  todo: "☑️",
  success: "✅",
  question: "❓",
  failure: "❌",
  caution: "⚠️",
  important: "❗",
};

const CALLOUT_COLORS: Record<string, string> = {
  note: "#89b4fa",
  tip: "#a6e3a1",
  info: "#89dceb",
  warning: "#f9e2af",
  danger: "#f38ba8",
  bug: "#f38ba8",
  example: "#cba6f7",
  quote: "#a6adc8",
  abstract: "#89dceb",
  todo: "#89b4fa",
  success: "#a6e3a1",
  question: "#f9e2af",
  failure: "#f38ba8",
  caution: "#fab387",
  important: "#fab387",
};

// Callout title widget
class CalloutTitleWidget extends WidgetType {
  constructor(
    readonly type: string,
    readonly title: string,
    readonly foldable: boolean,
    readonly collapsed: boolean,
  ) {
    super();
  }

  toDOM() {
    const wrap = document.createElement("div");
    const color = CALLOUT_COLORS[this.type] || CALLOUT_COLORS.note;
    wrap.className = "cm-callout-title";
    wrap.style.borderLeft = `3px solid ${color}`;
    wrap.style.background = `${color}12`;

    const icon = document.createElement("span");
    icon.className = "cm-callout-icon";
    icon.textContent = CALLOUT_ICONS[this.type] || CALLOUT_ICONS.note;
    wrap.appendChild(icon);

    const label = document.createElement("span");
    label.className = "cm-callout-label";
    label.style.color = color;
    label.textContent =
      this.title || this.type.charAt(0).toUpperCase() + this.type.slice(1);
    wrap.appendChild(label);

    return wrap;
  }

  eq(other: CalloutTitleWidget) {
    return this.type === other.type && this.title === other.title;
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

function buildCalloutDecorations(view: EditorView): DecorationSet {
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
    const match = CALLOUT_START_RE.exec(line.text);

    if (match) {
      const type = match[1].toLowerCase();
      const foldMarker = match[2] || "";
      const title = match[3]?.trim() || "";
      const foldable = foldMarker === "+" || foldMarker === "-";
      const collapsed = foldMarker === "-";
      const color = CALLOUT_COLORS[type] || CALLOUT_COLORS.note;

      // Check if cursor is on this callout block
      let endLine = i;
      let nextLine = i + 1;
      while (nextLine <= doc.lines) {
        const nl = doc.line(nextLine);
        if (CALLOUT_CONT_RE.test(nl.text) && !CALLOUT_START_RE.test(nl.text)) {
          endLine = nextLine;
          nextLine++;
        } else {
          break;
        }
      }

      const blockFrom = line.from;
      const blockTo = doc.line(endLine).to;
      const cursorInBlock = isOnLine(blockFrom, blockTo, selections);

      if (!cursorInBlock) {
        // Replace the first line with a callout title widget
        decos.push({
          from: line.from,
          to: line.from,
          deco: Decoration.widget({
            widget: new CalloutTitleWidget(type, title, foldable, collapsed),
            block: true,
          }),
        });

        // Hide the raw > [!type] line
        decos.push({
          from: line.from,
          to: line.from,
          deco: Decoration.line({ class: "cm-callout-raw-hide" }),
        });

        // Style continuation lines
        for (let j = i + 1; j <= endLine; j++) {
          const cl = doc.line(j);
          decos.push({
            from: cl.from,
            to: cl.from,
            deco: Decoration.line({
              class: "cm-callout-body",
              attributes: {
                style: `border-left: 3px solid ${color}; background: ${color}08;`,
              },
            }),
          });
        }
      } else {
        // Cursor is in the block — just add subtle left border styling
        for (let j = i; j <= endLine; j++) {
          const cl = doc.line(j);
          decos.push({
            from: cl.from,
            to: cl.from,
            deco: Decoration.line({
              class: "cm-callout-editing",
              attributes: {
                style: `border-left: 3px solid ${color}; padding-left: 12px;`,
              },
            }),
          });
        }
      }

      i = endLine + 1;
      continue;
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

const calloutPluginRef = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildCalloutDecorations(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildCalloutDecorations(update.view);
      }
    }
  },
);

// Block decorations must be provided via the facet, not the plugin's decorations option
export const calloutPlugin = [
  calloutPluginRef,
  EditorView.decorations.of(
    (view: EditorView) =>
      view.plugin(calloutPluginRef)?.decorations ?? Decoration.none,
  ),
];

export const calloutTheme = EditorView.baseTheme({
  ".cm-callout-title": {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 12px",
    borderRadius: "4px 4px 0 0",
    fontWeight: "600",
    fontSize: "14px",
  },
  ".cm-callout-icon": {
    fontSize: "16px",
  },
  ".cm-callout-label": {
    fontWeight: "600",
  },
  ".cm-callout-raw-hide": {
    fontSize: "0",
    lineHeight: "0",
    height: "0",
    overflow: "hidden",
  },
  ".cm-callout-body": {
    paddingLeft: "16px",
  },
  ".cm-callout-editing": {
    /* applied via inline style */
  },
});
