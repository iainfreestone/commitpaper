import React, { useEffect, useRef, useState } from "react";
import cytoscape from "cytoscape";
import { useEditorStore } from "../../stores/editorStore";
import { getGraphData, getLocalGraph } from "../../lib/tauri";
import type { GraphData } from "../../lib/tauri";

export function GraphView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const activeTabPath = useEditorStore((s) => s.activeTabPath);
  const openFile = useEditorStore((s) => s.openFile);
  const [mode, setMode] = useState<"local" | "global">("local");

  useEffect(() => {
    loadGraph();
  }, [activeTabPath, mode]);

  const loadGraph = async () => {
    try {
      let data: GraphData;
      if (mode === "local" && activeTabPath) {
        data = await getLocalGraph(activeTabPath, 2);
      } else {
        data = await getGraphData();
      }
      renderGraph(data);
    } catch (e) {
      console.error("Failed to load graph:", e);
    }
  };

  const renderGraph = (data: GraphData) => {
    if (!containerRef.current) return;

    // Destroy previous instance
    if (cyRef.current) {
      cyRef.current.destroy();
    }

    const currentNoteName = activeTabPath
      ?.replace(/\.md$/, "")
      .split("/")
      .pop();

    const elements: cytoscape.ElementDefinition[] = [
      ...data.nodes.map((node) => ({
        data: {
          id: node.id,
          label: node.label,
          path: node.path,
          size: Math.max(20, Math.min(60, 20 + node.backlink_count * 5)),
          isActive: node.id === currentNoteName,
        },
      })),
      ...data.edges.map((edge, i) => ({
        data: {
          id: `e-${i}`,
          source: edge.source,
          target: edge.target,
        },
      })),
    ];

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: "node",
          style: {
            label: "data(label)",
            "background-color": "#585b70",
            color: "#cdd6f4",
            "font-size": "10px",
            "text-valign": "bottom",
            "text-margin-y": 5,
            width: "data(size)",
            height: "data(size)",
            "border-width": 0,
            "overlay-opacity": 0,
          },
        },
        {
          selector: "node[?isActive]",
          style: {
            "background-color": "#89b4fa",
            "border-width": 3,
            "border-color": "#74c7ec",
          },
        },
        {
          selector: "edge",
          style: {
            width: 1,
            "line-color": "#45475a",
            "target-arrow-color": "#45475a",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
            "arrow-scale": 0.6,
            opacity: 0.6,
          },
        },
        {
          selector: "node:hover",
          style: {
            "background-color": "#89b4fa",
          },
        },
      ],
      layout: {
        name: "cose",
        animate: false,
        nodeDimensionsIncludeLabels: true,
        idealEdgeLength: () => 100,
        nodeRepulsion: () => 8000,
        gravity: 0.25,
      } as any,
      minZoom: 0.2,
      maxZoom: 3,
      wheelSensitivity: 0.3,
    });

    // Click handler
    cy.on("tap", "node", (evt) => {
      const path = evt.target.data("path");
      if (path) {
        openFile(path);
      }
    });

    cyRef.current = cy;
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", gap: "4px", padding: "4px 8px" }}>
        <button
          className={`sidebar-tab ${mode === "local" ? "active" : ""}`}
          onClick={() => setMode("local")}
          style={{ fontSize: "11px", padding: "2px 8px" }}
        >
          Local
        </button>
        <button
          className={`sidebar-tab ${mode === "global" ? "active" : ""}`}
          onClick={() => setMode("global")}
          style={{ fontSize: "11px", padding: "2px 8px" }}
        >
          Global
        </button>
      </div>
      <div ref={containerRef} className="graph-container" style={{ flex: 1 }} />
    </div>
  );
}
