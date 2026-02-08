import React, { useRef } from "react";
import { useEditorStore } from "../../stores/editorStore";
import { Editor } from "./Editor";
import type { EditorHandle } from "./Editor";

export function EditorArea() {
  const openTabs = useEditorStore((s) => s.openTabs);
  const activeTabPath = useEditorStore((s) => s.activeTabPath);
  const closeTab = useEditorStore((s) => s.closeTab);
  const setActiveTab = useEditorStore((s) => s.setActiveTab);
  const editorRef = useRef<EditorHandle>(null);

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
            <Editor
              ref={editorRef}
              key={
                openTabs.find((t) => t.path === activeTabPath)?.id ??
                activeTabPath
              }
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
