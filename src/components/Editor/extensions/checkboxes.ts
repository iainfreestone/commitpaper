import {
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
  Decoration,
  DecorationSet,
} from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";

// ──────────────────────────────────────────────
// Interactive Checkboxes: click to toggle - [ ] / - [x]
// ──────────────────────────────────────────────

const CHECKBOX_RE = /^(\s*[-*+]\s+)\[([ xX])\]/;

class CheckboxWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    readonly linePos: number,
  ) {
    super();
  }

  toDOM(view: EditorView) {
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = this.checked;
    cb.className = "cm-checkbox-widget";
    cb.setAttribute(
      "aria-label",
      this.checked ? "Completed task" : "Incomplete task",
    );

    cb.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();

      const line = view.state.doc.lineAt(this.linePos);
      const text = line.text;
      const match = text.match(CHECKBOX_RE);
      if (match) {
        const bracketStart = line.from + match[1].length;
        const newChar = this.checked ? " " : "x";
        view.dispatch({
          changes: {
            from: bracketStart + 1,
            to: bracketStart + 2,
            insert: newChar,
          },
        });
      }
    });

    return cb;
  }

  ignoreEvent() {
    return false;
  }
  eq(other: CheckboxWidget) {
    return this.checked === other.checked && this.linePos === other.linePos;
  }
}

function buildCheckboxDecos(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc;

  for (let i = 1; i <= doc.lines; i++) {
    const line = doc.line(i);
    const match = line.text.match(CHECKBOX_RE);
    if (match) {
      const bracketStart = line.from + match[1].length;
      const bracketEnd = bracketStart + 3; // [x] or [ ]
      const checked = match[2] === "x" || match[2] === "X";

      // Replace the [ ] / [x] with a checkbox widget
      builder.add(
        bracketStart,
        bracketEnd,
        Decoration.replace({
          widget: new CheckboxWidget(checked, line.from),
        }),
      );

      // If checked, style the remaining text with strikethrough
      if (checked) {
        const textStart = bracketEnd;
        const textEnd = line.to;
        if (textEnd > textStart) {
          builder.add(
            textStart,
            textEnd,
            Decoration.mark({ class: "cm-checkbox-checked-text" }),
          );
        }
      }
    }
  }

  return builder.finish();
}

export const checkboxPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildCheckboxDecos(view);
    }
    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = buildCheckboxDecos(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

export const checkboxTheme = EditorView.baseTheme({
  ".cm-checkbox-widget": {
    appearance: "none",
    width: "16px",
    height: "16px",
    border: "2px solid #585b70",
    borderRadius: "3px",
    backgroundColor: "transparent",
    cursor: "pointer",
    verticalAlign: "middle",
    position: "relative",
    marginRight: "4px",
    transition: "all 0.15s ease",
  },
  ".cm-checkbox-widget:checked": {
    backgroundColor: "#89b4fa",
    borderColor: "#89b4fa",
  },
  ".cm-checkbox-widget:checked::after": {
    content: '""',
    position: "absolute",
    left: "4px",
    top: "1px",
    width: "5px",
    height: "9px",
    border: "solid #1e1e2e",
    borderWidth: "0 2px 2px 0",
    transform: "rotate(45deg)",
  },
  ".cm-checkbox-widget:hover": {
    borderColor: "#89b4fa",
  },
  ".cm-checkbox-checked-text": {
    textDecoration: "line-through",
    opacity: "0.5",
  },
});
