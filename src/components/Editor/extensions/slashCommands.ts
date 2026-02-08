// ============================================================
// Slash Commands — type "/" at start of line to see a menu
// ============================================================

import {
  EditorView,
  ViewPlugin,
  ViewUpdate,
  WidgetType,
  Decoration,
  type DecorationSet,
} from "@codemirror/view";
import { StateField, StateEffect } from "@codemirror/state";
import {
  formatHeading1,
  formatHeading2,
  formatHeading3,
  formatBulletList,
  formatNumberedList,
  formatCheckbox,
  formatBlockquote,
  insertCodeBlock,
  insertTable,
  insertHorizontalRule,
  insertCallout,
  insertMathBlock,
} from "./formatting";

// ============================================================
// Slash command definitions
// ============================================================

interface SlashCommand {
  label: string;
  description: string;
  icon: string;
  category: string;
  action: (view: EditorView) => void;
}

const slashCommands: SlashCommand[] = [
  {
    label: "Heading 1",
    description: "Large heading",
    icon: "H1",
    category: "Text",
    action: (v) => {
      clearSlash(v);
      formatHeading1(v);
    },
  },
  {
    label: "Heading 2",
    description: "Medium heading",
    icon: "H2",
    category: "Text",
    action: (v) => {
      clearSlash(v);
      formatHeading2(v);
    },
  },
  {
    label: "Heading 3",
    description: "Small heading",
    icon: "H3",
    category: "Text",
    action: (v) => {
      clearSlash(v);
      formatHeading3(v);
    },
  },
  {
    label: "Bullet List",
    description: "Unordered list item",
    icon: "•",
    category: "Lists",
    action: (v) => {
      clearSlash(v);
      formatBulletList(v);
    },
  },
  {
    label: "Numbered List",
    description: "Ordered list item",
    icon: "1.",
    category: "Lists",
    action: (v) => {
      clearSlash(v);
      formatNumberedList(v);
    },
  },
  {
    label: "To-do",
    description: "Checkbox task item",
    icon: "☐",
    category: "Lists",
    action: (v) => {
      clearSlash(v);
      formatCheckbox(v);
    },
  },
  {
    label: "Quote",
    description: "Blockquote",
    icon: "❝",
    category: "Blocks",
    action: (v) => {
      clearSlash(v);
      formatBlockquote(v);
    },
  },
  {
    label: "Code Block",
    description: "Fenced code block",
    icon: "⟨/⟩",
    category: "Blocks",
    action: (v) => {
      clearSlash(v);
      insertCodeBlock(v);
    },
  },
  {
    label: "Table",
    description: "3-column table",
    icon: "⊞",
    category: "Blocks",
    action: (v) => {
      clearSlash(v);
      insertTable(v);
    },
  },
  {
    label: "Horizontal Rule",
    description: "Divider line",
    icon: "─",
    category: "Blocks",
    action: (v) => {
      clearSlash(v);
      insertHorizontalRule(v);
    },
  },
  {
    label: "Math Block",
    description: "LaTeX equation",
    icon: "∑",
    category: "Blocks",
    action: (v) => {
      clearSlash(v);
      insertMathBlock(v);
    },
  },
  {
    label: "Callout — Note",
    description: "Info callout",
    icon: "ℹ",
    category: "Callouts",
    action: (v) => {
      clearSlash(v);
      insertCallout(v, "note");
    },
  },
  {
    label: "Callout — Tip",
    description: "Tip callout",
    icon: "💡",
    category: "Callouts",
    action: (v) => {
      clearSlash(v);
      insertCallout(v, "tip");
    },
  },
  {
    label: "Callout — Warning",
    description: "Warning callout",
    icon: "⚠",
    category: "Callouts",
    action: (v) => {
      clearSlash(v);
      insertCallout(v, "warning");
    },
  },
  {
    label: "Callout — Important",
    description: "Important callout",
    icon: "❗",
    category: "Callouts",
    action: (v) => {
      clearSlash(v);
      insertCallout(v, "important");
    },
  },
];

/** Remove the slash + query text from the current line */
function clearSlash(view: EditorView) {
  const cursor = view.state.selection.main.head;
  const line = view.state.doc.lineAt(cursor);
  const match = line.text.match(/^(\s*)\/\S*/);
  if (match) {
    view.dispatch({
      changes: {
        from: line.from,
        to: line.from + match[0].length,
        insert: match[1],
      },
    });
  }
}

// ============================================================
// Slash menu widget (rendered as a DOM overlay)
// ============================================================

class SlashMenuWidget extends WidgetType {
  constructor(
    private commands: SlashCommand[],
    private selectedIndex: number,
    private view: EditorView,
  ) {
    super();
  }

  toDOM() {
    const container = document.createElement("div");
    container.className = "slash-menu";

    if (this.commands.length === 0) {
      const empty = document.createElement("div");
      empty.className = "slash-menu-empty";
      empty.textContent = "No matching commands";
      container.appendChild(empty);
      return container;
    }

    let currentCategory = "";
    this.commands.forEach((cmd, i) => {
      if (cmd.category !== currentCategory) {
        currentCategory = cmd.category;
        const cat = document.createElement("div");
        cat.className = "slash-menu-category";
        cat.textContent = currentCategory;
        container.appendChild(cat);
      }

      const item = document.createElement("div");
      item.className = `slash-menu-item${i === this.selectedIndex ? " selected" : ""}`;

      const icon = document.createElement("span");
      icon.className = "slash-menu-icon";
      icon.textContent = cmd.icon;

      const textWrap = document.createElement("div");
      textWrap.className = "slash-menu-text";

      const label = document.createElement("span");
      label.className = "slash-menu-label";
      label.textContent = cmd.label;

      const desc = document.createElement("span");
      desc.className = "slash-menu-desc";
      desc.textContent = cmd.description;

      textWrap.appendChild(label);
      textWrap.appendChild(desc);
      item.appendChild(icon);
      item.appendChild(textWrap);

      item.addEventListener("mousedown", (e) => {
        e.preventDefault();
        cmd.action(this.view);
        this.view.focus();
      });

      container.appendChild(item);
    });

    return container;
  }

  ignoreEvent() {
    return false;
  }
}

// ============================================================
// State management
// ============================================================

interface SlashState {
  active: boolean;
  query: string;
  selectedIndex: number;
  from: number; // position of the /
}

const setSlashState = StateEffect.define<SlashState | null>();

const slashState = StateField.define<SlashState | null>({
  create: () => null,
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setSlashState)) return e.value;
    }
    return value;
  },
});

function getFilteredCommands(query: string): SlashCommand[] {
  if (!query) return slashCommands;
  const q = query.toLowerCase();
  return slashCommands.filter(
    (c) =>
      c.label.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.category.toLowerCase().includes(q),
  );
}

// ============================================================
// Plugin that manages the slash menu lifecycle
// ============================================================

const slashCommandPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(private view: EditorView) {
      this.decorations = Decoration.none;
    }

    update(update: ViewUpdate) {
      const state = update.state.field(slashState);
      if (!state?.active) {
        this.decorations = Decoration.none;
        return;
      }

      const filtered = getFilteredCommands(state.query);
      const cursor = update.state.selection.main.head;
      const widget = new SlashMenuWidget(
        filtered,
        state.selectedIndex,
        this.view,
      );
      this.decorations = Decoration.set([
        Decoration.widget({ widget, side: 1 }).range(cursor),
      ]);
    }
  },
);

// ============================================================
// Key handler for slash commands
// ============================================================

const slashKeyHandler = EditorView.domEventHandlers({
  keydown(e: KeyboardEvent, view: EditorView) {
    const state = view.state.field(slashState);

    // Detect "/" typed on an empty or whitespace-only line
    if (!state?.active && e.key === "/") {
      const cursor = view.state.selection.main.head;
      const line = view.state.doc.lineAt(cursor);
      const textBefore = line.text.substring(0, cursor - line.from);
      if (textBefore.trim() === "") {
        // Activate slash menu after the / is inserted
        setTimeout(() => {
          view.dispatch({
            effects: setSlashState.of({
              active: true,
              query: "",
              selectedIndex: 0,
              from: cursor,
            }),
          });
        }, 0);
        return false; // Let the "/" be typed
      }
      return false;
    }

    if (!state?.active) return false;

    if (e.key === "Escape") {
      e.preventDefault();
      view.dispatch({ effects: setSlashState.of(null) });
      return true;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const filtered = getFilteredCommands(state.query);
      const newIdx = Math.min(state.selectedIndex + 1, filtered.length - 1);
      view.dispatch({
        effects: setSlashState.of({ ...state, selectedIndex: newIdx }),
      });
      return true;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      const newIdx = Math.max(state.selectedIndex - 1, 0);
      view.dispatch({
        effects: setSlashState.of({ ...state, selectedIndex: newIdx }),
      });
      return true;
    }

    if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      const filtered = getFilteredCommands(state.query);
      if (filtered[state.selectedIndex]) {
        filtered[state.selectedIndex].action(view);
      }
      view.dispatch({ effects: setSlashState.of(null) });
      view.focus();
      return true;
    }

    if (e.key === "Backspace") {
      // If query is empty and we backspace, close the menu
      if (state.query === "") {
        // Let the backspace remove the "/" then close
        setTimeout(() => {
          view.dispatch({ effects: setSlashState.of(null) });
        }, 0);
        return false;
      }
      // Update query after backspace
      setTimeout(() => {
        const cursor = view.state.selection.main.head;
        const line = view.state.doc.lineAt(cursor);
        const slashIdx = line.text.lastIndexOf("/");
        if (slashIdx === -1) {
          view.dispatch({ effects: setSlashState.of(null) });
        } else {
          const newQuery = line.text.substring(
            slashIdx + 1,
            cursor - line.from,
          );
          view.dispatch({
            effects: setSlashState.of({
              ...state,
              query: newQuery,
              selectedIndex: 0,
            }),
          });
        }
      }, 0);
      return false;
    }

    // For regular character keys, update the query after the character is inserted
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      setTimeout(() => {
        const cursor = view.state.selection.main.head;
        const line = view.state.doc.lineAt(cursor);
        const slashIdx = line.text.lastIndexOf("/");
        if (slashIdx === -1) {
          view.dispatch({ effects: setSlashState.of(null) });
        } else {
          const newQuery = line.text.substring(
            slashIdx + 1,
            cursor - line.from,
          );
          view.dispatch({
            effects: setSlashState.of({
              ...state,
              query: newQuery,
              selectedIndex: 0,
            }),
          });
        }
      }, 0);
      return false;
    }

    return false;
  },
});

// ============================================================
// Exports
// ============================================================

export const slashCommandExtension = [
  slashState,
  slashCommandPlugin,
  EditorView.decorations.of(
    (view: EditorView) =>
      view.plugin(slashCommandPlugin)?.decorations ?? Decoration.none,
  ),
  slashKeyHandler,
];
