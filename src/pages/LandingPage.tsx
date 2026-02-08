import { Link } from "react-router-dom";

export default function LandingPage() {
  return (
    <div className="landing-page">
      {/* Navigation */}
      <nav className="landing-nav">
        <div className="landing-nav-logo">CommitPaper</div>
        <div className="landing-nav-links">
          <a href="#features">Features</a>
          <a href="#how-it-works">How It Works</a>
          <a href="#faq">FAQ</a>
          <Link to="/app" className="nav-cta">
            Open App
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="landing-hero">
        <h1>
          Your notes. Your folder.
          <br />
          <span className="accent">Your rules.</span>
        </h1>
        <p className="tagline">
          A free, open-source note-taking app that works with any folder on your
          computer. No cloud accounts, no subscriptions, no proprietary formats.
          Just Markdown files — add Git for sync and version history.
        </p>
        <div className="landing-hero-actions">
          <Link to="/app" className="hero-btn-primary">
            Open in Browser
          </Link>
          <a
            href="https://github.com/IainMcl/commitpaper"
            target="_blank"
            rel="noopener noreferrer"
            className="hero-btn-secondary"
          >
            View on GitHub
          </a>
        </div>
        <div className="hero-badges">
          <span>&#x1F4DD; Plain Markdown</span>
          <span>&#x1F4C2; Any Folder</span>
          <span>&#x1F500; Git Ready</span>
          <span>&#x1F512; Local First</span>
          <span>&#x26A1; Fast &amp; Light</span>
        </div>
        <div className="browser-support-note">
          &#x26A0;&#xFE0F; Web version requires Chrome or Edge (File System
          Access API)
        </div>
      </section>

      {/* Why CommitPaper */}
      <section className="landing-section">
        <h2>Why CommitPaper?</h2>
        <p className="section-subtitle">
          Most note-taking apps lock you into their ecosystem. Your notes live
          on someone else's server, in someone else's format, behind someone
          else's paywall. CommitPaper takes a different approach.
        </p>
        <div className="value-grid">
          <div className="value-item">
            <div className="value-item-icon">&#x1F4C4;</div>
            <h4>Plain Markdown</h4>
            <p>Open your notes in any editor, on any device, forever.</p>
          </div>
          <div className="value-item">
            <div className="value-item-icon">&#x1F4C2;</div>
            <h4>Any Folder</h4>
            <p>
              Pick any folder on your computer. No special setup or Git
              required.
            </p>
          </div>
          <div className="value-item">
            <div className="value-item-icon">&#x1F500;</div>
            <h4>Git Ready</h4>
            <p>
              Add Git for version history and cross-device sync via GitHub,
              GitLab, or your own server.
            </p>
          </div>
          <div className="value-item">
            <div className="value-item-icon">&#x1F4BB;</div>
            <h4>Local First</h4>
            <p>
              Everything runs on your machine. No internet required to write.
            </p>
          </div>
        </div>
      </section>

      {/* Layout overview */}
      <section className="landing-section">
        <h2>What It Looks Like</h2>
        <p className="section-subtitle">
          A clean, dark interface built around three panels — sidebar for
          navigation, editor for writing, and a right panel for context.
        </p>
        <table className="tech-stack-table">
          <thead>
            <tr>
              <th>Panel</th>
              <th>What it does</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>Sidebar</strong> (left)
              </td>
              <td>
                Browse files, search notes, manage Git, view tags, open daily
                notes, insert templates
              </td>
            </tr>
            <tr>
              <td>
                <strong>Editor</strong> (centre)
              </td>
              <td>
                Write in Markdown with live inline rendering — or switch to a
                full preview
              </td>
            </tr>
            <tr>
              <td>
                <strong>Right panel</strong>
              </td>
              <td>
                See your outline, backlinks, properties, file history, and
                knowledge graph
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* Features */}
      <section className="landing-section" id="features">
        <h2>Features</h2>
        <p className="section-subtitle">
          Everything you need for a powerful note-taking workflow, built in from
          day one.
        </p>
        <div className="feature-grid">
          <div className="feature-card">
            <div className="feature-card-icon">&#x270D;&#xFE0F;</div>
            <h3>Write Naturally</h3>
            <p>
              The editor understands Markdown deeply. Headings render at their
              actual size, bold appears bold, code blocks get syntax-coloured
              backgrounds, and images render inline. Press Ctrl+E for a full
              preview.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-card-icon">&#x1F517;</div>
            <h3>Link Your Thinking</h3>
            <p>
              Connect ideas with [[wikilinks]]. Autocomplete shows every note in
              your vault. Hover to preview, click to navigate. The Backlinks
              panel traces connections in both directions.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-card-icon">&#x1F578;&#xFE0F;</div>
            <h3>Visualise Your Knowledge</h3>
            <p>
              The Graph View renders your entire vault as an interactive
              network. Each note is a node, each wikilink is an edge. Click to
              open, drag to rearrange, scroll to zoom.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-card-icon">&#x1F500;</div>
            <h3>Git Integration (Optional)</h3>
            <p>
              If your vault is a Git repo, see your branch and modified files at
              a glance. Use your terminal to commit, push, and sync across
              devices. Not using Git? Everything else works just the same.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-card-icon">&#x1F4C5;</div>
            <h3>Daily Notes</h3>
            <p>
              Press Alt+D to open today's note. Auto-created with a dated
              template including sections for tasks, notes, and journaling. The
              sidebar shows your last seven days.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-card-icon">&#x1F4CB;</div>
            <h3>Templates</h3>
            <p>
              Create templates with variables like {"{{date}}"}, {"{{title}}"},{" "}
              {"{{time}}"}. Insert at cursor or create a new note from a
              template with one click.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-card-icon">&#x2728;</div>
            <h3>Rich Content</h3>
            <p>
              Callouts, LaTeX math (KaTeX), Mermaid diagrams, interactive
              checkboxes, tables with alignment, and clipboard image paste — all
              rendered live.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-card-icon">&#x1F50D;</div>
            <h3>Search Everything</h3>
            <p>
              Command palette (Ctrl+P) for fuzzy file search. Full-text search
              across every note with ranked results and highlighted snippets.
            </p>
          </div>
        </div>
      </section>

      {/* Keyboard shortcuts */}
      <section className="landing-section">
        <h2>Keyboard Shortcuts</h2>
        <table className="shortcuts-table">
          <thead>
            <tr>
              <th>Shortcut</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <kbd>Ctrl+S</kbd>
              </td>
              <td>Save</td>
            </tr>
            <tr>
              <td>
                <kbd>Ctrl+P</kbd>
              </td>
              <td>Command palette</td>
            </tr>
            <tr>
              <td>
                <kbd>Ctrl+E</kbd>
              </td>
              <td>Toggle source / preview</td>
            </tr>
            <tr>
              <td>
                <kbd>Ctrl+B</kbd>
              </td>
              <td>Toggle right panel</td>
            </tr>
            <tr>
              <td>
                <kbd>Alt+D</kbd>
              </td>
              <td>Today's daily note</td>
            </tr>
            <tr>
              <td>
                <kbd>Ctrl+F</kbd>
              </td>
              <td>Find in file</td>
            </tr>
            <tr>
              <td>
                <kbd>Ctrl+H</kbd>
              </td>
              <td>Find and replace</td>
            </tr>
            <tr>
              <td>
                <kbd>Ctrl+Z</kbd>
              </td>
              <td>Undo</td>
            </tr>
            <tr>
              <td>
                <kbd>Ctrl+Shift+Z</kbd>
              </td>
              <td>Redo</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* How it works */}
      <section className="landing-section" id="how-it-works">
        <h2>How It Works</h2>
        <p className="section-subtitle">
          The web version runs entirely in your browser using the File System
          Access API. Pick a folder, and CommitPaper reads and writes your
          Markdown files directly — no server, no uploads, nothing leaves your
          machine.
        </p>
        <div className="feature-grid">
          <div className="feature-card">
            <div className="feature-card-icon">&#x1F4C2;</div>
            <h3>1. Open a Folder</h3>
            <p>
              Click "Open Vault" and select any folder on your machine. Your
              browser asks for permission once per session.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-card-icon">&#x270F;&#xFE0F;</div>
            <h3>2. Start Writing</h3>
            <p>
              Create notes, link ideas, and organise with folders. Auto-save
              keeps your work safe — changes are written directly to disk.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-card-icon">&#x1F500;</div>
            <h3>3. Add Git (Optional)</h3>
            <p>
              Want version history and cross-device sync? Initialise a Git repo
              in your vault. CommitPaper will show your branch and modified
              files. Use your terminal to commit and push.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-card-icon">&#x1F310;</div>
            <h3>Works Offline</h3>
            <p>
              Once loaded, CommitPaper works fully offline as a Progressive Web
              App. No internet needed for writing and organising.
            </p>
          </div>
        </div>
      </section>

      {/* Tech stack */}
      <section className="landing-section">
        <h2>Tech Stack</h2>
        <table className="tech-stack-table">
          <thead>
            <tr>
              <th>Layer</th>
              <th>Technology</th>
              <th>Why</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>UI Framework</td>
              <td>React 19</td>
              <td>Component-driven, fast rendering</td>
            </tr>
            <tr>
              <td>Editor</td>
              <td>CodeMirror 6</td>
              <td>Extensible, performant, modern editor toolkit</td>
            </tr>
            <tr>
              <td>Type Safety</td>
              <td>TypeScript 5</td>
              <td>Catch bugs before they ship</td>
            </tr>
            <tr>
              <td>Build Tool</td>
              <td>Vite 7</td>
              <td>Instant HMR, fast builds</td>
            </tr>
            <tr>
              <td>State</td>
              <td>Zustand 5</td>
              <td>Minimal, flexible state management</td>
            </tr>
            <tr>
              <td>Graph</td>
              <td>Cytoscape.js</td>
              <td>Battle-tested graph visualisation</td>
            </tr>
            <tr>
              <td>Math</td>
              <td>KaTeX</td>
              <td>Fast LaTeX rendering</td>
            </tr>
            <tr>
              <td>Diagrams</td>
              <td>Mermaid</td>
              <td>Declarative diagrams from text</td>
            </tr>
            <tr>
              <td>Search</td>
              <td>MiniSearch</td>
              <td>Client-side full-text search</td>
            </tr>
            <tr>
              <td>File Access</td>
              <td>File System Access API</td>
              <td>Direct filesystem read/write in the browser</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* FAQ */}
      <section className="landing-section" id="faq">
        <h2>FAQ</h2>
        <div className="faq-list">
          <div className="faq-item">
            <h4>Is this a replacement for Obsidian?</h4>
            <p>
              It's inspired by Obsidian but takes a different approach.
              CommitPaper works with any folder on your computer and optionally
              integrates with Git for sync and version history. Where Obsidian
              has a plugin ecosystem, CommitPaper has the features built in. If
              you want a lightweight, local-first note app that works with plain
              Markdown files, CommitPaper is for you.
            </p>
          </div>
          <div className="faq-item">
            <h4>Does it work with existing Obsidian vaults?</h4>
            <p>
              Yes. CommitPaper reads standard Markdown files and supports
              Obsidian-flavoured syntax including wikilinks, callouts, and
              frontmatter. Point it at your existing vault folder.
            </p>
          </div>
          <div className="faq-item">
            <h4>What browsers are supported?</h4>
            <p>
              CommitPaper requires Chrome 86+ or Edge 86+ for the File System
              Access API. Firefox and Safari don't support this API yet.
            </p>
          </div>
          <div className="faq-item">
            <h4>Is it free?</h4>
            <p>Yes. MIT licensed, free forever.</p>
          </div>
          <div className="faq-item">
            <h4>Where is my data stored?</h4>
            <p>
              On your filesystem, in the folder you choose. CommitPaper doesn't
              store data anywhere else. Nothing is uploaded. Nothing leaves your
              browser.
            </p>
          </div>
          <div className="faq-item">
            <h4>Can I use it offline?</h4>
            <p>
              Absolutely. Once loaded, everything works offline as a PWA.
              Writing, searching, and organising are fully local.
            </p>
          </div>
          <div className="faq-item">
            <h4>Do I need Git?</h4>
            <p>
              No. CommitPaper works with any folder. Git is entirely optional —
              but if you want version history or to sync notes across computers,
              initialising a Git repo is a great way to get both.
            </p>
          </div>
          <div className="faq-item">
            <h4>Can I commit and push from the web version?</h4>
            <p>
              Not yet — browsers can't run Git operations directly. If your
              vault is a Git repo, the web version shows your branch and
              modified files, but you'll need a terminal or desktop Git client
              for commits, pushes, and pulls.
            </p>
          </div>
        </div>
      </section>

      {/* Philosophy */}
      <section className="landing-section">
        <h2>Philosophy</h2>
        <div className="value-grid">
          <div className="value-item">
            <div className="value-item-icon">&#x1F3E0;</div>
            <h4>Local First</h4>
            <p>
              Your files live on your machine. You choose if and where to sync
              them.
            </p>
          </div>
          <div className="value-item">
            <div className="value-item-icon">&#x1F4DD;</div>
            <h4>Plain Text</h4>
            <p>
              Markdown is the format. No proprietary schemas, no binary blobs.
            </p>
          </div>
          <div className="value-item">
            <div className="value-item-icon">&#x1F500;</div>
            <h4>Git Ready</h4>
            <p>
              Add Git for version history and sync — or don't. It's your choice.
            </p>
          </div>
          <div className="value-item">
            <div className="value-item-icon">&#x1F513;</div>
            <h4>Open Source</h4>
            <p>MIT licensed. Read the code, fork it, make it yours.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <p>
          CommitPaper — MIT Licensed —{" "}
          <a
            href="https://github.com/IainMcl/commitpaper"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
        </p>
      </footer>
    </div>
  );
}
