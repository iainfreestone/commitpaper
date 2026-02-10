/**
 * Lightweight wrapper around Google Analytics gtag.js.
 *
 * All custom event names follow the GA4 recommended naming convention
 * (snake_case, ≤ 40 chars). No PII is ever sent — we only track action
 * counts and feature names, never file names, note content, or user data.
 */

// Extend window for gtag
declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Fire a GA4 custom event. Silently no-ops if gtag isn't loaded
 * (e.g. blocked by an ad-blocker).
 */
export function trackEvent(
  eventName: string,
  params?: Record<string, string | number | boolean>,
) {
  try {
    window.gtag?.("event", eventName, params);
  } catch {
    // Never let analytics break the app
  }
}

// ── Vault ────────────────────────────────────────────────────────────

export function trackVaultOpened() {
  trackEvent("vault_opened");
}

export function trackVaultClosed() {
  trackEvent("vault_closed");
}

// ── Notes ────────────────────────────────────────────────────────────

export function trackNoteCreated() {
  trackEvent("note_created");
}

export function trackFolderCreated() {
  trackEvent("folder_created");
}

export function trackNoteOpened() {
  trackEvent("note_opened");
}

export function trackNoteDeleted() {
  trackEvent("note_deleted");
}

export function trackNoteRenamed() {
  trackEvent("note_renamed");
}

// ── Editor ───────────────────────────────────────────────────────────

export function trackEditorModeToggled(mode: string) {
  trackEvent("editor_mode_toggled", { mode });
}

export function trackEditorWidthChanged(width: string) {
  trackEvent("editor_width_changed", { width });
}

export function trackFontSizeChanged(size: number) {
  trackEvent("font_size_changed", { size });
}

export function trackLineNumbersToggled(enabled: boolean) {
  trackEvent("line_numbers_toggled", { enabled });
}

// ── Git ──────────────────────────────────────────────────────────────

export function trackGitRepoInitialised() {
  trackEvent("git_repo_initialised");
}

export function trackGitCommit() {
  trackEvent("git_commit");
}

export function trackGitPush() {
  trackEvent("git_push");
}

export function trackGitBranchCreated() {
  trackEvent("git_branch_created");
}

export function trackGitBranchSwitched() {
  trackEvent("git_branch_switched");
}

// ── Theme ────────────────────────────────────────────────────────────

export function trackThemeChanged(theme: string) {
  trackEvent("theme_changed", { theme });
}

// ── Features ─────────────────────────────────────────────────────────

export function trackSearchUsed(resultCount: number) {
  trackEvent("search_used", { result_count: resultCount });
}

export function trackGraphViewed(mode: string) {
  trackEvent("graph_viewed", { mode });
}

export function trackRightPanelTab(tab: string) {
  trackEvent("right_panel_tab", { tab });
}

export function trackCommandPaletteOpened() {
  trackEvent("command_palette_opened");
}
