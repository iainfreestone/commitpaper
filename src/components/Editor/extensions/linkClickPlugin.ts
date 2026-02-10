import { Plugin, PluginKey } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";

const linkTooltipKey = new PluginKey("link-hover-tooltip");

/**
 * ProseMirror plugin that handles clicks on link marks inside the editor.
 *
 * In contentEditable mode, clicking an <a> tag positions the cursor instead
 * of navigating. This plugin intercepts Ctrl/Cmd+clicks, checks if the
 * resolved position has a `link` mark, and dispatches navigation via a
 * custom event that App.tsx already listens for ("wikilink-click").
 *
 * Plain click        = normal cursor placement (editing)
 * Ctrl/Cmd + click   = navigate to internal links / open external links
 *
 * A tooltip appears on hover to show the link destination and hints the
 * user to Ctrl+click. Holding Ctrl changes the cursor to a pointer.
 */

/** Create and manage the link hover tooltip element */
let tooltipEl: HTMLDivElement | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;

function getTooltip(): HTMLDivElement {
  if (!tooltipEl) {
    tooltipEl = document.createElement("div");
    tooltipEl.className = "link-hover-tooltip";
    document.body.appendChild(tooltipEl);
  }
  return tooltipEl;
}

function showTooltip(href: string, x: number, y: number) {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  const tip = getTooltip();
  const displayHref =
    href.length > 60 ? href.substring(0, 57) + "..." : href;
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
  const modKey = isMac ? "⌘" : "Ctrl";
  tip.innerHTML = `<span class="link-hover-href">${displayHref}</span><span class="link-hover-hint">${modKey}+click to follow</span>`;
  tip.style.left = `${x}px`;
  tip.style.top = `${y}px`;
  tip.style.display = "block";
  // Nudge left if overflowing viewport
  requestAnimationFrame(() => {
    const rect = tip.getBoundingClientRect();
    if (rect.right > window.innerWidth - 8) {
      tip.style.left = `${window.innerWidth - rect.width - 8}px`;
    }
  });
}

function hideTooltip() {
  hideTimer = setTimeout(() => {
    if (tooltipEl) tooltipEl.style.display = "none";
  }, 120);
}

export const linkClickPlugin = new Plugin({
  props: {
    handleClick(view, pos, event) {
      // Require Ctrl (or Cmd on Mac) to follow links
      const isModClick = event.ctrlKey || event.metaKey;
      if (!isModClick) return false;

      // Ignore other modifier combos
      if (event.shiftKey || event.altKey) return false;

      const { state } = view;
      const $pos = state.doc.resolve(pos);

      // Check if any mark at this position is a link
      const linkMark = $pos.marks().find((m) => m.type.name === "link");

      if (!linkMark) return false;

      const href = linkMark.attrs.href as string | undefined;
      if (!href) return false;

      // Hide tooltip on navigation
      if (tooltipEl) tooltipEl.style.display = "none";

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

    handleDOMEvents: {
      mouseover(view, event) {
        const target = event.target as HTMLElement;
        // Only handle <a> elements inside the editor
        const anchor = target.closest?.("a[href]") as HTMLAnchorElement | null;
        if (!anchor) return false;

        const href = anchor.getAttribute("href");
        if (!href) return false;

        const rect = anchor.getBoundingClientRect();
        showTooltip(href, rect.left, rect.bottom + 4);
        return false;
      },
      mouseout(view, event) {
        const target = event.target as HTMLElement;
        if (target.closest?.("a[href]")) {
          hideTooltip();
        }
        return false;
      },
      keydown(view, event) {
        // Toggle pointer cursor class when Ctrl/Cmd pressed
        if (event.key === "Control" || event.key === "Meta") {
          view.dom.classList.add("link-ctrl-held");
        }
        return false;
      },
      keyup(view, event) {
        if (event.key === "Control" || event.key === "Meta") {
          view.dom.classList.remove("link-ctrl-held");
        }
        return false;
      },
      blur(view) {
        view.dom.classList.remove("link-ctrl-held");
        hideTooltip();
        return false;
      },
    },
  },
});
