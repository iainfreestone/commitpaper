/**
 * Milkdown/ProseMirror plugin for [[wikilink]] support:
 * - Inline decorations to style wikilinks (blue text, dimmed brackets)
 * - Click handler to navigate via wikilink-click CustomEvent
 * - Autocomplete popup when typing inside [[
 * - Hover preview tooltip showing first 15 lines of linked note
 */
import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import type { EditorView } from "@milkdown/kit/prose/view";
import type { Node as ProsemirrorNode } from "@milkdown/kit/prose/model";
import * as api from "../../../lib/api";

const WIKILINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

const wikilinkPluginKey = new PluginKey("wikilinks");

// ─── Decorations ───────────────────────────────────────────────

function findWikilinks(doc: ProsemirrorNode) {
  const decos: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const text = node.text;
    WIKILINK_RE.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = WIKILINK_RE.exec(text)) !== null) {
      const start = pos + match.index;
      const end = start + match[0].length;
      // Brackets
      decos.push(
        Decoration.inline(start, start + 2, { class: "mk-wikilink-bracket" }),
      );
      // Link text
      decos.push(
        Decoration.inline(start + 2, end - 2, { class: "mk-wikilink" }),
      );
      // Brackets
      decos.push(
        Decoration.inline(end - 2, end, { class: "mk-wikilink-bracket" }),
      );
    }
  });

  return DecorationSet.create(doc, decos);
}

// ─── Autocomplete ──────────────────────────────────────────────

let cachedNames: string[] = [];
let lastFetch = 0;

async function fetchNoteNames(): Promise<string[]> {
  const now = Date.now();
  if (now - lastFetch > 3000 || cachedNames.length === 0) {
    try {
      cachedNames = await api.getNoteNames();
      lastFetch = now;
    } catch {
      /* ignore */
    }
  }
  return cachedNames;
}

/** Return the wikilink prefix being typed, or null if not inside [[ */
function getWikilinkContext(
  view: EditorView,
): { from: number; query: string } | null {
  const { state } = view;
  const { from: selFrom } = state.selection;
  // Search backwards from cursor for [[
  const resolvedPos = state.doc.resolve(selFrom);
  const textBefore = resolvedPos.parent.textBetween(
    0,
    resolvedPos.parentOffset,
    "\0",
    "\0",
  );

  const lastOpen = textBefore.lastIndexOf("[[");
  if (lastOpen === -1) return null;

  const afterOpen = textBefore.slice(lastOpen + 2);
  if (afterOpen.includes("]]")) return null;

  // Absolute position of the text after [[
  const parentStart = resolvedPos.start();
  return {
    from: parentStart + lastOpen + 2,
    query: afterOpen.split("|")[0],
  };
}

let autocompleteDom: HTMLDivElement | null = null;
let autocompleteItems: string[] = [];
let autocompleteSelectedIndex = 0;
let autocompleteFrom = 0;

function destroyAutocomplete() {
  if (autocompleteDom) {
    autocompleteDom.remove();
    autocompleteDom = null;
  }
  autocompleteItems = [];
  autocompleteSelectedIndex = 0;
}

function renderAutocomplete(view: EditorView, items: string[], from: number) {
  if (items.length === 0) {
    destroyAutocomplete();
    return;
  }

  autocompleteItems = items;
  autocompleteFrom = from;
  autocompleteSelectedIndex = 0;

  if (!autocompleteDom) {
    autocompleteDom = document.createElement("div");
    autocompleteDom.className = "mk-wikilink-autocomplete";
    document.body.appendChild(autocompleteDom);
  }

  updateAutocompleteDOM(view);

  // Position relative to cursor
  const coords = view.coordsAtPos(from);
  if (coords) {
    autocompleteDom.style.left = `${coords.left}px`;
    autocompleteDom.style.top = `${coords.bottom + 4}px`;
  }
}

function updateAutocompleteDOM(view: EditorView) {
  if (!autocompleteDom) return;
  autocompleteDom.innerHTML = "";

  autocompleteItems.forEach((item, i) => {
    const div = document.createElement("div");
    div.className =
      "mk-wikilink-autocomplete-item" +
      (i === autocompleteSelectedIndex ? " selected" : "");
    div.textContent = item;
    div.addEventListener("mousedown", (e) => {
      e.preventDefault();
      applyAutocomplete(view, item);
    });
    autocompleteDom!.appendChild(div);
  });
}

function applyAutocomplete(view: EditorView, name: string) {
  const { state } = view;
  const selFrom = state.selection.from;

  // Replace from the query start to cursor, and add ]] if needed
  const textAfterCursor = state.doc.textBetween(
    selFrom,
    Math.min(selFrom + 2, state.doc.content.size),
  );
  const suffix = textAfterCursor.startsWith("]]") ? "" : "]]";

  view.dispatch(
    state.tr.replaceWith(
      autocompleteFrom,
      selFrom,
      state.schema.text(name + suffix),
    ),
  );
  view.focus();
  destroyAutocomplete();
}

// ─── Hover Preview ─────────────────────────────────────────────

let hoverDom: HTMLDivElement | null = null;
let hoverTimeout: ReturnType<typeof setTimeout> | null = null;

function destroyHover() {
  if (hoverTimeout) {
    clearTimeout(hoverTimeout);
    hoverTimeout = null;
  }
  if (hoverDom) {
    hoverDom.remove();
    hoverDom = null;
  }
}

function getWikilinkAtPos(doc: ProsemirrorNode, pos: number): string | null {
  const resolved = doc.resolve(pos);
  const text = resolved.parent.textContent;
  const parentStart = resolved.start();
  const offsetInParent = pos - parentStart;

  WIKILINK_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = WIKILINK_RE.exec(text)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (offsetInParent >= start && offsetInParent <= end) {
      return match[1].trim();
    }
  }
  return null;
}

async function showHoverPreview(
  view: EditorView,
  target: string,
  pos: number,
) {
  try {
    const resolved = await api.resolveWikilink(target);
    if (!resolved) return;
    const content = await api.readFile(resolved);

    // Strip frontmatter
    const lines = content.split("\n");
    let start = 0;
    if (lines[0]?.trim() === "---") {
      for (let i = 1; i < lines.length; i++) {
        if (lines[i]?.trim() === "---") {
          start = i + 1;
          break;
        }
      }
    }
    const preview = lines
      .slice(start, start + 15)
      .join("\n")
      .trim();

    if (!preview) return;

    hoverDom = document.createElement("div");
    hoverDom.className = "mk-hover-preview";

    const titleEl = document.createElement("div");
    titleEl.className = "mk-hover-preview-title";
    titleEl.textContent = target;
    hoverDom.appendChild(titleEl);

    const bodyEl = document.createElement("div");
    bodyEl.className = "mk-hover-preview-body";
    bodyEl.textContent = preview;
    hoverDom.appendChild(bodyEl);

    document.body.appendChild(hoverDom);

    const coords = view.coordsAtPos(pos);
    if (coords) {
      hoverDom.style.left = `${coords.left}px`;
      hoverDom.style.top = `${coords.top - hoverDom.offsetHeight - 8}px`;

      // If above is off-screen, show below
      if (parseInt(hoverDom.style.top) < 0) {
        hoverDom.style.top = `${coords.bottom + 8}px`;
      }
    }
  } catch {
    /* ignore */
  }
}

// ─── Plugin ────────────────────────────────────────────────────

export const wikilinkPlugin = new Plugin({
  key: wikilinkPluginKey,

  state: {
    init(_, state) {
      return findWikilinks(state.doc);
    },
    apply(tr, old) {
      if (tr.docChanged) {
        return findWikilinks(tr.doc);
      }
      return old;
    },
  },

  props: {
    decorations(state) {
      return wikilinkPluginKey.getState(state);
    },

    handleClick(view, pos, event) {
      const target = getWikilinkAtPos(view.state.doc, pos);
      if (target) {
        window.dispatchEvent(
          new CustomEvent("wikilink-click", { detail: { target } }),
        );
        return true;
      }
      return false;
    },

    handleKeyDown(view, event) {
      if (!autocompleteDom) return false;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        autocompleteSelectedIndex = Math.min(
          autocompleteSelectedIndex + 1,
          autocompleteItems.length - 1,
        );
        updateAutocompleteDOM(view);
        return true;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        autocompleteSelectedIndex = Math.max(
          autocompleteSelectedIndex - 1,
          0,
        );
        updateAutocompleteDOM(view);
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        if (autocompleteItems.length > 0) {
          event.preventDefault();
          applyAutocomplete(
            view,
            autocompleteItems[autocompleteSelectedIndex],
          );
          return true;
        }
      }
      if (event.key === "Escape") {
        destroyAutocomplete();
        return true;
      }
      return false;
    },

    handleDOMEvents: {
      mouseover(view, event) {
        const target = event.target as HTMLElement;
        if (!target.classList.contains("mk-wikilink")) {
          destroyHover();
          return false;
        }

        destroyHover();
        const pos = view.posAtDOM(target, 0);
        const linkTarget = getWikilinkAtPos(view.state.doc, pos);
        if (!linkTarget) return false;

        hoverTimeout = setTimeout(() => {
          showHoverPreview(view, linkTarget, pos);
        }, 400);
        return false;
      },

      mouseout(view, event) {
        const related = (event as MouseEvent).relatedTarget as HTMLElement;
        if (related?.closest?.(".mk-hover-preview")) return false;
        destroyHover();
        return false;
      },
    },
  },

  view(editorView) {
    return {
      update(view, prevState) {
        // Autocomplete: check if we're inside [[
        const ctx = getWikilinkContext(view);
        if (!ctx) {
          destroyAutocomplete();
          return;
        }

        fetchNoteNames().then((names) => {
          const filtered = names.filter((n) =>
            n.toLowerCase().includes(ctx.query.toLowerCase()),
          );
          renderAutocomplete(view, filtered.slice(0, 12), ctx.from);
        });
      },

      destroy() {
        destroyAutocomplete();
        destroyHover();
      },
    };
  },
});
