import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react";
import { Crepe } from "@milkdown/crepe";
import { replaceAll, insert } from "@milkdown/kit/utils";
import {
  editorViewCtx,
  commandsCtx,
  prosePluginsCtx,
} from "@milkdown/kit/core";
import { TextSelection } from "@milkdown/kit/prose/state";
import {
  useEditorStore,
  registerEditorContentProvider,
} from "../../stores/editorStore";
import { saveBinaryFile, writeFile, reindexFile, readFileAsObjectURL } from "../../lib/api";
import { NotePicker } from "./NotePicker";

// Custom ProseMirror plugins
import { calloutPlugin } from "./extensions/calloutPlugin";
import { embedPlugin } from "./extensions/embedPlugin";
import { linkClickPlugin } from "./extensions/linkClickPlugin";
import { mermaidPlugin } from "./extensions/mermaidPlugin";

// Crepe theme styles (structural only — colors driven by app theme variables)
import "@milkdown/crepe/theme/common/style.css";

interface EditorProps {
  filePath: string;
}

const linkIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`;

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

  // NotePicker state
  const [notePickerOpen, setNotePickerOpen] = useState(false);
  const [notePickerAnchor, setNotePickerAnchor] = useState({ x: 0, y: 0 });

  const openNotePicker = useCallback((fromSlashMenu = false) => {
    if (!crepeRef.current || !readyRef.current) return;
    try {
      crepeRef.current.editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);

        // If triggered from slash menu, delete the "/" trigger text
        if (fromSlashMenu) {
          const { state, dispatch } = view;
          const { from } = state.selection;
          // Walk backward from cursor to find the "/"
          const textBefore = state.doc.textBetween(
            Math.max(0, from - 20),
            from,
          );
          const slashIdx = textBefore.lastIndexOf("/");
          if (slashIdx >= 0) {
            const deleteFrom = from - (textBefore.length - slashIdx);
            dispatch(state.tr.delete(deleteFrom, from));
          }
        }

        const coords = view.coordsAtPos(view.state.selection.from);
        setNotePickerAnchor({ x: coords.left, y: coords.bottom + 4 });
      });
    } catch {
      setNotePickerAnchor({
        x: window.innerWidth / 2 - 140,
        y: window.innerHeight / 3,
      });
    }
    setNotePickerOpen(true);
  }, []);

  const handleNoteSelect = useCallback(
    (note: { title: string; path: string }) => {
      setNotePickerOpen(false);
      if (!crepeRef.current || !readyRef.current) return;

      // Insert a proper ProseMirror link (text node with link mark)
      crepeRef.current.editor.action((ctx) => {
        const view = ctx.get(editorViewCtx);
        const { state, dispatch } = view;
        const linkMark = state.schema.marks.link.create({ href: note.path });
        const linkNode = state.schema.text(note.title, [linkMark]);
        const tr = state.tr.replaceSelectionWith(linkNode, false);
        dispatch(tr);
        view.focus();
      });
    },
    [],
  );

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
    let syncTimer: ReturnType<typeof setTimeout> | null = null;

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
        [Crepe.Feature.BlockEdit]: {
          buildMenu: (builder: any) => {
            builder.addGroup("notes", "Notes").addItem("notelink", {
              label: "Link to Note",
              icon: linkIcon,
              onRun: (_ctx: any) => {
                openNotePicker(true);
              },
            });
          },
        },
        [Crepe.Feature.Toolbar]: {
          buildToolbar: (builder: any) => {
            builder.addGroup("notes", "Notes").addItem("notelink", {
              icon: linkIcon,
              active: () => false,
              onRun: (_ctx: any) => {
                openNotePicker();
              },
            });
          },
        },
        [Crepe.Feature.ImageBlock]: {
          onUpload: async (file: File): Promise<string> => {
            const ext = file.name.split(".").pop() || "png";
            const imagePath = `attachments/pasted-${Date.now()}.${ext}`;
            try {
              const buffer = await file.arrayBuffer();
              await saveBinaryFile(
                imagePath,
                Array.from(new Uint8Array(buffer)),
              );
              return imagePath;
            } catch (err) {
              console.error("Failed to upload image:", err);
              return "";
            }
          },
          proxyDomURL: (url: string) => {
            // External URLs (http/https/data/blob) don't need proxying
            if (/^(https?|data|blob):/i.test(url)) return url;
            // Resolve vault-relative paths to blob URLs for rendering
            return readFileAsObjectURL(url);
          },
        },
      },
    });

    // Inject raw ProseMirror plugins (callouts, embeds, mermaid) before create
    crepe.editor.config((ctx) => {
      ctx.update(prosePluginsCtx, (prev) => [
        ...prev,
        calloutPlugin,
        embedPlugin,
        linkClickPlugin,
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

      // Register this editor as the live content provider.
      // saveFile() will call this to get the freshest markdown.
      registerEditorContentProvider(() => {
        try {
          return crepe.getMarkdown();
        } catch {
          return "";
        }
      });

      // Register listeners AFTER create so editorViewCtx is available.
      // Debounce the store sync so rapid edits don't cause re-render storms.
      crepe.on((listener) => {
        listener.markdownUpdated((_ctx, markdown, _prevMarkdown) => {
          if (syncTimer) clearTimeout(syncTimer);
          syncTimer = setTimeout(() => {
            // Guard: only sync if this editor's file is still active.
            // Prevents stale content from overwriting a newly-opened file.
            if (useEditorStore.getState().activeTabPath !== filePath) return;
            setContent(markdown);
            const words = markdown.trim()
              ? markdown.trim().split(/\s+/).length
              : 0;
            setWordCount(words);
          }, 300);
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
        // Flush any pending debounce so store is up-to-date
        if (syncTimer) {
          clearTimeout(syncTimer);
          syncTimer = null;
        }
        // saveFile() will use getFreshContent() → crepe.getMarkdown()
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

      // Cancel pending debounce
      if (syncTimer) {
        clearTimeout(syncTimer);
        syncTimer = null;
      }

      // Flush final content to store and save before destroying.
      // openFile/setActiveTab already await saveFile() before switching,
      // so this is a safety net for edge cases (browser close, force unmount).
      if (crepeRef.current) {
        try {
          const finalMarkdown = crepeRef.current.getMarkdown();
          const state = useEditorStore.getState();
          if (state.activeTabPath === filePath) {
            // Update store directly (bypass debounce/auto-save timers)
            useEditorStore.setState({ content: finalMarkdown });
            // Fire-and-forget save to disk
            if (state.isDirty) {
              writeFile(filePath, finalMarkdown)
                .then(() => reindexFile(filePath))
                .catch(console.error);
            }
          }
        } catch {
          // Editor might already be in a bad state
        }
      }

      // Unregister content provider
      registerEditorContentProvider(null);

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

  return (
    <>
      <div ref={containerRef} className="milkdown-editor-wrapper" />
      {notePickerOpen && (
        <NotePicker
          anchor={notePickerAnchor}
          onSelect={handleNoteSelect}
          onClose={() => setNotePickerOpen(false)}
        />
      )}
    </>
  );
});
