// ============================================================
// Formatting commands & keyboard shortcuts
// Provides toggle-style formatting for markdown syntax
// ============================================================

import { EditorView, keymap } from "@codemirror/view";
import { EditorSelection } from "@codemirror/state";

// ============================================================
// Inline formatting (toggle wrap around selection / word)
// ============================================================

/** Toggle an inline markdown wrapper (e.g. ** for bold, * for italic) */
function toggleInlineFormat(view: EditorView, marker: string): boolean {
  const { state } = view;
  const changes: { from: number; to: number; insert: string }[] = [];
  const selections: { anchor: number; head: number }[] = [];

  for (const range of state.selection.ranges) {
    let { from, to } = range;

    if (from === to) {
      // No selection — select the current word
      const line = state.doc.lineAt(from);
      const text = line.text;
      const lineStart = line.from;
      const pos = from - lineStart;
      let wordStart = pos;
      let wordEnd = pos;
      while (wordStart > 0 && /\S/.test(text[wordStart - 1])) wordStart--;
      while (wordEnd < text.length && /\S/.test(text[wordEnd])) wordEnd++;
      if (wordStart === wordEnd) {
        // Cursor in whitespace — insert markers and place cursor between
        changes.push({ from, to: from, insert: marker + marker });
        selections.push({
          anchor: from + marker.length,
          head: from + marker.length,
        });
        continue;
      }
      from = lineStart + wordStart;
      to = lineStart + wordEnd;
    }

    const selected = state.doc.sliceString(from, to);

    // Check if already wrapped with the marker
    const beforeStart = Math.max(0, from - marker.length);
    const afterEnd = Math.min(state.doc.length, to + marker.length);
    const before = state.doc.sliceString(beforeStart, from);
    const after = state.doc.sliceString(to, afterEnd);

    if (before === marker && after === marker) {
      // Remove markers
      changes.push({ from: beforeStart, to: afterEnd, insert: selected });
      const offset = changes.reduce(
        (acc, c) => acc + c.insert.length - (c.to - c.from),
        0,
      );
      selections.push({
        anchor: beforeStart,
        head: beforeStart + selected.length,
      });
    } else if (
      selected.startsWith(marker) &&
      selected.endsWith(marker) &&
      selected.length > marker.length * 2
    ) {
      // Selection includes markers — remove them
      const inner = selected.slice(marker.length, -marker.length);
      changes.push({ from, to, insert: inner });
      selections.push({ anchor: from, head: from + inner.length });
    } else {
      // Add markers
      const wrapped = marker + selected + marker;
      changes.push({ from, to, insert: wrapped });
      selections.push({
        anchor: from + marker.length,
        head: from + marker.length + selected.length,
      });
    }
  }

  if (changes.length === 0) return false;
  view.dispatch({
    changes,
    selection: EditorSelection.create(
      selections.map((s) => EditorSelection.range(s.anchor, s.head)),
    ),
  });
  return true;
}

// ============================================================
// Line-level formatting (headings, lists, blockquotes)
// ============================================================

/** Toggle a heading level on the current line */
function toggleHeading(view: EditorView, level: number): boolean {
  const { state } = view;
  const prefix = "#".repeat(level) + " ";
  const changes: { from: number; to: number; insert: string }[] = [];

  for (const range of state.selection.ranges) {
    const line = state.doc.lineAt(range.from);
    const text = line.text;
    // Check existing heading
    const headingMatch = text.match(/^(#{1,6})\s/);
    if (headingMatch) {
      if (headingMatch[1].length === level) {
        // Same level — remove heading
        changes.push({
          from: line.from,
          to: line.from + headingMatch[0].length,
          insert: "",
        });
      } else {
        // Different level — replace
        changes.push({
          from: line.from,
          to: line.from + headingMatch[0].length,
          insert: prefix,
        });
      }
    } else {
      // Add heading
      changes.push({ from: line.from, to: line.from, insert: prefix });
    }
  }

  view.dispatch({ changes });
  return true;
}

/** Toggle a line prefix (e.g. "- ", "1. ", "> ") */
function toggleLinePrefix(
  view: EditorView,
  prefix: string,
  pattern: RegExp,
): boolean {
  const { state } = view;
  const changes: { from: number; to: number; insert: string }[] = [];

  // Get all affected lines (handle multi-line selections)
  const lines = new Set<number>();
  for (const range of state.selection.ranges) {
    const startLine = state.doc.lineAt(range.from).number;
    const endLine = state.doc.lineAt(range.to).number;
    for (let i = startLine; i <= endLine; i++) lines.add(i);
  }

  for (const lineNum of lines) {
    const line = state.doc.line(lineNum);
    const match = line.text.match(pattern);
    if (match) {
      // Remove prefix
      changes.push({
        from: line.from,
        to: line.from + match[0].length,
        insert: "",
      });
    } else {
      // Remove any other list prefix first, then add new one
      const otherList = line.text.match(
        /^(\s*)([-*+]\s|(\d+)\.\s|\[[ x]\]\s|>\s)/,
      );
      if (otherList) {
        changes.push({
          from: line.from + otherList[1].length,
          to: line.from + otherList[0].length,
          insert: prefix,
        });
      } else {
        const indent = line.text.match(/^(\s*)/)?.[0] || "";
        changes.push({
          from: line.from + indent.length,
          to: line.from + indent.length,
          insert: prefix,
        });
      }
    }
  }

  view.dispatch({ changes });
  return true;
}

/** Insert a block element (code block, table, etc.) at cursor */
function insertBlock(view: EditorView, block: string): boolean {
  const { state } = view;
  const cursor = state.selection.main.head;
  const line = state.doc.lineAt(cursor);

  // Ensure we start on an empty line
  let insert = block;
  if (line.text.trim().length > 0) {
    insert = "\n" + block;
  }

  view.dispatch({
    changes: { from: cursor, insert },
    selection: { anchor: cursor + insert.indexOf("\n") + 1 },
  });
  view.focus();
  return true;
}

// ============================================================
// Exported command functions (used by toolbar + slash menu)
// ============================================================

export const formatBold = (view: EditorView) => toggleInlineFormat(view, "**");
export const formatItalic = (view: EditorView) => toggleInlineFormat(view, "*");
export const formatStrikethrough = (view: EditorView) =>
  toggleInlineFormat(view, "~~");
export const formatHighlight = (view: EditorView) =>
  toggleInlineFormat(view, "==");
export const formatInlineCode = (view: EditorView) =>
  toggleInlineFormat(view, "`");

export const formatHeading1 = (view: EditorView) => toggleHeading(view, 1);
export const formatHeading2 = (view: EditorView) => toggleHeading(view, 2);
export const formatHeading3 = (view: EditorView) => toggleHeading(view, 3);
export const formatHeading4 = (view: EditorView) => toggleHeading(view, 4);
export const formatHeading5 = (view: EditorView) => toggleHeading(view, 5);
export const formatHeading6 = (view: EditorView) => toggleHeading(view, 6);

export const formatBulletList = (view: EditorView) =>
  toggleLinePrefix(view, "- ", /^(\s*)[-*+]\s/);
export const formatNumberedList = (view: EditorView) =>
  toggleLinePrefix(view, "1. ", /^(\s*)\d+\.\s/);
export const formatCheckbox = (view: EditorView) =>
  toggleLinePrefix(view, "- [ ] ", /^(\s*)- \[[ x]\]\s/);
export const formatBlockquote = (view: EditorView) =>
  toggleLinePrefix(view, "> ", /^(\s*)>\s/);

export const insertHorizontalRule = (view: EditorView) =>
  insertBlock(view, "\n---\n");

export const insertCodeBlock = (view: EditorView) =>
  insertBlock(view, "```\n\n```\n");

export const insertMathBlock = (view: EditorView) =>
  insertBlock(view, "$$\n\n$$\n");

export const insertTable = (view: EditorView) =>
  insertBlock(
    view,
    "| Column 1 | Column 2 | Column 3 |\n| --- | --- | --- |\n| Cell | Cell | Cell |\n",
  );

export const insertCallout = (view: EditorView, type = "note") =>
  insertBlock(view, `> [!${type}] Title\n> Content here\n`);

export const insertLink = (view: EditorView): boolean => {
  const { state } = view;
  const { from, to } = state.selection.main;
  const selected = state.doc.sliceString(from, to);

  if (selected) {
    // Wrap selected text as link label
    const insert = `[${selected}](url)`;
    view.dispatch({
      changes: { from, to, insert },
      // Place cursor on "url"
      selection: {
        anchor: from + selected.length + 3,
        head: from + selected.length + 6,
      },
    });
  } else {
    const insert = "[link text](url)";
    view.dispatch({
      changes: { from, insert },
      selection: { anchor: from + 1, head: from + 10 },
    });
  }
  view.focus();
  return true;
};

export const insertImage = (view: EditorView): boolean => {
  const { state } = view;
  const cursor = state.selection.main.head;
  const insert = "![alt text](image-url)";
  view.dispatch({
    changes: { from: cursor, insert },
    selection: { anchor: cursor + 2, head: cursor + 10 },
  });
  view.focus();
  return true;
};

// ============================================================
// Keymap extension
// ============================================================

export const formattingKeymap = keymap.of([
  { key: "Mod-b", run: formatBold },
  { key: "Mod-i", run: formatItalic },
  { key: "Mod-Shift-x", run: formatStrikethrough },
  { key: "Mod-Shift-h", run: formatHighlight },
  { key: "Mod-e", run: formatInlineCode },
  { key: "Mod-k", run: insertLink },
  { key: "Mod-Shift-7", run: formatNumberedList },
  { key: "Mod-Shift-8", run: formatBulletList },
  { key: "Mod-Shift-9", run: formatCheckbox },
  { key: "Mod-Shift-.", run: formatBlockquote },
  { key: "Mod-1", run: formatHeading1 },
  { key: "Mod-2", run: formatHeading2 },
  { key: "Mod-3", run: formatHeading3 },
  { key: "Mod-4", run: formatHeading4 },
]);
