use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Represents a single note/markdown file in the vault
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Note {
    /// Relative path from vault root
    pub path: String,
    /// File name without extension
    pub name: String,
    /// Optional frontmatter fields
    pub frontmatter: HashMap<String, String>,
    /// List of wikilinks found in the note
    pub links: Vec<String>,
    /// Tags found in frontmatter or inline
    pub tags: Vec<String>,
}

/// Represents a file/folder in the sidebar tree
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum FileTreeNode {
    #[serde(rename = "file")]
    File {
        name: String,
        path: String,
        extension: String,
    },
    #[serde(rename = "folder")]
    Folder {
        name: String,
        path: String,
        children: Vec<FileTreeNode>,
    },
}
