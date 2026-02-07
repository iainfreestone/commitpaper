use serde::{Deserialize, Serialize};

/// Configuration for a vault
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultConfig {
    pub path: String,
    pub name: String,
    pub is_git_repo: bool,
}

/// Search result from tantivy
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResult {
    pub path: String,
    pub title: String,
    pub snippet: String,
    pub score: f32,
}
