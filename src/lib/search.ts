// ============================================================
// MiniSearch-based full-text search (replaces Tantivy)
// ============================================================

import MiniSearch from "minisearch";

interface SearchDocument {
  path: string;
  title: string;
  content: string;
}

let miniSearch: MiniSearch<SearchDocument> | null = null;

export function buildSearchIndex(docs: SearchDocument[]) {
  miniSearch = new MiniSearch<SearchDocument>({
    fields: ["title", "content"],
    storeFields: ["path", "title", "content"],
    idField: "path",
    searchOptions: {
      boost: { title: 3 },
      fuzzy: 0.2,
      prefix: true,
    },
  });
  miniSearch.addAll(docs);
}

export function addToIndex(doc: SearchDocument) {
  if (!miniSearch) return;
  // Remove existing if present, then re-add
  try {
    miniSearch.discard(doc.path);
  } catch {
    // not in index yet
  }
  // MiniSearch needs vacuum after discard
  try {
    miniSearch.vacuum();
  } catch {
    // ignore
  }
  miniSearch.add(doc);
}

export function searchIndex(
  query: string
): { path: string; title: string; snippet: string; score: number }[] {
  if (!miniSearch || !query.trim()) return [];

  const results = miniSearch.search(query, { combineWith: 'OR' }).slice(0, 20);

  return results.map((r) => {
    const content = (r as any).content || "";
    // Generate a snippet around the query match
    const lowerContent = content.toLowerCase();
    const lowerQuery = query.toLowerCase();
    const idx = lowerContent.indexOf(lowerQuery);
    let snippet = "";
    if (idx >= 0) {
      const start = Math.max(0, idx - 40);
      const end = Math.min(content.length, idx + query.length + 80);
      snippet = (start > 0 ? "…" : "") + content.substring(start, end) + (end < content.length ? "…" : "");
    } else {
      snippet = content.substring(0, 120) + (content.length > 120 ? "…" : "");
    }

    return {
      path: r.id,
      title: (r as any).title || r.id,
      snippet,
      score: r.score,
    };
  });
}
