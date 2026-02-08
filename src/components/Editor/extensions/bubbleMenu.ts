// ============================================================
// Bubble Menu — floating formatting toolbar on text selection
// ============================================================

import { EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import {
  formatBold,
  formatItalic,
  formatStrikethrough,
  formatHighlight,
  formatInlineCode,
  insertLink,
} from "./formatting";

interface BubbleAction {
  label: string;
  title: string;
  className?: string;
  action: (view: EditorView) => boolean;
}

const bubbleActions: BubbleAction[] = [
  {
    label: "B",
    title: "Bold (Ctrl+B)",
    className: "bubble-bold",
    action: formatBold,
  },
  {
    label: "I",
    title: "Italic (Ctrl+I)",
    className: "bubble-italic",
    action: formatItalic,
  },
  {
    label: "S",
    title: "Strikethrough (Ctrl+Shift+X)",
    className: "bubble-strike",
    action: formatStrikethrough,
  },
  { label: "==", title: "Highlight (Ctrl+Shift+H)", action: formatHighlight },
  { label: "</>", title: "Code (Ctrl+E)", action: formatInlineCode },
  { label: "🔗", title: "Link (Ctrl+K)", action: insertLink },
];

class BubbleMenuPlugin {
  private container: HTMLDivElement | null = null;
  private visible = false;

  constructor(private view: EditorView) {
    this.container = document.createElement("div");
    this.container.className = "bubble-menu";
    this.container.style.display = "none";

    // Build buttons
    for (const action of bubbleActions) {
      const btn = document.createElement("button");
      btn.className = `bubble-btn ${action.className || ""}`;
      btn.textContent = action.label;
      btn.title = action.title;
      btn.addEventListener("mousedown", (e) => {
        e.preventDefault(); // Don't deselect
        action.action(this.view);
        // Keep the bubble visible if there's still a selection
        setTimeout(() => this.updatePosition(), 10);
      });
      this.container.appendChild(btn);
    }

    document.body.appendChild(this.container);
  }

  update(update: ViewUpdate) {
    // Debounce slightly to avoid flicker during typing
    if (update.selectionSet || update.docChanged) {
      this.updatePosition();
    }
  }

  updatePosition() {
    if (!this.container) return;

    const { state } = this.view;
    const { from, to } = state.selection.main;

    // Only show when there's a meaningful selection (at least 1 character)
    if (from === to || to - from < 1) {
      this.hide();
      return;
    }

    // Don't show if selection spans multiple lines (keeps it for inline formatting only)
    const fromLine = state.doc.lineAt(from).number;
    const toLine = state.doc.lineAt(to).number;
    if (toLine - fromLine > 2) {
      this.hide();
      return;
    }

    // Get the coordinates of the selection
    const start = this.view.coordsAtPos(from);
    const end = this.view.coordsAtPos(to);
    if (!start || !end) {
      this.hide();
      return;
    }

    // Position above the selection, centered
    const midX = (start.left + end.left) / 2;
    const topY = Math.min(start.top, end.top);

    this.container.style.display = "flex";
    this.visible = true;

    // Measure the menu
    const rect = this.container.getBoundingClientRect();
    let left = midX - rect.width / 2;
    let top = topY - rect.height - 8;

    // Keep within viewport
    left = Math.max(8, Math.min(left, window.innerWidth - rect.width - 8));
    if (top < 8) top = end.bottom + 8;

    this.container.style.left = `${left}px`;
    this.container.style.top = `${top}px`;
  }

  hide() {
    if (this.container && this.visible) {
      this.container.style.display = "none";
      this.visible = false;
    }
  }

  destroy() {
    this.container?.remove();
  }
}

export const bubbleMenuPlugin = ViewPlugin.fromClass(BubbleMenuPlugin);
