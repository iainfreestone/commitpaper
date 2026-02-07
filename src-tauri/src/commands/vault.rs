use std::fs;
use std::path::Path;
use tauri::State;
use walkdir::WalkDir;

use crate::models::link::GraphData;
use crate::models::vault::VaultConfig;
use crate::services::{git_service, parser};
use crate::AppState;

/// Open a vault (directory) and initialize all services
#[tauri::command]
pub fn open_vault(path: String, state: State<'_, AppState>) -> Result<VaultConfig, String> {
    let vault_path = Path::new(&path);
    if !vault_path.exists() {
        return Err("Directory does not exist".to_string());
    }

    let is_git_repo = vault_path.join(".git").exists()
        || git_service::open_repo(&path).is_ok();

    let name = vault_path
        .file_name()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    // Store the vault path
    *state.vault_path.lock().unwrap() = Some(path.clone());

    // Index all markdown files
    index_vault(&path, &state).map_err(|e| e.to_string())?;

    Ok(VaultConfig {
        path,
        name,
        is_git_repo,
    })
}

/// Initialize a new git repo in the vault
#[tauri::command]
pub fn init_vault_repo(state: State<'_, AppState>) -> Result<(), String> {
    let vault = state.vault_path.lock().unwrap();
    let vault_path = vault.as_ref().ok_or("No vault open")?;

    git_service::init_repo(vault_path).map_err(|e| e.to_string())?;
    Ok(())
}

/// Get backlinks for a note
#[tauri::command]
pub fn get_backlinks(path: String, state: State<'_, AppState>) -> Result<Vec<String>, String> {
    Ok(state.link_graph.get_backlinks(&path))
}

/// Get all note names for autocomplete
#[tauri::command]
pub fn get_note_names(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    Ok(state.link_graph.get_all_note_names())
}

/// Resolve a wikilink to a file path
#[tauri::command]
pub fn resolve_wikilink(name: String, state: State<'_, AppState>) -> Result<Option<String>, String> {
    Ok(state.link_graph.resolve_link(&name))
}

/// Get the full graph data
#[tauri::command]
pub fn get_graph_data(state: State<'_, AppState>) -> Result<GraphData, String> {
    Ok(state.link_graph.get_graph_data())
}

/// Get local graph around a note
#[tauri::command]
pub fn get_local_graph(
    path: String,
    depth: Option<usize>,
    state: State<'_, AppState>,
) -> Result<GraphData, String> {
    Ok(state.link_graph.get_local_graph(&path, depth.unwrap_or(2)))
}

/// Re-index a single file (called on file change)
#[tauri::command]
pub fn reindex_file(path: String, state: State<'_, AppState>) -> Result<(), String> {
    let vault = state.vault_path.lock().unwrap();
    let vault_path = vault.as_ref().ok_or("No vault open")?;

    let full_path = Path::new(vault_path).join(&path);
    let content = fs::read_to_string(&full_path).map_err(|e| e.to_string())?;
    let parsed = parser::parse_note(&content);

    let title = parsed
        .frontmatter
        .get("title")
        .cloned()
        .unwrap_or_else(|| {
            Path::new(&path)
                .file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string()
        });

    // Update search index
    state
        .search_index
        .index_note(&path, &title, &content, &parsed.tags)
        .map_err(|e| e.to_string())?;

    // Update link graph
    state.link_graph.register_note(&path);
    state.link_graph.update_links(&path, parsed.links);

    Ok(())
}

/// Index all markdown files in the vault
fn index_vault(vault_path: &str, state: &AppState) -> anyhow::Result<()> {
    for entry in WalkDir::new(vault_path)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();

        // Skip .git directory
        if path
            .components()
            .any(|c| c.as_os_str() == ".git")
        {
            continue;
        }

        if path.is_file() {
            let ext = path.extension().unwrap_or_default().to_string_lossy();
            if ext == "md" || ext == "markdown" {
                let rel_path = path
                    .strip_prefix(vault_path)
                    .unwrap_or(path)
                    .to_string_lossy()
                    .replace('\\', "/");

                if let Ok(content) = fs::read_to_string(path) {
                    let parsed = parser::parse_note(&content);
                    let title = parsed
                        .frontmatter
                        .get("title")
                        .cloned()
                        .unwrap_or_else(|| {
                            path.file_stem()
                                .unwrap_or_default()
                                .to_string_lossy()
                                .to_string()
                        });

                    let _ = state
                        .search_index
                        .index_note(&rel_path, &title, &content, &parsed.tags);

                    state.link_graph.register_note(&rel_path);
                    state.link_graph.update_links(&rel_path, parsed.links);
                }
            }
        }
    }

    Ok(())
}
