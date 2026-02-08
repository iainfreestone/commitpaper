/**
 * Milkdown/ProseMirror plugin for Obsidian-style callouts/admonitions.
 *
 * Detects blockquotes whose first line matches `[!type] title` and applies
 * node decorations (coloured left border + icon/title bar).
 *
 * Because the ProseMirror document model stores callouts as blockquote nodes,
 * we decorate at the node level rather than scanning raw text lines.
 */
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import type { Node as ProsemirrorNode } from "@milkdown/kit/prose/model";

const calloutPluginKey = new PluginKey("callouts");

const CALLOUT_RE = /^\[!(\w+)\]([+-])?\s*(.*)/;

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

function findCallouts(doc: ProsemirrorNode) {
  const decos: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (node.type.name !== "blockquote") return;

    // Get the first text content of the blockquote
    const firstChild = node.firstChild;
    if (!firstChild) return;

    let firstText = "";
    firstChild.descendants((n) => {
      if (n.isText && n.text && !firstText) {
        firstText = n.text;
      }
    });

    const match = CALLOUT_RE.exec(firstText);
    if (!match) return;

    const type = match[1].toLowerCase();
    const title = match[3]?.trim() || type.charAt(0).toUpperCase() + type.slice(1);
    const color = CALLOUT_COLORS[type] || CALLOUT_COLORS.note;
    const icon = CALLOUT_ICONS[type] || CALLOUT_ICONS.note;

    // Node decoration on the blockquote
    decos.push(
      Decoration.node(pos, pos + node.nodeSize, {
        class: `mk-callout mk-callout-${type}`,
        style: `--callout-color: ${color};`,
        "data-callout-type": type,
        "data-callout-icon": icon,
        "data-callout-title": title,
      }),
    );
  });

  return DecorationSet.create(doc, decos);
}

export const calloutPlugin = new Plugin({
  key: calloutPluginKey,

  state: {
    init(_, state) {
      return findCallouts(state.doc);
    },
    apply(tr, old) {
      if (tr.docChanged) {
        return findCallouts(tr.doc);
      }
      return old;
    },
  },

  props: {
    decorations(state) {
      return calloutPluginKey.getState(state);
    },
  },
});
