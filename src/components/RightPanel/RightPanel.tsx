import React, { useState } from "react";
import { BacklinksPanel } from "./BacklinksPanel";
import { HistoryPanel } from "./HistoryPanel";
import { GraphView } from "./GraphView";
import { OutlinePanel } from "./OutlinePanel";
import { PropertiesPanel } from "./PropertiesPanel";

type RightTab = "outline" | "backlinks" | "properties" | "history" | "graph";

export function RightPanel() {
  const [activeTab, setActiveTab] = useState<RightTab>("outline");

  return (
    <div className="right-panel">
      <div className="sidebar-tabs">
        <button
          className={`sidebar-tab ${activeTab === "outline" ? "active" : ""}`}
          onClick={() => setActiveTab("outline")}
        >
          Outline
        </button>
        <button
          className={`sidebar-tab ${activeTab === "backlinks" ? "active" : ""}`}
          onClick={() => setActiveTab("backlinks")}
        >
          Links
        </button>
        <button
          className={`sidebar-tab ${activeTab === "properties" ? "active" : ""}`}
          onClick={() => setActiveTab("properties")}
        >
          Props
        </button>
        <button
          className={`sidebar-tab ${activeTab === "history" ? "active" : ""}`}
          onClick={() => setActiveTab("history")}
        >
          History
        </button>
        <button
          className={`sidebar-tab ${activeTab === "graph" ? "active" : ""}`}
          onClick={() => setActiveTab("graph")}
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
