/**
 * Milkdown/ProseMirror plugin for ![[note]] embed syntax.
 *
 * Finds paragraphs whose text is exactly `![[notename]]` and replaces them
 * with a widget decoration that shows the embedded note's content.
 */
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import type { EditorView } from "@milkdown/kit/prose/view";
import type { Node as ProsemirrorNode } from "@milkdown/kit/prose/model";
import * as api from "../../../lib/api";

const embedPluginKey = new PluginKey("noteEmbeds");

const EMBED_RE = /^!\[\[([^\]]+)\]\]$/;

const embedCache = new Map<string, { content: string; ts: number }>();
const CACHE_TTL = 5000;

async function fetchEmbedContent(name: string): Promise<string> {
  const cached = embedCache.get(name);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.content;
  }
  try {
    const path = await api.resolveWikilink(name);
    if (!path) return `Note not found: ${name}`;
    const content = await api.readFile(path);

    let body = content;
    if (body.trimStart().startsWith("---")) {
      const endFm = body.indexOf("\n---", 3);
      if (endFm > 0) body = body.substring(endFm + 4).trimStart();
    }

    const lines = body.split("\n").slice(0, 30);
    if (body.split("\n").length > 30) lines.push("…");
    const result = lines.join("\n");
    embedCache.set(name, { content: result, ts: Date.now() });
    return result;
  } catch {
    return `Error loading: ${name}`;
  }
}

function createEmbedWidget(noteName: string): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.className = "mk-embed-widget";

  const header = document.createElement("div");
  header.className = "mk-embed-header";
  header.textContent = `📎 ${noteName}`;
  header.style.cursor = "pointer";
  header.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      const path = await api.resolveWikilink(noteName);
      if (path) {
        const { useEditorStore } = await import("../../../stores/editorStore");
        useEditorStore.getState().openFile(path);
      }
    } catch {
      /* ignore */
    }
  });
  wrap.appendChild(header);

  const body = document.createElement("div");
  body.className = "mk-embed-body";
  body.textContent = "Loading…";
  wrap.appendChild(body);

  fetchEmbedContent(noteName).then((content) => {
    body.textContent = content;
  });

  return wrap;
}

function findEmbeds(doc: ProsemirrorNode, selection: { from: number; to: number }) {
  const decos: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (node.type.name !== "paragraph") return;
    if (node.childCount !== 1 || !node.firstChild?.isText) return;

    const text = node.textContent.trim();
    const match = EMBED_RE.exec(text);
    if (!match) return;

    const noteName = match[1].trim();
    const nodeEnd = pos + node.nodeSize;

    // Don't replace when cursor is inside
    if (selection.from >= pos && selection.from <= nodeEnd) return;

    decos.push(
      Decoration.widget(pos, () => createEmbedWidget(noteName), {
        side: -1,
        block: true,
        key: `embed-${noteName}`,
      }),
    );

    // Hide the raw text
    decos.push(
      Decoration.node(pos, nodeEnd, {
        class: "mk-embed-source-hidden",
      }),
    );
  });

  return DecorationSet.create(doc, decos);
}

export const embedPlugin = new Plugin({
  key: embedPluginKey,

  state: {
    init(_, state) {
      return findEmbeds(state.doc, state.selection);
    },
    apply(tr, old, _oldState, newState) {
      if (tr.docChanged || tr.selectionSet) {
        return findEmbeds(newState.doc, newState.selection);
      }
      return old;
    },
  },

  props: {
    decorations(state) {
      return embedPluginKey.getState(state);
    },
  },
});
