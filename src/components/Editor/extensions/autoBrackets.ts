import { EditorView, KeyBinding, keymap } from "@codemirror/view";
import { EditorSelection } from "@codemirror/state";

// ──────────────────────────────────────────────
// Auto-bracket: typing [[ auto-inserts ]]
// Also handles other markdown pairs: **, ~~, ==
// ──────────────────────────────────────────────

const bracketBindings: KeyBinding[] = [
  {
    key: "[",
    run: (view) => {
      const { state } = view;
      // Check if the character before cursor is already [
      const pos = state.selection.main.head;
      if (pos > 0) {
        const charBefore = state.doc.sliceString(pos - 1, pos);
        if (charBefore === "[") {
          // Just typed second [, insert matching ]]
          const charAfter = state.doc.sliceString(pos, pos + 1);
          if (charAfter === "]") {
            // closeBrackets already added a ], add another ] and position cursor
            view.dispatch({
              changes: { from: pos, to: pos, insert: "[]" },
              selection: EditorSelection.cursor(pos),
            });
          } else {
            view.dispatch({
              changes: { from: pos, to: pos, insert: "]]" },
              selection: EditorSelection.cursor(pos),
            });
          }
          return true;
        }
      }
      return false; // Let default handling take over for single [
    },
  },
];

export const autoBracketKeymap = keymap.of(bracketBindings);
