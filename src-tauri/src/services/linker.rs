use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::sync::RwLock;

use crate::models::link::{GraphData, GraphEdge, GraphNode};

/// Maintains the bidirectional link graph for the vault
pub struct LinkGraph {
    /// Map from note path → list of outgoing link targets
    outgoing: RwLock<HashMap<String, Vec<String>>>,
    /// Map from note name → note path (for resolving wikilinks)
    name_to_path: RwLock<HashMap<String, String>>,
}

impl LinkGraph {
    pub fn new() -> Self {
        Self {
            outgoing: RwLock::new(HashMap::new()),
            name_to_path: RwLock::new(HashMap::new()),
        }
    }

    /// Register a note's path and name
    pub fn register_note(&self, path: &str) {
        let name = Path::new(path)
            .file_stem()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        self.name_to_path
            .write()
            .unwrap()
            .insert(name, path.to_string());
    }

    /// Update the links for a given note
    pub fn update_links(&self, source_path: &str, link_targets: Vec<String>) {
        self.outgoing
            .write()
            .unwrap()
            .insert(source_path.to_string(), link_targets);
    }

    /// Remove a note from the graph
    pub fn remove_note(&self, path: &str) {
        self.outgoing.write().unwrap().remove(path);
        let name = Path::new(path)
            .file_stem()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        self.name_to_path.write().unwrap().remove(&name);
    }

    /// Get backlinks for a note (other notes that link to it)
    pub fn get_backlinks(&self, path: &str) -> Vec<String> {
        let name = Path::new(path)
            .file_stem()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        let outgoing = self.outgoing.read().unwrap();

        let mut backlinks = Vec::new();
        for (source, targets) in outgoing.iter() {
            if targets.iter().any(|t| t == &name || t == path) {
                backlinks.push(source.clone());
            }
        }
        backlinks
    }

    /// Get all note names for autocompletion
    pub fn get_all_note_names(&self) -> Vec<String> {
        self.name_to_path.read().unwrap().keys().cloned().collect()
    }

    /// Resolve a wikilink name to a file path
    pub fn resolve_link(&self, name: &str) -> Option<String> {
        self.name_to_path.read().unwrap().get(name).cloned()
    }

    /// Build the full graph data for visualization
    pub fn get_graph_data(&self) -> GraphData {
        let outgoing = self.outgoing.read().unwrap();
        let name_to_path = self.name_to_path.read().unwrap();

        // Collect all unique node IDs
        let mut node_ids: HashSet<String> = HashSet::new();
        let mut backlink_counts: HashMap<String, usize> = HashMap::new();

        for (source, targets) in outgoing.iter() {
            let source_name = Path::new(source)
                .file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            node_ids.insert(source_name);

            for target in targets {
                node_ids.insert(target.clone());
                *backlink_counts.entry(target.clone()).or_insert(0) += 1;
            }
        }

        let nodes: Vec<GraphNode> = node_ids
            .iter()
            .map(|id| {
                let path = name_to_path
                    .get(id)
                    .cloned()
                    .unwrap_or_else(|| format!("{}.md", id));
                GraphNode {
                    id: id.clone(),
                    label: id.clone(),
                    path,
                    backlink_count: *backlink_counts.get(id).unwrap_or(&0),
                }
            })
            .collect();

        let mut edges = Vec::new();
        for (source, targets) in outgoing.iter() {
            let source_name = Path::new(source)
                .file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();
            for target in targets {
                edges.push(GraphEdge {
                    source: source_name.clone(),
                    target: target.clone(),
                });
            }
        }

        GraphData { nodes, edges }
    }

    /// Get local graph (neighborhood of a node)
    pub fn get_local_graph(&self, path: &str, depth: usize) -> GraphData {
        let center_name = Path::new(path)
            .file_stem()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        let outgoing = self.outgoing.read().unwrap();
        let name_to_path = self.name_to_path.read().unwrap();

        let mut visited: HashSet<String> = HashSet::new();
        let mut to_visit: Vec<(String, usize)> = vec![(center_name.clone(), 0)];
        let mut edges: Vec<GraphEdge> = Vec::new();

        while let Some((name, d)) = to_visit.pop() {
            if visited.contains(&name) || d > depth {
                continue;
            }
            visited.insert(name.clone());

            // Find outgoing links from this node
            if let Some(node_path) = name_to_path.get(&name) {
                if let Some(targets) = outgoing.get(node_path) {
                    for target in targets {
                        edges.push(GraphEdge {
                            source: name.clone(),
                            target: target.clone(),
                        });
                        if d < depth {
                            to_visit.push((target.clone(), d + 1));
                        }
                    }
                }
            }

            // Find incoming links (backlinks)
            for (source_path, targets) in outgoing.iter() {
                let source_name = Path::new(source_path)
                    .file_stem()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();
                if targets.iter().any(|t| t == &name) {
                    edges.push(GraphEdge {
                        source: source_name.clone(),
                        target: name.clone(),
                    });
                    if d < depth && !visited.contains(&source_name) {
                        to_visit.push((source_name, d + 1));
                    }
                }
            }
        }

        let mut backlink_counts: HashMap<String, usize> = HashMap::new();
        for edge in &edges {
            *backlink_counts.entry(edge.target.clone()).or_insert(0) += 1;
        }

        let nodes: Vec<GraphNode> = visited
            .iter()
            .map(|id| {
                let path = name_to_path
                    .get(id)
                    .cloned()
                    .unwrap_or_else(|| format!("{}.md", id));
                GraphNode {
                    id: id.clone(),
                    label: id.clone(),
                    path,
                    backlink_count: *backlink_counts.get(id).unwrap_or(&0),
                }
            })
            .collect();

        // Deduplicate edges
        edges.sort_by(|a, b| (&a.source, &a.target).cmp(&(&b.source, &b.target)));
        edges.dedup_by(|a, b| a.source == b.source && a.target == b.target);

        GraphData { nodes, edges }
    }
}
