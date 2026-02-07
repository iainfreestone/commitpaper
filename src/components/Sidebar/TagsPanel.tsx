import React, { useEffect, useState } from "react";
import { useEditorStore } from "../../stores/editorStore";

interface TagInfo {
  name: string;
  count: number;
}

export function TagsPanel() {
  const content = useEditorStore((s) => s.content);
  const [allTags, setAllTags] = useState<TagInfo[]>([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (!content) {
      setAllTags([]);
      return;
    }

    const tagMap = new Map<string, number>();
    const lines = content.split("\n");

    for (const line of lines) {
      const tagMatches = line.matchAll(/(?:^|\s)#([a-zA-Z][\w-/]*)/g);
      for (const match of tagMatches) {
        const tag = match[1];
        tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
      }
    }

    if (content.startsWith("---")) {
      const endIdx = content.indexOf("\n---", 3);
      if (endIdx > 0) {
        const yaml = content.substring(3, endIdx);
        const tagsMatch = yaml.match(/^tags:\s*\[(.+)\]/m);
        if (tagsMatch) {
          tagsMatch[1].split(",").forEach((t) => {
            const tag = t.trim().replace(/['"]/g, "");
            if (tag) tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
          });
        }
        const tagsListMatch = yaml.match(/^tags:\s*\n((?:\s+-\s+.+\n?)+)/m);
        if (tagsListMatch) {
          tagsListMatch[1].split("\n").forEach((line) => {
            const m = line.match(/^\s+-\s+(.+)/);
            if (m) {
              const tag = m[1].trim().replace(/['"]/g, "");
              if (tag) tagMap.set(tag, (tagMap.get(tag) || 0) + 1);
            }
          });
        }
      }
    }

    const tags = Array.from(tagMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

    setAllTags(tags);
  }, [content]);

  const filtered = filter
    ? allTags.filter((t) => t.name.toLowerCase().includes(filter.toLowerCase()))
    : allTags;

  return (
    <div className="tags-panel" style={{ padding: "8px" }}>
      <input
        className="search-input"
        placeholder="Filter tags..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        style={{ marginBottom: "8px" }}
      />
      {filtered.length === 0 && (
        <div
          style={{
            color: "var(--text-muted)",
            textAlign: "center",
            padding: "16px",
            fontSize: "13px",
          }}
        >
          {filter ? "No matching tags" : "No tags found in current note"}
        </div>
      )}
      {filtered.map((tag) => (
        <div key={tag.name} className="tag-item">
          <span className="tag-name">#{tag.name}</span>
          <span className="tag-count">{tag.count}</span>
        </div>
      ))}
    </div>
  );
}
