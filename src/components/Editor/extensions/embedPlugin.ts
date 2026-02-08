/**
 * Milkdown/ProseMirror plugin for note embeds.
 *
 * Supports two syntaxes:
 * 1. ![[notename]] — legacy Obsidian-style (still parsed for backward compat)
 * 2. ![embed](note.md) — standard image-link pointing to a .md file
 *
 * Finds paragraphs matching either pattern and replaces them with a widget
 * decoration that shows the embedded note's content.
 */
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import type { Node as ProsemirrorNode } from "@milkdown/kit/prose/model";
import * as api from "../../../lib/api";

const embedPluginKey = new PluginKey("noteEmbeds");

// Legacy: ![[notename]]
const LEGACY_EMBED_RE = /^!\[\[([^\]]+)\]\]$/;
// Standard: ![anything](path.md) where path ends in .md
const STANDARD_EMBED_RE = /^!\[([^\]]*)\]\(([^)]+\.md)\)$/;

const embedCache = new Map<string, { content: string; ts: number }>();
const CACHE_TTL = 5000;

async function fetchEmbedContent(pathOrName: string): Promise<string> {
  const cached = embedCache.get(pathOrName);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.content;
  }
  try {
    // Try resolving as a note name first, then as a direct path
    let path = await api.resolveWikilink(pathOrName);
    if (!path) {
      // Maybe it's already a full path
      try {
        await api.readFile(pathOrName);
        path = pathOrName;
      } catch {
        return `Note not found: ${pathOrName}`;
      }
    }
    const content = await api.readFile(path);

    let body = content;
    if (body.trimStart().startsWith("---")) {
      const endFm = body.indexOf("\n---", 3);
      if (endFm > 0) body = body.substring(endFm + 4).trimStart();
    }

    const lines = body.split("\n").slice(0, 30);
    if (body.split("\n").length > 30) lines.push("…");
    const result = lines.join("\n");
    embedCache.set(pathOrName, { content: result, ts: Date.now() });
    return result;
  } catch {
    return `Error loading: ${pathOrName}`;
  }
}

function createEmbedWidget(
  noteName: string,
  notePath?: string,
): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.className = "mk-embed-widget";

  const header = document.createElement("div");
  header.className = "mk-embed-header";
  header.textContent = `📎 ${noteName}`;
  header.style.cursor = "pointer";
  header.addEventListener("click", async (e) => {
    e.preventDefault();
    try {
      const resolvedPath = notePath || (await api.resolveWikilink(noteName));
      if (resolvedPath) {
        const { useEditorStore } = await import("../../../stores/editorStore");
        useEditorStore.getState().openFile(resolvedPath);
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

  fetchEmbedContent(notePath || noteName).then((content) => {
    body.textContent = content;
  });

  return wrap;
}

function findEmbeds(
  doc: ProsemirrorNode,
  selection: { from: number; to: number },
) {
  const decos: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (node.type.name !== "paragraph") return;
    if (node.childCount !== 1 || !node.firstChild?.isText) return;

    const text = node.textContent.trim();

    // Try legacy ![[notename]] syntax
    let noteName: string | null = null;
    let notePath: string | undefined;

    const legacyMatch = LEGACY_EMBED_RE.exec(text);
    if (legacyMatch) {
      noteName = legacyMatch[1].trim();
    }

    // Try standard ![embed](path.md)
    if (!noteName) {
      const stdMatch = STANDARD_EMBED_RE.exec(text);
      if (stdMatch) {
        notePath = stdMatch[2].trim();
        noteName = stdMatch[1].trim() || api.getNoteName(notePath);
      }
    }

    if (!noteName) return;

    const nodeEnd = pos + node.nodeSize;

    // Don't replace when cursor is inside
    if (selection.from >= pos && selection.from <= nodeEnd) return;

    decos.push(
      Decoration.widget(pos, () => createEmbedWidget(noteName!, notePath), {
        side: -1,
        block: true,
        key: `embed-${notePath || noteName}`,
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
