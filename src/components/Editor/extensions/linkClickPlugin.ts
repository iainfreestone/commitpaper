import { Plugin } from "@milkdown/kit/prose/state";

/**
 * ProseMirror plugin that handles clicks on link marks inside the editor.
 *
 * In contentEditable mode, clicking an <a> tag positions the cursor instead
 * of navigating. This plugin intercepts clicks, checks if the resolved
 * position has a `link` mark, and dispatches navigation via a custom event
 * that App.tsx already listens for ("wikilink-click").
 *
 * Single click = navigate to internal links.
 * External links (http/https) open in a new tab.
 */
export const linkClickPlugin = new Plugin({
  props: {
    handleClick(view, pos, event) {
      // Only handle plain clicks (no shift/alt for selection)
      if (event.shiftKey || event.altKey) return false;

      const { state } = view;
      const $pos = state.doc.resolve(pos);

      // Check if any mark at this position is a link
      const linkMark = $pos.marks().find((m) => m.type.name === "link");

      if (!linkMark) return false;

      const href = linkMark.attrs.href as string | undefined;
      if (!href) return false;

      // External URLs — open in new tab
      if (href.startsWith("http://") || href.startsWith("https://")) {
        window.open(href, "_blank", "noopener,noreferrer");
        event.preventDefault();
        return true;
      }

      // Skip pure anchors
      if (href.startsWith("#")) return false;

      // Internal note link — dispatch the same event App.tsx handles
      event.preventDefault();
      window.dispatchEvent(
        new CustomEvent("wikilink-click", {
          detail: { target: href },
        }),
      );
      return true;
    },
  },
});
