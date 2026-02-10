import { Link } from "react-router-dom";
import { useEffect } from "react";

export default function LandingPage() {
  // Set SEO meta tags for the landing page
  useEffect(() => {
    document.title =
      "CommitPaper — Free Markdown Note-Taking App | Local-First, No Cloud";
    const meta = document.querySelector('meta[name="description"]');
    if (meta) {
      meta.setAttribute(
        "content",
        "A free note-taking app that works with any folder on your computer. Write in Markdown, link your thinking, visualise your knowledge graph, and sync with Dropbox, Google Drive, or Git. No cloud accounts, no subscriptions — runs entirely in your browser.",
      );
    }
    return () => {
      document.title = "CommitPaper";
    };
  }, []);

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
            Try It Now
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="landing-hero">
        <h1>
          Note-taking that
          <br />
          <span className="accent">respects your files.</span>
        </h1>
        <p className="tagline">
          A free Markdown editor that works with any folder on your computer. No
          sign-up. No cloud lock-in. Just open a folder and start writing.
        </p>
        <div className="landing-hero-actions">
          <Link to="/app" className="hero-btn-primary">
            Open CommitPaper — It's Free
          </Link>
        </div>
        <div className="hero-badges">
          <span>&#x2705; No sign-up required</span>
          <span>&#x1F4C2; Works with any folder</span>
          <span>&#x2601;&#xFE0F; Syncs via Dropbox / Drive / OneDrive</span>
          <span>&#x1F512; 100% local &amp; private</span>
        </div>
        <p className="hero-social-proof">
          Free forever &middot; Works offline as a PWA
        </p>
      </section>

      {/* How it works — simple 3-step */}
      <section className="landing-section" id="how-it-works">
        <h2>Start writing in 30 seconds</h2>
        <p className="section-subtitle">
          No installation, no account creation, no configuration. Just open a
          folder.
        </p>
        <div className="steps-grid">
          <div className="step-card">
            <div className="step-number">1</div>
            <h3>Open a folder</h3>
            <p>
              Click "Open Folder" and pick any folder on your computer. That's
              your notebook.
            </p>
          </div>
          <div className="step-card">
            <div className="step-number">2</div>
            <h3>Start writing</h3>
            <p>
              Create notes in Markdown. Everything auto-saves and stays on your
              machine.
            </p>
          </div>
          <div className="step-card">
            <div className="step-number">3</div>
            <h3>Sync your way</h3>
            <p>
              Put your folder in Dropbox, Google Drive, or OneDrive. Or add Git
              for version history.
            </p>
          </div>
        </div>
        <div className="section-cta">
          <Link to="/app" className="hero-btn-primary">
            Try It Now
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="landing-section" id="features">
        <h2>Everything you need, nothing you don't</h2>
        <p className="section-subtitle">
          A focused writing experience with powerful tools built in — no plugins
          to install, no extensions to manage.
        </p>
        <div className="feature-grid">
          <div className="feature-card">
            <div className="feature-card-icon">&#x270D;&#xFE0F;</div>
            <h3>Live WYSIWYG Editor</h3>
            <p>
              Headings, bold, images, code blocks — all rendered as you type.
              Switch to raw Markdown mode anytime with Ctrl+E.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-card-icon">&#x1F517;</div>
            <h3>Link Your Thinking</h3>
            <p>
              Connect notes with links. See every connection in the Backlinks
              panel. Build a personal wiki effortlessly.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-card-icon">&#x1F578;&#xFE0F;</div>
            <h3>Knowledge Graph</h3>
            <p>
              Visualise all your notes as an interactive network. See the shape
              of your thinking at a glance.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-card-icon">&#x1F500;</div>
            <h3>Full Git Integration</h3>
            <p>
              Stage, commit, push, and branch — all from within the app. See
              diffs, history, and commit logs. Git is optional.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-card-icon">&#x2728;</div>
            <h3>Rich Content</h3>
            <p>
              Callouts, LaTeX math, Mermaid diagrams, interactive checkboxes,
              tables, and clipboard image paste — all rendered live.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-card-icon">&#x1F50D;</div>
            <h3>Instant Search</h3>
            <p>
              Command palette for fuzzy file search. Full-text search across
              every note with ranked results and highlighted snippets.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-card-icon">&#x1F3A8;</div>
            <h3>8 Themes</h3>
            <p>
              4 dark and 4 light themes including Catppuccin, Nord, Frame, and
              Crepe. Switch instantly from the status bar.
            </p>
          </div>
          <div className="feature-card">
            <div className="feature-card-icon">&#x2601;&#xFE0F;</div>
            <h3>Cross-Device Sync</h3>
            <p>
              Your notes are just a folder. Put it in Dropbox, Google Drive, or
              OneDrive and it syncs automatically across all your computers.
            </p>
          </div>
        </div>
      </section>

      {/* Comparison / differentiator */}
      <section className="landing-section">
        <h2>Why people switch to CommitPaper</h2>
        <div className="comparison-grid">
          <div className="comparison-item">
            <div className="comparison-before">Other apps</div>
            <div className="comparison-problem">
              Notes locked in proprietary formats
            </div>
            <div className="comparison-after">CommitPaper</div>
            <div className="comparison-solution">
              Plain Markdown files you own forever
            </div>
          </div>
          <div className="comparison-item">
            <div className="comparison-before">Other apps</div>
            <div className="comparison-problem">
              Monthly subscriptions for sync
            </div>
            <div className="comparison-after">CommitPaper</div>
            <div className="comparison-solution">
              Free sync via Dropbox, Drive, or Git
            </div>
          </div>
          <div className="comparison-item">
            <div className="comparison-before">Other apps</div>
            <div className="comparison-problem">
              Data stored on someone else's servers
            </div>
            <div className="comparison-after">CommitPaper</div>
            <div className="comparison-solution">
              100% local — nothing leaves your machine
            </div>
          </div>
        </div>
      </section>

      {/* Second CTA */}
      <section className="landing-cta-section">
        <h2>Your notes deserve better</h2>
        <p>
          Stop paying for cloud storage you don't need. Stop worrying about
          vendor lock-in. Start writing in a folder you own.
        </p>
        <Link to="/app" className="hero-btn-primary">
          Open CommitPaper — It's Free
        </Link>
        <span className="cta-subtext">
          No sign-up &middot; No install &middot; Works in Chrome &amp; Edge
        </span>
      </section>

      {/* FAQ */}
      <section className="landing-section" id="faq">
        <h2>Frequently asked questions</h2>
        <div className="faq-list">
          <div className="faq-item">
            <h4>Is this free?</h4>
            <p>
              Yes. CommitPaper is completely free to use. No subscriptions, no
              paywalls, no strings attached.
            </p>
          </div>
          <div className="faq-item">
            <h4>What browsers are supported?</h4>
            <p>
              Chrome 86+ and Edge 86+. Firefox and Safari don't yet support the
              File System Access API that CommitPaper needs.
            </p>
          </div>
          <div className="faq-item">
            <h4>Where is my data stored?</h4>
            <p>
              On your computer, in the folder you choose. Nothing is uploaded
              anywhere. Nothing leaves your browser.
            </p>
          </div>
          <div className="faq-item">
            <h4>Does it work with existing Obsidian folders?</h4>
            <p>
              Yes. CommitPaper reads standard Markdown files and supports
              callouts, frontmatter, and standard markdown links. Just point it
              at your folder.
            </p>
          </div>
          <div className="faq-item">
            <h4>Can I sync across computers?</h4>
            <p>
              Yes — put your folder in Dropbox, Google Drive, or OneDrive and it
              syncs automatically. Or use Git for version-controlled sync.
            </p>
          </div>
          <div className="faq-item">
            <h4>Do I need Git?</h4>
            <p>
              No. Git is entirely optional. But if you want version history,
              branching, and the ability to revert any note, it's built right
              in.
            </p>
          </div>
          <div className="faq-item">
            <h4>Can I use it offline?</h4>
            <p>
              Absolutely. Once loaded, everything works offline as a Progressive
              Web App.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <p>CommitPaper</p>
      </footer>
    </div>
  );
}
