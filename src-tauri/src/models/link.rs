use serde::{Deserialize, Serialize};

/// A directed link between two notes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NoteLink {
    pub source: String,
    pub target: String,
}

/// Graph data for the frontend visualization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphData {
    pub nodes: Vec<GraphNode>,
    pub edges: Vec<GraphEdge>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphNode {
    pub id: String,
    pub label: String,
    pub path: String,
    /// Number of links pointing to this note
    pub backlink_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GraphEdge {
    pub source: String,
    pub target: String,
}
