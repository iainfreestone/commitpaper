import React, { useState, useEffect } from "react";
import { useEditorStore } from "../../stores/editorStore";

interface FrontmatterField {
  key: string;
  value: string;
}

export function PropertiesPanel() {
  const content = useEditorStore((s) => s.content);
  const setContent = useEditorStore((s) => s.setContent);
  const activeTabPath = useEditorStore((s) => s.activeTabPath);
  const [fields, setFields] = useState<FrontmatterField[]>([]);
  const [hasFrontmatter, setHasFrontmatter] = useState(false);

  useEffect(() => {
    if (!content) {
      setFields([]);
      setHasFrontmatter(false);
      return;
    }

    const trimmed = content.trimStart();
    if (!trimmed.startsWith("---")) {
      setFields([]);
      setHasFrontmatter(false);
      return;
    }

    const endIdx = trimmed.indexOf("\n---", 3);
    if (endIdx < 0) {
      setFields([]);
      setHasFrontmatter(false);
      return;
    }

    setHasFrontmatter(true);
    const yaml = trimmed.substring(4, endIdx);
    const parsed: FrontmatterField[] = [];

    for (const line of yaml.split("\n")) {
      const match = line.match(/^([^:]+):\s*(.*)/);
      if (match) {
        parsed.push({ key: match[1].trim(), value: match[2].trim() });
      }
    }

    setFields(parsed);
  }, [content]);

  const updateField = (index: number, key: string, value: string) => {
    const newFields = [...fields];
    newFields[index] = { key, value };
    setFields(newFields);
    rebuildFrontmatter(newFields);
  };

  const addField = () => {
    const newFields = [...fields, { key: "", value: "" }];
    setFields(newFields);
  };

  const removeField = (index: number) => {
    const newFields = fields.filter((_, i) => i !== index);
    setFields(newFields);
    rebuildFrontmatter(newFields);
  };

  const addFrontmatter = () => {
    setHasFrontmatter(true);
    const newFields = [{ key: "title", value: "" }];
    setFields(newFields);
    const yaml = newFields.map((f) => `${f.key}: ${f.value}`).join("\n");
    const newContent = `---\n${yaml}\n---\n${content}`;

    window.dispatchEvent(
      new CustomEvent("editor-set-content", {
        detail: { content: newContent },
      }),
    );
  };

  const rebuildFrontmatter = (newFields: FrontmatterField[]) => {
    if (!content) return;
    const trimmed = content.trimStart();
    const endIdx = trimmed.indexOf("\n---", 3);
    if (endIdx < 0) return;

    const rest = trimmed.substring(endIdx + 4);
    const yaml = newFields
      .filter((f) => f.key.trim())
      .map((f) => `${f.key}: ${f.value}`)
      .join("\n");
    const newContent = `---\n${yaml}\n---${rest}`;

    window.dispatchEvent(
      new CustomEvent("editor-set-content", {
        detail: { content: newContent },
      }),
    );
  };

  if (!activeTabPath) {
    return (
      <div
        style={{
          padding: "16px",
          color: "var(--text-muted)",
          textAlign: "center",
          fontSize: "13px",
        }}
      >
        Open a note to edit properties
      </div>
    );
  }

  if (!hasFrontmatter) {
    return (
      <div style={{ padding: "16px", textAlign: "center" }}>
        <div
          style={{
            color: "var(--text-muted)",
            fontSize: "13px",
            marginBottom: "8px",
          }}
        >
          No frontmatter in this note
        </div>
        <button className="git-commit-btn" onClick={addFrontmatter}>
          Add Properties
        </button>
      </div>
    );
  }

  return (
    <div className="properties-panel" style={{ padding: "8px" }}>
      <div className="sidebar-section-title" style={{ marginBottom: "8px" }}>
        Properties
      </div>
      {fields.map((field, i) => (
        <div key={i} className="property-row">
          <input
            className="property-key"
            value={field.key}
            onChange={(e) => updateField(i, e.target.value, field.value)}
            placeholder="key"
          />
          <input
            className="property-value"
            value={field.value}
            onChange={(e) => updateField(i, field.key, e.target.value)}
            placeholder="value"
          />
          <button
            className="property-delete"
            onClick={() => removeField(i)}
            title="Remove"
          >
            ×
          </button>
        </div>
      ))}
      <button
        className="property-add"
        onClick={addField}
        style={{ marginTop: "4px" }}
      >
        + Add property
      </button>
    </div>
  );
}
