import React, { useRef, useEffect, useCallback } from "react";
import {
  useEditorStore,
  registerEditorContentProvider,
} from "../../stores/editorStore";

interface RawEditorProps {
  filePath: string;
}

export function RawEditor({ filePath }: RawEditorProps) {
  const content = useEditorStore((s) => s.content);
  const setContent = useEditorStore((s) => s.setContent);
  const saveFile = useEditorStore((s) => s.saveFile);
  const setWordCount = useEditorStore((s) => s.setWordCount);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef(content);

  // Keep contentRef in sync so the provider always returns the latest
  contentRef.current = content;

  // Register as the live content provider while mounted
  useEffect(() => {
    registerEditorContentProvider(() => contentRef.current);
    return () => {
      registerEditorContentProvider(null);
    };
  }, []);

  // Focus the textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setContent(value);
      const words = value.trim() ? value.trim().split(/\s+/).length : 0;
      setWordCount(words);
    },
    [setContent, setWordCount],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveFile();
      }
      // Tab inserts a tab character instead of moving focus
      if (e.key === "Tab") {
        e.preventDefault();
        const textarea = textareaRef.current;
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const value = textarea.value;
        const newValue =
          value.substring(0, start) + "\t" + value.substring(end);
        setContent(newValue);
        // Restore cursor position after React re-renders
        requestAnimationFrame(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 1;
        });
      }
    },
    [saveFile, setContent],
  );

  // Handle editor-set-content and editor-insert-template events
  useEffect(() => {
    const handleSetContent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.content != null) {
        setContent(detail.content);
      }
    };
    const handleInsertTemplate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.content && textareaRef.current) {
        const textarea = textareaRef.current;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const value = textarea.value;
        const newValue =
          value.substring(0, start) + detail.content + value.substring(end);
        setContent(newValue);
        requestAnimationFrame(() => {
          const newPos = start + detail.content.length;
          textarea.selectionStart = textarea.selectionEnd = newPos;
        });
      }
    };
    window.addEventListener("editor-set-content", handleSetContent);
    window.addEventListener("editor-insert-template", handleInsertTemplate);
    return () => {
      window.removeEventListener("editor-set-content", handleSetContent);
      window.removeEventListener(
        "editor-insert-template",
        handleInsertTemplate,
      );
    };
  }, [setContent]);

  return (
    <div className="raw-editor-wrapper">
      <textarea
        ref={textareaRef}
        className="raw-editor-textarea"
        value={content}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        spellCheck={false}
      />
    </div>
  );
}
