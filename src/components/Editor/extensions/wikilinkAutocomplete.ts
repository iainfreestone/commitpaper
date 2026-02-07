import {
  Completion,
  CompletionContext,
  CompletionResult,
  autocompletion,
} from "@codemirror/autocomplete";
import { EditorView } from "@codemirror/view";
import * as api from "../../../lib/api";

let cachedNames: string[] = [];
let lastFetch = 0;

async function fetchNoteNames(): Promise<string[]> {
  const now = Date.now();
  if (now - lastFetch > 3000 || cachedNames.length === 0) {
    try {
      cachedNames = await api.getNoteNames();
      lastFetch = now;
    } catch {
      // ignore
    }
  }
  return cachedNames;
}

async function wikilinkCompletions(
  ctx: CompletionContext,
): Promise<CompletionResult | null> {
  const line = ctx.state.doc.lineAt(ctx.pos);
  const textBefore = line.text.slice(0, ctx.pos - line.from);

  const lastOpen = textBefore.lastIndexOf("[[");
  if (lastOpen === -1) return null;

  const afterOpen = textBefore.slice(lastOpen + 2);
  if (afterOpen.includes("]]")) return null;

  const from = line.from + lastOpen + 2;
  const filter = afterOpen.split("|")[0];

  const names = await fetchNoteNames();

  const options: Completion[] = names.map((name) => ({
    label: name,
    type: "text",
    apply: (view, completion, from, to) => {
      const textAfter = view.state.doc.sliceString(
        to,
        Math.min(to + 2, view.state.doc.length),
      );
      const suffix = textAfter.startsWith("]]") ? "" : "]]";
      view.dispatch({
        changes: { from, to, insert: completion.label + suffix },
        selection: { anchor: from + completion.label.length + suffix.length },
      });
    },
  }));

  return {
    from,
    options,
    filter: true,
  };
}

export const wikilinkAutocomplete = autocompletion({
  override: [wikilinkCompletions],
  activateOnTyping: true,
  closeOnBlur: true,
  icons: false,
  optionClass: () => "cm-wikilink-completion",
});

export const wikilinkAutocompleteTheme = EditorView.baseTheme({
  ".cm-tooltip-autocomplete": {
    backgroundColor: "#1e1e2e !important",
    border: "1px solid #313244 !important",
    borderRadius: "6px !important",
    boxShadow: "0 8px 24px rgba(0,0,0,0.4) !important",
  },
  ".cm-tooltip-autocomplete ul": {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: "13px",
    maxHeight: "250px",
  },
  ".cm-tooltip-autocomplete ul li": {
    padding: "4px 12px !important",
    color: "#cdd6f4",
  },
  ".cm-tooltip-autocomplete ul li[aria-selected]": {
    backgroundColor: "#313244 !important",
    color: "#89b4fa",
  },
  ".cm-completionLabel": {
    color: "#cdd6f4",
  },
});

export function invalidateNoteNameCache() {
  lastFetch = 0;
  cachedNames = [];
}
