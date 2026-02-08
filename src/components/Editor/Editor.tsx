import React, {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
} from "react";
import { EditorState } from "@codemirror/state";
import {
  EditorView,
  keymap,
  drawSelection,
  highlightActiveLine,
  lineNumbers,
  highlightActiveLineGutter,
} from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  bracketMatching,
  indentOnInput,
} from "@codemirror/language";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { oneDark } from "@codemirror/theme-one-dark";
import { useEditorStore } from "../../stores/editorStore";
import { wikilinkPlugin, wikilinkTheme } from "./extensions/wikilinks";
import { livePreviewPlugin, livePreviewTheme } from "./extensions/livePreview";
import {
  wikilinkAutocomplete,
  wikilinkAutocompleteTheme,
} from "./extensions/wikilinkAutocomplete";
import {
  wikilinkHoverPreview,
  hoverPreviewTheme,
} from "./extensions/hoverPreview";
import { checkboxPlugin, checkboxTheme } from "./extensions/checkboxes";
import { autoBracketKeymap } from "./extensions/autoBrackets";
import { calloutPlugin, calloutTheme } from "./extensions/callouts";
import { mathPlugin, mathTheme } from "./extensions/mathRendering";
import { mermaidPlugin, mermaidTheme } from "./extensions/mermaidRendering";
import { embedPlugin, embedTheme } from "./extensions/noteEmbed";
import { formattingKeymap } from "./extensions/formatting";
import { slashCommandExtension } from "./extensions/slashCommands";
import { bubbleMenuPlugin } from "./extensions/bubbleMenu";
import { smartListKeymap } from "./extensions/smartLists";
import { saveBinaryFile } from "../../lib/api";

interface EditorProps {
  content: string;
  filePath: string;
}

export interface EditorHandle {
  getView: () => EditorView | null;
}

export const Editor = forwardRef<EditorHandle, EditorProps>(function Editor(
  { content, filePath },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const setContent = useEditorStore((s) => s.setContent);
  const saveFile = useEditorStore((s) => s.saveFile);
  const setWordCount = useEditorStore((s) => s.setWordCount);

  useImperativeHandle(ref, () => ({
    getView: () => viewRef.current,
  }));

  useEffect(() => {
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const text = update.state.doc.toString();
        setContent(text);
        const words = text.trim() ? text.trim().split(/\s+/).length : 0;
        setWordCount(words);
      }
    });

    const saveKeymap = keymap.of([
      {
        key: "Mod-s",
        run: () => {
          saveFile();
          return true;
        },
      },
    ]);

    const state = EditorState.create({
      doc: content,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        history(),
        drawSelection(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        markdown({ base: markdownLanguage }),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        oneDark,
        wikilinkPlugin,
        wikilinkTheme,
        livePreviewPlugin,
        livePreviewTheme,
        wikilinkAutocomplete,
        wikilinkAutocompleteTheme,
        wikilinkHoverPreview,
        hoverPreviewTheme,
        checkboxPlugin,
        checkboxTheme,
        autoBracketKeymap,
        calloutPlugin,
        calloutTheme,
        mathPlugin,
        mathTheme,
        mermaidPlugin,
        mermaidTheme,
        embedPlugin,
        embedTheme,
        formattingKeymap, // Must come before default keymaps
        smartListKeymap, // Must come before indentWithTab
        ...slashCommandExtension,
        bubbleMenuPlugin,
        saveKeymap,
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
          ...closeBracketsKeymap,
          indentWithTab,
        ]),
        updateListener,
        EditorView.lineWrapping,
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    const words = content.trim() ? content.trim().split(/\s+/).length : 0;
    setWordCount(words);

    const handleGotoLine = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.line && viewRef.current) {
        const line = viewRef.current.state.doc.line(
          Math.min(detail.line, viewRef.current.state.doc.lines),
        );
        viewRef.current.dispatch({
          selection: { anchor: line.from },
          scrollIntoView: true,
        });
        viewRef.current.focus();
      }
    };
    window.addEventListener("editor-goto-line", handleGotoLine);

    const handleSetContent = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.content != null && viewRef.current) {
        viewRef.current.dispatch({
          changes: {
            from: 0,
            to: viewRef.current.state.doc.length,
            insert: detail.content,
          },
        });
      }
    };
    window.addEventListener("editor-set-content", handleSetContent);

    const handleInsertTemplate = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.content && viewRef.current) {
        const cursor = viewRef.current.state.selection.main.head;
        viewRef.current.dispatch({
          changes: { from: cursor, insert: detail.content },
        });
        viewRef.current.focus();
      }
    };
    window.addEventListener("editor-insert-template", handleInsertTemplate);

    // Handle image paste from clipboard
    const handlePaste = async (e: ClipboardEvent) => {
      if (!viewRef.current || !e.clipboardData) return;
      const items = Array.from(e.clipboardData.items);
      const imageItem = items.find((item) => item.type.startsWith("image/"));
      if (!imageItem) return;

      e.preventDefault();
      const blob = imageItem.getAsFile();
      if (!blob) return;

      const ext = blob.type.split("/")[1] || "png";
      const timestamp = Date.now();
      const imageName = `pasted-${timestamp}.${ext}`;
      const imagePath = `attachments/${imageName}`;

      try {
        const buffer = await blob.arrayBuffer();
        const data = Array.from(new Uint8Array(buffer));
        await saveBinaryFile(imagePath, data);
        const cursor = viewRef.current.state.selection.main.head;
        viewRef.current.dispatch({
          changes: { from: cursor, insert: `![](${imagePath})` },
        });
      } catch (err) {
        console.error("Failed to paste image:", err);
      }
    };
    containerRef.current?.addEventListener("paste", handlePaste);

    return () => {
      window.removeEventListener("editor-goto-line", handleGotoLine);
      window.removeEventListener("editor-set-content", handleSetContent);
      window.removeEventListener(
        "editor-insert-template",
        handleInsertTemplate,
      );
      containerRef.current?.removeEventListener("paste", handlePaste);
      view.destroy();
    };
  }, [filePath]);

  return <div ref={containerRef} style={{ height: "100%" }} />;
});
