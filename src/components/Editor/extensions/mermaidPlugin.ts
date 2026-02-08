/**
 * Milkdown/ProseMirror plugin for mermaid diagram rendering.
 *
 * When the cursor is outside a mermaid code block, renders the diagram
 * as SVG via mermaid.js. When the cursor is inside, shows the raw code
 * (Crepe's CodeMirror feature handles syntax highlighting).
 */
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import type { Node as ProsemirrorNode } from "@milkdown/kit/prose/model";
import mermaid from "mermaid";

const mermaidPluginKey = new PluginKey("mermaid");

let mermaidInitialized = false;
let mermaidIdCounter = 0;

function ensureMermaidInit() {
  if (mermaidInitialized) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: "dark",
    themeVariables: {
      darkMode: true,
      background: "#1e1e2e",
      primaryColor: "#89b4fa",
      primaryTextColor: "#cdd6f4",
      primaryBorderColor: "#585b70",
      lineColor: "#a6adc8",
      secondaryColor: "#313244",
      tertiaryColor: "#45475a",
    },
    securityLevel: "loose",
    fontFamily: "var(--font-sans)",
  });
  mermaidInitialized = true;
}

function createMermaidWidget(code: string): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.className = "mk-mermaid-widget";

  const inner = document.createElement("div");
  inner.className = "mk-mermaid-inner";
  inner.textContent = "Rendering diagram…";
  wrap.appendChild(inner);

  ensureMermaidInit();
  const id = `mermaid-${Date.now()}-${mermaidIdCounter++}`;

  mermaid
    .render(id, code)
    .then(({ svg }) => {
      inner.innerHTML = svg;
    })
    .catch((err) => {
      inner.textContent = `Mermaid error: ${err.message || err}`;
      inner.style.color = "#f38ba8";
      inner.style.fontSize = "12px";
    });

  return wrap;
}

function findMermaidBlocks(
  doc: ProsemirrorNode,
  selection: { from: number; to: number },
) {
  const decos: Decoration[] = [];

  doc.descendants((node, pos) => {
    // Look for code_block nodes with language "mermaid"
    if (node.type.name !== "code_block") return;

    const lang = node.attrs.language || "";
    if (lang !== "mermaid") return;

    const nodeEnd = pos + node.nodeSize;
    const cursorInside = selection.from >= pos && selection.from <= nodeEnd;

    if (!cursorInside) {
      const code = node.textContent.trim();
      if (!code) return;

      // Show rendered diagram above the code block
      decos.push(
        Decoration.widget(pos, () => createMermaidWidget(code), {
          side: -1,
          block: true,
          key: `mermaid-${pos}-${code.slice(0, 32)}`,
        }),
      );

      // Hide the raw code block
      decos.push(
        Decoration.node(pos, nodeEnd, {
          class: "mk-mermaid-source-hidden",
        }),
      );
    }
  });

  return DecorationSet.create(doc, decos);
}

export const mermaidPlugin = new Plugin({
  key: mermaidPluginKey,

  state: {
    init(_, state) {
      return findMermaidBlocks(state.doc, state.selection);
    },
    apply(tr, old, _oldState, newState) {
      if (tr.docChanged || tr.selectionSet) {
        return findMermaidBlocks(newState.doc, newState.selection);
      }
      return old;
    },
  },

  props: {
    decorations(state) {
      return mermaidPluginKey.getState(state);
    },
  },
});
