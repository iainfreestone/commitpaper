import React, { useEffect, useRef, useMemo } from "react";
import { useEditorStore } from "../../stores/editorStore";
import katex from "katex";
import mermaid from "mermaid";

let mermaidReady = false;

function ensureMermaid() {
  if (!mermaidReady) {
    mermaid.initialize({
      startOnLoad: false,
      theme: "dark",
      securityLevel: "loose",
      themeVariables: {
        darkMode: true,
        background: "#1e1e2e",
        primaryColor: "#89b4fa",
        primaryTextColor: "#cdd6f4",
        primaryBorderColor: "#585b70",
        lineColor: "#a6adc8",
      },
    });
    mermaidReady = true;
  }
}

function markdownToHtml(md: string): string {
  let html = md;

  if (html.trimStart().startsWith("---")) {
    const end = html.indexOf("\n---", 3);
    if (end > 0) {
      html = html.substring(end + 4);
    }
  }

  html = html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    if (lang === "mermaid") {
      return `<div class="preview-mermaid" data-code="${encodeURIComponent(code.trim())}">Loading diagram…</div>`;
    }
    return `<pre class="preview-code"><code class="language-${lang || "text"}">${code}</code></pre>`;
  });

  html = html.replace(/\$\$([\s\S]*?)\$\$/g, (_, tex) => {
    try {
      return `<div class="preview-math-block">${katex.renderToString(tex.trim(), { displayMode: true, throwOnError: false })}</div>`;
    } catch {
      return `<div class="preview-math-block preview-error">${tex}</div>`;
    }
  });

  html = html.replace(/(?<!\$)\$(?!\$)(.+?)(?<!\$)\$(?!\$)/g, (_, tex) => {
    try {
      return katex.renderToString(tex, {
        displayMode: false,
        throwOnError: false,
      });
    } catch {
      return `<span class="preview-error">${tex}</span>`;
    }
  });

  html = html.replace(
    /^&gt;\s*\[!(\w+)\]\s*(.*?)$((?:\n&gt;.*$)*)/gm,
    (_, type, title, body) => {
      const bodyText = body
        .split("\n")
        .map((l: string) => l.replace(/^&gt;\s?/, ""))
        .join("\n")
        .trim();
      const cleanTitle = title || type.charAt(0).toUpperCase() + type.slice(1);
      const icons: Record<string, string> = {
        note: "📝",
        tip: "💡",
        info: "ℹ️",
        warning: "⚠️",
        danger: "🔴",
        bug: "🐛",
        example: "📋",
        quote: "💬",
        success: "✅",
        question: "❓",
        failure: "❌",
      };
      const colors: Record<string, string> = {
        note: "#89b4fa",
        tip: "#a6e3a1",
        info: "#89dceb",
        warning: "#f9e2af",
        danger: "#f38ba8",
        bug: "#f38ba8",
        example: "#cba6f7",
        quote: "#a6adc8",
        success: "#a6e3a1",
        question: "#f9e2af",
        failure: "#f38ba8",
      };
      const color = colors[type] || colors.note;
      const icon = icons[type] || icons.note;
      return `<div class="preview-callout" style="border-left:3px solid ${color};background:${color}12"><div class="preview-callout-title" style="color:${color}">${icon} ${cleanTitle}</div><div class="preview-callout-body">${bodyText}</div></div>`;
    },
  );

  html = html.replace(/^######\s+(.*)$/gm, "<h6>$1</h6>");
  html = html.replace(/^#####\s+(.*)$/gm, "<h5>$1</h5>");
  html = html.replace(/^####\s+(.*)$/gm, "<h4>$1</h4>");
  html = html.replace(/^###\s+(.*)$/gm, "<h3>$1</h3>");
  html = html.replace(/^##\s+(.*)$/gm, "<h2>$1</h2>");
  html = html.replace(/^#\s+(.*)$/gm, "<h1>$1</h1>");

  html = html.replace(/^(-{3,}|\*{3,}|_{3,})\s*$/gm, "<hr />");

  html = html.replace(
    /^(\|.+\|)\n(\|[\s:|-]+\|)\n((?:\|.+\|\n?)*)/gm,
    (_, header, separator, body) => {
      const alignments = separator
        .split("|")
        .filter((c: string) => c.trim())
        .map((c: string) => {
          const t = c.trim();
          if (t.startsWith(":") && t.endsWith(":")) return "center";
          if (t.endsWith(":")) return "right";
          return "left";
        });
      const headerCells = header
        .split("|")
        .filter((c: string) => c.trim())
        .map(
          (c: string, i: number) =>
            `<th style="text-align:${alignments[i] || "left"}">${c.trim()}</th>`,
        )
        .join("");
      const bodyRows = body
        .trim()
        .split("\n")
        .filter((r: string) => r.trim())
        .map((row: string) => {
          const cells = row
            .split("|")
            .filter((c: string) => c.trim() !== "")
            .map(
              (c: string, i: number) =>
                `<td style="text-align:${alignments[i] || "left"}">${c.trim()}</td>`,
            )
            .join("");
          return `<tr>${cells}</tr>`;
        })
        .join("");
      return `<table class="preview-table"><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
    },
  );

  html = html.replace(/\*\*\*(.+?)\*\*\*/g, "<strong><em>$1</em></strong>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/~~(.+?)~~/g, "<del>$1</del>");
  html = html.replace(/==(.+?)==/g, "<mark>$1</mark>");
  html = html.replace(
    /`([^`]+)`/g,
    '<code class="preview-inline-code">$1</code>',
  );
  html = html.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    '<img src="$2" alt="$1" style="max-width:100%;border-radius:6px;" />',
  );
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" class="preview-link">$1</a>',
  );
  html = html.replace(
    /\[\[([^\]|]+)\|([^\]]+)\]\]/g,
    '<span class="preview-wikilink" data-wikilink="$1" role="link" tabindex="0">$2</span>',
  );
  html = html.replace(
    /\[\[([^\]]+)\]\]/g,
    '<span class="preview-wikilink" data-wikilink="$1" role="link" tabindex="0">$1</span>',
  );
  html = html.replace(
    /^- \[x\]\s+(.*)/gm,
    '<div class="preview-checkbox checked">☑ <del>$1</del></div>',
  );
  html = html.replace(
    /^- \[ \]\s+(.*)/gm,
    '<div class="preview-checkbox">☐ $1</div>',
  );
  html = html.replace(/^- (.*)$/gm, "<li>$1</li>");
  html = html.replace(/^\d+\.\s+(.*)$/gm, "<li>$1</li>");
  html = html.replace(/^&gt;\s?(.*)/gm, "<blockquote>$1</blockquote>");
  html = html.replace(/\n{2,}/g, "\n<p></p>\n");

  return html;
}

interface MarkdownPreviewProps {
  content: string;
}

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendered = useMemo(() => markdownToHtml(content), [content]);

  useEffect(() => {
    if (!containerRef.current) return;
    const handleClick = (e: MouseEvent) => {
      // Handle legacy [[wikilink]] clicks
      const wlEl = (e.target as HTMLElement).closest("[data-wikilink]");
      if (wlEl) {
        const target = wlEl.getAttribute("data-wikilink");
        if (target) {
          window.dispatchEvent(
            new CustomEvent("wikilink-click", { detail: { target } }),
          );
        }
        return;
      }

      // Handle standard link clicks (internal .md links)
      const anchor = (e.target as HTMLElement).closest("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href) return;
      if (href.startsWith("http://") || href.startsWith("https://")) return;
      if (href.startsWith("#")) return;
      // Internal link — dispatch as wikilink-click for App.tsx to handle
      e.preventDefault();
      window.dispatchEvent(
        new CustomEvent("wikilink-click", { detail: { target: href } }),
      );
    };
    containerRef.current.addEventListener("click", handleClick);
    const container = containerRef.current;
    return () => container.removeEventListener("click", handleClick);
  }, [rendered]);

  useEffect(() => {
    if (!containerRef.current) return;
    ensureMermaid();

    const mermaidDivs =
      containerRef.current.querySelectorAll(".preview-mermaid");
    mermaidDivs.forEach(async (div, idx) => {
      const code = decodeURIComponent(div.getAttribute("data-code") || "");
      if (!code) return;
      try {
        const { svg } = await mermaid.render(
          `preview-mermaid-${Date.now()}-${idx}`,
          code,
        );
        div.innerHTML = svg;
      } catch (err: any) {
        div.textContent = `Diagram error: ${err.message || err}`;
        (div as HTMLElement).style.color = "#f38ba8";
      }
    });
  }, [rendered]);

  return (
    <div
      ref={containerRef}
      className="markdown-preview"
      dangerouslySetInnerHTML={{ __html: rendered }}
    />
  );
}
