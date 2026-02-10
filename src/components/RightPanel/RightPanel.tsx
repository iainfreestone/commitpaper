import React, { useState } from "react";
import { BacklinksPanel } from "./BacklinksPanel";
import { HistoryPanel } from "./HistoryPanel";
import { GraphView } from "./GraphView";
import { OutlinePanel } from "./OutlinePanel";
import { PropertiesPanel } from "./PropertiesPanel";
import { trackRightPanelTab } from "../../lib/analytics";

type RightTab = "outline" | "backlinks" | "properties" | "history" | "graph";

export function RightPanel() {
  const [activeTab, setActiveTab] = useState<RightTab>("outline");

  const handleTabClick = (tab: RightTab) => {
    setActiveTab(tab);
    trackRightPanelTab(tab);
  };

  return (
    <div className="right-panel">
      <div className="sidebar-tabs">
        <button
          className={`sidebar-tab ${activeTab === "outline" ? "active" : ""}`}
          onClick={() => handleTabClick("outline")}
        >
          Outline
        </button>
        <button
          className={`sidebar-tab ${activeTab === "backlinks" ? "active" : ""}`}
          onClick={() => handleTabClick("backlinks")}
        >
          Links
        </button>
        <button
          className={`sidebar-tab ${activeTab === "properties" ? "active" : ""}`}
          onClick={() => handleTabClick("properties")}
        >
          Props
        </button>
        <button
          className={`sidebar-tab ${activeTab === "history" ? "active" : ""}`}
          onClick={() => handleTabClick("history")}
        >
          History
        </button>
        <button
          className={`sidebar-tab ${activeTab === "graph" ? "active" : ""}`}
          onClick={() => handleTabClick("graph")}
        >
          Graph
        </button>
      </div>
      <div className="sidebar-content">
        {activeTab === "outline" && <OutlinePanel />}
        {activeTab === "backlinks" && <BacklinksPanel />}
        {activeTab === "properties" && <PropertiesPanel />}
        {activeTab === "history" && <HistoryPanel />}
        {activeTab === "graph" && <GraphView />}
      </div>
    </div>
  );
}
