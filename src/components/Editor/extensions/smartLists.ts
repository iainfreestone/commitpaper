// ============================================================
// Smart Lists — auto-continue lists on Enter, indent/outdent
// ============================================================

import { keymap } from "@codemirror/view";
import type { EditorView } from "@codemirror/view";

/** Handle Enter key in lists: continue the list, or end it if empty */
function smartEnter(view: EditorView): boolean {
  const { state } = view;
  const { head } = state.selection.main;
  const line = state.doc.lineAt(head);
  const text = line.text;

  // Check for list patterns
  const bulletMatch = text.match(/^(\s*)([-*+])\s(.*)$/);
  const numberedMatch = text.match(/^(\s*)(\d+)\.\s(.*)$/);
  const checkboxMatch = text.match(/^(\s*)- \[[ x]\]\s(.*)$/);

  if (checkboxMatch) {
    const [, indent, content] = checkboxMatch;
    if (content.trim() === "") {
      // Empty checkbox item — remove it and break out of list
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: "" },
      });
      return true;
    }
    // Continue with new unchecked checkbox
    view.dispatch({
      changes: { from: head, insert: `\n${indent}- [ ] ` },
    });
    // Move cursor to end of inserted text
    const newPos = head + 1 + indent.length + 6;
    view.dispatch({ selection: { anchor: newPos } });
    return true;
  }

  if (bulletMatch) {
    const [, indent, marker, content] = bulletMatch;
    if (content.trim() === "") {
      // Empty bullet — remove it
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: "" },
      });
      return true;
    }
    view.dispatch({
      changes: { from: head, insert: `\n${indent}${marker} ` },
    });
    const newPos = head + 1 + indent.length + 2;
    view.dispatch({ selection: { anchor: newPos } });
    return true;
  }

  if (numberedMatch) {
    const [, indent, num, content] = numberedMatch;
    if (content.trim() === "") {
      // Empty numbered item — remove it
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: "" },
      });
      return true;
    }
    const nextNum = parseInt(num) + 1;
    view.dispatch({
      changes: { from: head, insert: `\n${indent}${nextNum}. ` },
    });
    const newPos = head + 1 + indent.length + String(nextNum).length + 2;
    view.dispatch({ selection: { anchor: newPos } });
    return true;
  }

  // Blockquote continuation
  const quoteMatch = text.match(/^(\s*>+)\s(.*)$/);
  if (quoteMatch) {
    const [, prefix, content] = quoteMatch;
    if (content.trim() === "") {
      // Empty quote line — break out
      view.dispatch({
        changes: { from: line.from, to: line.to, insert: "" },
      });
      return true;
    }
    view.dispatch({
      changes: { from: head, insert: `\n${prefix} ` },
    });
    const newPos = head + 1 + prefix.length + 1;
    view.dispatch({ selection: { anchor: newPos } });
    return true;
  }

  return false; // Let default Enter behavior handle it
}

/** Tab key: indent list items */
function smartTab(view: EditorView): boolean {
  const { state } = view;
  const { head } = state.selection.main;
  const line = state.doc.lineAt(head);

  if (/^\s*([-*+]|\d+\.|- \[[ x]\])\s/.test(line.text)) {
    view.dispatch({
      changes: { from: line.from, insert: "  " },
    });
    return true;
  }
  return false;
}

/** Shift-Tab: outdent list items */
function smartShiftTab(view: EditorView): boolean {
  const { state } = view;
  const { head } = state.selection.main;
  const line = state.doc.lineAt(head);

  if (/^\s+([-*+]|\d+\.|- \[[ x]\])\s/.test(line.text)) {
    const indent = line.text.match(/^(\s+)/)?.[1] || "";
    const remove = Math.min(2, indent.length);
    view.dispatch({
      changes: { from: line.from, to: line.from + remove, insert: "" },
    });
    return true;
  }
  return false;
}

export const smartListKeymap = keymap.of([
  { key: "Enter", run: smartEnter },
  { key: "Tab", run: smartTab },
  { key: "Shift-Tab", run: smartShiftTab },
]);
