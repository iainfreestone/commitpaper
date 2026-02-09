import React, { useState } from "react";
import { FileTree } from "./FileTree";
import { GitPanel } from "./GitPanel";
import { SearchPanel } from "./SearchPanel";

type SidebarTab = "files" | "git" | "search";

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
        {activeTab === "git" && <GitPanel />}
        {activeTab === "search" && <SearchPanel />}
      </div>
    </div>
  );
}
