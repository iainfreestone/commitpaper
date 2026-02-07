import React, { useState, useEffect } from "react";
import { useEditorStore } from "../../stores/editorStore";
import { useVaultStore } from "../../stores/vaultStore";
import * as api from "../../lib/tauri";
import type { FileTreeNode } from "../../lib/tauri";

function findTemplateFiles(nodes: FileTreeNode[]): string[] {
  const results: string[] = [];

  for (const node of nodes) {
    if (node.type === "folder" && node.name.toLowerCase() === "templates") {
      // Collect all .md files in the templates folder
      if (node.children) {
        collectMdFiles(node.children, results);
      }
    }
  }

  return results;
}

function collectMdFiles(nodes: FileTreeNode[], results: string[]) {
  for (const n of nodes) {
    if (n.type === "file" && n.extension === "md") {
      results.push(n.path);
    }
    if (n.type === "folder" && n.children) {
      collectMdFiles(n.children, results);
    }
  }
}

function formatTemplateName(path: string): string {
  const name = path.split("/").pop() || path;
  return name.replace(/\.md$/, "");
}

export function TemplatesPanel() {
  const fileTree = useVaultStore((s) => s.fileTree);
  const refreshFileTree = useVaultStore((s) => s.refreshFileTree);
  const [templates, setTemplates] = useState<string[]>([]);
  const [showInsert, setShowInsert] = useState(false);

  useEffect(() => {
    setTemplates(findTemplateFiles(fileTree));
  }, [fileTree]);

  const createTemplatesFolder = async () => {
    try {
      await api.createFolder("templates");
      await refreshFileTree();
    } catch (e) {
      console.error("Failed to create templates folder:", e);
    }
  };

  const insertTemplate = async (templatePath: string) => {
    try {
      const templateContent = await api.readFile(templatePath);

      // Process template variables
      const now = new Date();
      const processed = templateContent
        .replace(/\{\{date\}\}/g, now.toISOString().slice(0, 10))
        .replace(/\{\{time\}\}/g, now.toLocaleTimeString())
        .replace(/\{\{datetime\}\}/g, now.toISOString())
        .replace(
          /\{\{title\}\}/g,
          useEditorStore
            .getState()
            .activeTabPath?.split("/")
            .pop()
            ?.replace(/\.md$/, "") || "Untitled",
        );

      // Dispatch to editor to insert at cursor
      window.dispatchEvent(
        new CustomEvent("editor-insert-template", {
          detail: { content: processed },
        }),
      );
      setShowInsert(false);
    } catch (e) {
      console.error("Failed to insert template:", e);
    }
  };

  const createNoteFromTemplate = async (templatePath: string) => {
    try {
      const templateContent = await api.readFile(templatePath);
      const templateName = formatTemplateName(templatePath);
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);

      // Generate a note name
      const notePath = `${templateName}-${dateStr}.md`;

      const processed = templateContent
        .replace(/\{\{date\}\}/g, dateStr)
        .replace(/\{\{time\}\}/g, now.toLocaleTimeString())
        .replace(/\{\{datetime\}\}/g, now.toISOString())
        .replace(/\{\{title\}\}/g, templateName);

      await api.writeFile(notePath, processed);
      await useVaultStore.getState().refreshFileTree();
      await useEditorStore.getState().openFile(notePath);
    } catch (e) {
      console.error("Failed to create from template:", e);
    }
  };

  if (templates.length === 0) {
    return (
      <div style={{ padding: "16px" }}>
        <div
          style={{
            color: "var(--text-muted)",
            fontSize: "13px",
            marginBottom: "8px",
          }}
        >
          No templates found. Create a <code>templates/</code> folder with{" "}
          <code>.md</code> files.
        </div>
        <button className="git-commit-btn" onClick={createTemplatesFolder}>
          Create Templates Folder
        </button>
        <div
          style={{
            color: "var(--text-muted)",
            fontSize: "11px",
            marginTop: "12px",
          }}
        >
          <strong>Template variables:</strong>
          <br />
          {"{{date}}"} — Current date
          <br />
          {"{{time}}"} — Current time
          <br />
          {"{{datetime}}"} — ISO datetime
          <br />
          {"{{title}}"} — Note title
        </div>
      </div>
    );
  }

  return (
    <div className="templates-panel" style={{ padding: "8px" }}>
      <div className="sidebar-section-title">Templates</div>
      <div className="template-list">
        {templates.map((t) => (
          <div key={t} className="template-item">
            <span className="template-name" title={t}>
              {formatTemplateName(t)}
            </span>
            <div className="template-actions">
              <button
                className="template-action-btn"
                onClick={() => insertTemplate(t)}
                title="Insert at cursor"
              >
                ⎘
              </button>
              <button
                className="template-action-btn"
                onClick={() => createNoteFromTemplate(t)}
                title="New note from template"
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
