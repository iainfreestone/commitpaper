import React, { useState, useEffect } from "react";
import { useEditorStore } from "../../stores/editorStore";
import { Editor } from "./Editor";
import { MarkdownPreview } from "./MarkdownPreview";

type ViewMode = "source" | "preview";

export function EditorArea() {
  const { openTabs, activeTabPath, content, closeTab, setActiveTab } =
    useEditorStore();
  const [viewMode, setViewMode] = useState<ViewMode>("source");

  useEffect(() => {
    const handler = () => {
      setViewMode((v) => (v === "source" ? "preview" : "source"));
    };
    window.addEventListener("toggle-preview-mode", handler);
    return () => window.removeEventListener("toggle-preview-mode", handler);
  }, []);

  return (
    <div className="editor-area">
      {openTabs.length > 0 && (
        <div className="tabs-bar">
          {openTabs.map((tab) => (
            <div
              key={tab.path}
              className={`tab ${tab.path === activeTabPath ? "active" : ""}`}
              onClick={() => setActiveTab(tab.path)}
            >
              <span className="tab-name">{tab.name}</span>
              {tab.isDirty && <span className="tab-dirty">●</span>}
              <button
                className="tab-close"
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.path);
                }}
              >
                ×
              </button>
            </div>
          ))}
          {activeTabPath && (
            <div className="view-mode-toggle">
              <button
                className={`view-mode-btn ${viewMode === "source" ? "active" : ""}`}
                onClick={() => setViewMode("source")}
                title="Source mode"
              >
                ✎
              </button>
              <button
                className={`view-mode-btn ${viewMode === "preview" ? "active" : ""}`}
                onClick={() => setViewMode("preview")}
                title="Preview mode"
              >
                👁
              </button>
            </div>
          )}
        </div>
      )}
      <div className="editor-container">
        {activeTabPath ? (
          viewMode === "source" ? (
            <Editor
              key={
                openTabs.find((t) => t.path === activeTabPath)?.id ??
                activeTabPath
              }
              content={content}
              filePath={activeTabPath}
            />
          ) : (
            <MarkdownPreview content={content} />
          )
        ) : (
          <div className="editor-empty">
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "24px", marginBottom: "8px" }}>📝</div>
              <div>Open a note from the sidebar</div>
              <div style={{ fontSize: "12px", marginTop: "4px" }}>
                or press Ctrl+P to search
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
