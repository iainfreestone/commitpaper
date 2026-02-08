// ============================================================
// Formatting Toolbar
// A clean toolbar above the editor for non-markdown users
// ============================================================

import React, { useState, useRef, useEffect } from "react";
import type { EditorView } from "@codemirror/view";
import {
  formatBold,
  formatItalic,
  formatStrikethrough,
  formatHighlight,
  formatInlineCode,
  formatHeading1,
  formatHeading2,
  formatHeading3,
  formatHeading4,
  formatBulletList,
  formatNumberedList,
  formatCheckbox,
  formatBlockquote,
  insertHorizontalRule,
  insertCodeBlock,
  insertTable,
  insertLink,
  insertImage,
  insertCallout,
} from "./extensions/formatting";

interface FormattingToolbarProps {
  editorView: EditorView | null;
}

interface ToolbarButton {
  label: string;
  title: string;
  shortcut?: string;
  action: (view: EditorView) => boolean;
}

interface ToolbarGroup {
  buttons: ToolbarButton[];
}

function HeadingDropdown({ editorView }: { editorView: EditorView | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const headings = [
    { label: "Heading 1", fn: formatHeading1, shortcut: "Ctrl+1" },
    { label: "Heading 2", fn: formatHeading2, shortcut: "Ctrl+2" },
    { label: "Heading 3", fn: formatHeading3, shortcut: "Ctrl+3" },
    { label: "Heading 4", fn: formatHeading4, shortcut: "Ctrl+4" },
  ];

  return (
    <div className="toolbar-dropdown-wrapper" ref={ref}>
      <button
        className="toolbar-btn toolbar-dropdown-trigger"
        onClick={() => setOpen(!open)}
        title="Heading level"
      >
        <span>H</span>
        <span className="toolbar-dropdown-arrow">▾</span>
      </button>
      {open && (
        <div className="toolbar-dropdown-menu">
          {headings.map((h) => (
            <button
              key={h.label}
              className="toolbar-dropdown-item"
              onClick={() => {
                if (editorView) {
                  h.fn(editorView);
                  editorView.focus();
                }
                setOpen(false);
              }}
            >
              <span className="toolbar-dropdown-label">{h.label}</span>
              <span className="toolbar-dropdown-shortcut">{h.shortcut}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function InsertDropdown({ editorView }: { editorView: EditorView | null }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const items = [
    { label: "Table", icon: "⊞", fn: (v: EditorView) => insertTable(v) },
    {
      label: "Code Block",
      icon: "⟨/⟩",
      fn: (v: EditorView) => insertCodeBlock(v),
    },
    { label: "Math Block", icon: "∑", fn: (v: EditorView) => insertCallout(v) },
    {
      label: "Horizontal Rule",
      icon: "─",
      fn: (v: EditorView) => insertHorizontalRule(v),
    },
    {
      label: "Callout — Note",
      icon: "ℹ",
      fn: (v: EditorView) => insertCallout(v, "note"),
    },
    {
      label: "Callout — Tip",
      icon: "💡",
      fn: (v: EditorView) => insertCallout(v, "tip"),
    },
    {
      label: "Callout — Warning",
      icon: "⚠",
      fn: (v: EditorView) => insertCallout(v, "warning"),
    },
  ];

  return (
    <div className="toolbar-dropdown-wrapper" ref={ref}>
      <button
        className="toolbar-btn toolbar-dropdown-trigger"
        onClick={() => setOpen(!open)}
        title="Insert block"
      >
        <span>+</span>
        <span className="toolbar-dropdown-arrow">▾</span>
      </button>
      {open && (
        <div className="toolbar-dropdown-menu">
          {items.map((item) => (
            <button
              key={item.label}
              className="toolbar-dropdown-item"
              onClick={() => {
                if (editorView) {
                  item.fn(editorView);
                  editorView.focus();
                }
                setOpen(false);
              }}
            >
              <span className="toolbar-dropdown-icon">{item.icon}</span>
              <span className="toolbar-dropdown-label">{item.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function FormattingToolbar({ editorView }: FormattingToolbarProps) {
  const exec = (fn: (view: EditorView) => boolean) => {
    if (!editorView) return;
    fn(editorView);
    editorView.focus();
  };

  const groups: ToolbarGroup[] = [
    {
      buttons: [
        { label: "B", title: "Bold", shortcut: "Ctrl+B", action: formatBold },
        {
          label: "I",
          title: "Italic",
          shortcut: "Ctrl+I",
          action: formatItalic,
        },
        {
          label: "S",
          title: "Strikethrough",
          shortcut: "Ctrl+Shift+X",
          action: formatStrikethrough,
        },
        {
          label: "==",
          title: "Highlight",
          shortcut: "Ctrl+Shift+H",
          action: formatHighlight,
        },
        {
          label: "</>",
          title: "Inline Code",
          shortcut: "Ctrl+E",
          action: formatInlineCode,
        },
      ],
    },
    {
      buttons: [
        {
          label: "•",
          title: "Bullet List",
          shortcut: "Ctrl+Shift+8",
          action: formatBulletList,
        },
        {
          label: "1.",
          title: "Numbered List",
          shortcut: "Ctrl+Shift+7",
          action: formatNumberedList,
        },
        {
          label: "☐",
          title: "Checkbox",
          shortcut: "Ctrl+Shift+9",
          action: formatCheckbox,
        },
        {
          label: "❝",
          title: "Blockquote",
          shortcut: "Ctrl+Shift+.",
          action: formatBlockquote,
        },
      ],
    },
    {
      buttons: [
        {
          label: "🔗",
          title: "Insert Link",
          shortcut: "Ctrl+K",
          action: insertLink,
        },
        { label: "🖼", title: "Insert Image", action: insertImage },
      ],
    },
  ];

  return (
    <div className="formatting-toolbar">
      <HeadingDropdown editorView={editorView} />
      <div className="toolbar-separator" />

      {groups.map((group, gi) => (
        <React.Fragment key={gi}>
          {group.buttons.map((btn) => (
            <button
              key={btn.title}
              className={`toolbar-btn ${btn.label === "B" ? "toolbar-btn-bold" : ""} ${btn.label === "I" ? "toolbar-btn-italic" : ""}`}
              title={`${btn.title}${btn.shortcut ? ` (${btn.shortcut})` : ""}`}
              onMouseDown={(e) => {
                e.preventDefault(); // Don't steal focus from editor
                exec(btn.action);
              }}
            >
              {btn.label}
            </button>
          ))}
          {gi < groups.length - 1 && <div className="toolbar-separator" />}
        </React.Fragment>
      ))}

      <div className="toolbar-separator" />
      <InsertDropdown editorView={editorView} />
    </div>
  );
}
