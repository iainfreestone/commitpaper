import React, {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
} from "react";
import { Crepe } from "@milkdown/crepe";
import { replaceAll, insert } from "@milkdown/kit/utils";
import { editorViewCtx, prosePluginsCtx } from "@milkdown/kit/core";
import { TextSelection } from "@milkdown/kit/prose/state";
import { useEditorStore } from "../../stores/editorStore";
import { saveBinaryFile } from "../../lib/api";

// Custom ProseMirror plugins
import { wikilinkPlugin } from "./extensions/wikilinkPlugin";
import { calloutPlugin } from "./extensions/calloutPlugin";
import { embedPlugin } from "./extensions/embedPlugin";
import { mermaidPlugin } from "./extensions/mermaidPlugin";

// Crepe theme styles
import "@milkdown/crepe/theme/common/style.css";
import "@milkdown/crepe/theme/frame-dark.css";

interface EditorProps {
  filePath: string;
}

export interface EditorHandle {
  getCrepe: () => Crepe | null;
  getMarkdown: () => string;
}

export const Editor = forwardRef<EditorHandle, EditorProps>(function Editor(
  { filePath },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const crepeRef = useRef<Crepe | null>(null);
  const readyRef = useRef(false);
  const setContent = useEditorStore((s) => s.setContent);
  const saveFile = useEditorStore((s) => s.saveFile);
  const setWordCount = useEditorStore((s) => s.setWordCount);

  useImperativeHandle(ref, () => ({
    getCrepe: () => crepeRef.current,
    getMarkdown: () => {
      if (!readyRef.current || !crepeRef.current) return "";
      try {
        return crepeRef.current.getMarkdown();
      } catch {
        return "";
      }
    },
  }));

  useEffect(() => {
    if (!containerRef.current) return;
    let destroyed = false;

    // Read initial content from the store once; don't pass as prop to avoid
    // re-rendering the entire Editor component on every keystroke.
    const initialContent = useEditorStore.getState().content;

    const crepe = new Crepe({
      root: containerRef.current,
      defaultValue: initialContent,
      features: {
        [Crepe.Feature.CodeMirror]: true,
        [Crepe.Feature.ListItem]: true,
        [Crepe.Feature.LinkTooltip]: true,
        [Crepe.Feature.ImageBlock]: true,
        [Crepe.Feature.BlockEdit]: true,
        [Crepe.Feature.Placeholder]: true,
        [Crepe.Feature.Toolbar]: true,
        [Crepe.Feature.Table]: true,
        [Crepe.Feature.Latex]: true,
        [Crepe.Feature.Cursor]: true,
      },
      featureConfigs: {
        [Crepe.Feature.Placeholder]: {
          text: "Start writing, or type '/' for commands...",
          mode: "doc",
        },
        [Crepe.Feature.Latex]: {
          katexOptions: { throwOnError: false },
        },
        [Crepe.Feature.ImageBlock]: {
          onUpload: async (file: File): Promise<string> => {
            const ext = file.name.split(".").pop() || "png";
            const imagePath = `attachments/pasted-${Date.now()}.${ext}`;
            try {
              const buffer = await file.arrayBuffer();
              await saveBinaryFile(imagePath, Array.from(new Uint8Array(buffer)));
              return imagePath;
            } catch (err) {
              console.error("Failed to upload image:", err);
              return "";
            }
          },
        },
      },
    });

    // Inject custom ProseMirror plugins before create
    crepe.editor.config((ctx) => {
      ctx.update(prosePluginsCtx, (prev) => [
        ...prev,
        wikilinkPlugin,
        calloutPlugin,
        embedPlugin,
        mermaidPlugin,
      ]);
    });

    crepe.create().then(() => {
      if (destroyed) {
        crepe.destroy();
        return;
      }

      crepeRef.current = crepe;
      readyRef.current = true;

      // Register listeners AFTER create so editorViewCtx is available.
      // Debounce the store sync so rapid edits don't cause re-render storms.
      let syncTimer: ReturnType<typeof setTimeout> | null = null;
      crepe.on((listener) => {
        listener.markdownUpdated((_ctx, markdown, _prevMarkdown) => {
          if (syncTimer) clearTimeout(syncTimer);
          syncTimer = setTimeout(() => {
            setContent(markdown);
            const words = markdown.trim()
              ? markdown.trim().split(/\s+/).length
              : 0;
            setWordCount(words);
          }, 100);
        });
      });

      // Initial word count
      const words = initialContent.trim()
        ? initialContent.trim().split(/\s+/).length
        : 0;
      setWordCount(words);
    });

    // Handle Ctrl+S save
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveFile();
      }
    };
    containerRef.current.addEventListener("keydown", handleKeyDown);

    // Handle editor-set-content events
    const handleSetContent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.content != null && readyRef.current && crepeRef.current) {
        crepeRef.current.editor.action(replaceAll(detail.content));
      }
    };
    window.addEventListener("editor-set-content", handleSetContent);

    // Handle editor-insert-template events
    const handleInsertTemplate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.content && readyRef.current && crepeRef.current) {
        crepeRef.current.editor.action(insert(detail.content));
      }
    };
    window.addEventListener("editor-insert-template", handleInsertTemplate);

    // Handle editor-goto-line events
    const handleGotoLine = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.line && readyRef.current && crepeRef.current) {
        crepeRef.current.editor.action((ctx) => {
          const view = ctx.get(editorViewCtx);
          const doc = view.state.doc;
          let pos = 0;
          let lineCount = 0;
          doc.descendants((node, nodePos) => {
            if (node.isBlock) {
              lineCount++;
              if (lineCount <= detail.line) {
                pos = nodePos;
              }
            }
            return lineCount <= detail.line;
          });
          view.dispatch(
            view.state.tr.setSelection(TextSelection.near(doc.resolve(pos))),
          );
          view.focus();
        });
      }
    };
    window.addEventListener("editor-goto-line", handleGotoLine);

    const containerEl = containerRef.current;

    return () => {
      destroyed = true;
      readyRef.current = false;
      containerEl?.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("editor-set-content", handleSetContent);
      window.removeEventListener(
        "editor-insert-template",
        handleInsertTemplate,
      );
      window.removeEventListener("editor-goto-line", handleGotoLine);
      if (crepeRef.current) {
        crepeRef.current.destroy();
        crepeRef.current = null;
      }
    };
  }, [filePath]);

  return <div ref={containerRef} className="milkdown-editor-wrapper" />;
});
