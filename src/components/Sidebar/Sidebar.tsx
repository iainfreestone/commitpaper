import React, { useState } from "react";
import { FileTree } from "./FileTree";
import { GitPanel } from "./GitPanel";
import { SearchPanel } from "./SearchPanel";
import { TagsPanel } from "./TagsPanel";
import { DailyNotes } from "./DailyNotes";
import { TemplatesPanel } from "./TemplatesPanel";

type SidebarTab = "files" | "git" | "search" | "tags" | "daily" | "templates";

export function Sidebar() {
  const [activeTab, setActiveTab] = useState<SidebarTab>("files");

  return (
    <div className="sidebar">
      <div className="sidebar-tabs">
        <button
          className={`sidebar-tab ${activeTab === "files" ? "active" : ""}`}
          onClick={() => setActiveTab("files")}
          title="Files"
        >
          Files
        </button>
        <button
          className={`sidebar-tab ${activeTab === "daily" ? "active" : ""}`}
          onClick={() => setActiveTab("daily")}
          title="Daily Notes"
        >
          Daily
        </button>
        <button
          className={`sidebar-tab ${activeTab === "tags" ? "active" : ""}`}
          onClick={() => setActiveTab("tags")}
          title="Tags"
        >
          Tags
        </button>
        <button
          className={`sidebar-tab ${activeTab === "templates" ? "active" : ""}`}
          onClick={() => setActiveTab("templates")}
          title="Templates"
        >
          Tmpl
        </button>
        <button
          className={`sidebar-tab ${activeTab === "git" ? "active" : ""}`}
          onClick={() => setActiveTab("git")}
          title="Git"
        >
          Git
        </button>
        <button
          className={`sidebar-tab ${activeTab === "search" ? "active" : ""}`}
          onClick={() => setActiveTab("search")}
          title="Search"
        >
          Search
        </button>
      </div>
      <div className="sidebar-content">
        {activeTab === "files" && <FileTree />}
        {activeTab === "daily" && <DailyNotes />}
        {activeTab === "tags" && <TagsPanel />}
        {activeTab === "templates" && <TemplatesPanel />}
        {activeTab === "git" && <GitPanel />}
        {activeTab === "search" && <SearchPanel />}
      </div>
    </div>
  );
}
