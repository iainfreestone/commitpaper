import React, { useState, useEffect, useRef, useCallback } from "react";
import { useEditorStore } from "../../stores/editorStore";
import { Editor } from "./Editor";
import type { EditorHandle } from "./Editor";
import { FormattingToolbar } from "./FormattingToolbar";
import type { EditorView } from "@codemirror/view";

export function EditorArea() {
  const { openTabs, activeTabPath, content, closeTab, setActiveTab } =
    useEditorStore();
  const editorRef = useRef<EditorHandle>(null);
  const [editorView, setEditorView] = useState<EditorView | null>(null);

  // Update editorView ref when the editor mounts/changes
  const updateEditorView = useCallback(() => {
    const view = editorRef.current?.getView() ?? null;
    setEditorView(view);
  }, []);

  // Poll briefly after mount to catch the view once CodeMirror initialises
  useEffect(() => {
    const timer = setTimeout(updateEditorView, 50);
    return () => clearTimeout(timer);
  }, [activeTabPath, updateEditorView]);

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
        </div>
      )}
      <div className="editor-container">
        {activeTabPath ? (
          <>
            <FormattingToolbar editorView={editorView} />
            <Editor
              ref={editorRef}
              key={
                openTabs.find((t) => t.path === activeTabPath)?.id ??
                activeTabPath
              }
              content={content}
              filePath={activeTabPath}
            />
          </>
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
