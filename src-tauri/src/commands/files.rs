use std::fs;
use std::path::{Path, PathBuf};
use tauri::State;

use crate::models::note::FileTreeNode;
use crate::AppState;

/// Read the contents of a file
#[tauri::command]
pub fn read_file(path: String, state: State<'_, AppState>) -> Result<String, String> {
    let vault = state.vault_path.lock().unwrap();
    let vault_path = vault.as_ref().ok_or("No vault open")?;

    let full_path = Path::new(vault_path).join(&path);
    fs::read_to_string(&full_path).map_err(|e| format!("Failed to read file: {}", e))
}

/// Write content to a file
#[tauri::command]
pub fn write_file(path: String, content: String, state: State<'_, AppState>) -> Result<(), String> {
    let vault = state.vault_path.lock().unwrap();
    let vault_path = vault.as_ref().ok_or("No vault open")?;

    let full_path = Path::new(vault_path).join(&path);

    // Create parent directories if needed
    if let Some(parent) = full_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directories: {}", e))?;
    }

    fs::write(&full_path, content).map_err(|e| format!("Failed to write file: {}", e))
}

/// Create a new file
#[tauri::command]
pub fn create_note(path: String, state: State<'_, AppState>) -> Result<(), String> {
    let vault = state.vault_path.lock().unwrap();
    let vault_path = vault.as_ref().ok_or("No vault open")?;

    let full_path = Path::new(vault_path).join(&path);

    if full_path.exists() {
        return Err("File already exists".to_string());
    }

    if let Some(parent) = full_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directories: {}", e))?;
    }

    let name = Path::new(&path)
        .file_stem()
        .unwrap_or_default()
        .to_string_lossy();

    let initial_content = format!("# {}\n\n", name);
    fs::write(&full_path, initial_content).map_err(|e| format!("Failed to create file: {}", e))
}

/// Delete a file
#[tauri::command]
pub fn delete_file(path: String, state: State<'_, AppState>) -> Result<(), String> {
    let vault = state.vault_path.lock().unwrap();
    let vault_path = vault.as_ref().ok_or("No vault open")?;

    let full_path = Path::new(vault_path).join(&path);
    fs::remove_file(&full_path).map_err(|e| format!("Failed to delete file: {}", e))
}

/// Rename/move a file
#[tauri::command]
pub fn rename_file(
    old_path: String,
    new_path: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let vault = state.vault_path.lock().unwrap();
    let vault_path = vault.as_ref().ok_or("No vault open")?;

    let old_full = Path::new(vault_path).join(&old_path);
    let new_full = Path::new(vault_path).join(&new_path);

    if let Some(parent) = new_full.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    fs::rename(&old_full, &new_full).map_err(|e| format!("Failed to rename: {}", e))
}

/// Create a new folder
#[tauri::command]
pub fn create_folder(path: String, state: State<'_, AppState>) -> Result<(), String> {
    let vault = state.vault_path.lock().unwrap();
    let vault_path = vault.as_ref().ok_or("No vault open")?;

    let full_path = Path::new(vault_path).join(&path);
    fs::create_dir_all(&full_path).map_err(|e| format!("Failed to create folder: {}", e))
}

/// Save binary data (e.g. pasted image) to the vault
#[tauri::command]
pub fn save_binary_file(path: String, data: Vec<u8>, state: State<'_, AppState>) -> Result<String, String> {
    let vault = state.vault_path.lock().unwrap();
    let vault_path = vault.as_ref().ok_or("No vault open")?;

    let full_path = Path::new(vault_path).join(&path);

    // Create parent directories if needed
    if let Some(parent) = full_path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directories: {}", e))?;
    }

    fs::write(&full_path, &data).map_err(|e| format!("Failed to save file: {}", e))?;
    Ok(path)
}

/// Build the file tree for the sidebar
#[tauri::command]
pub fn get_file_tree(state: State<'_, AppState>) -> Result<Vec<FileTreeNode>, String> {
    let vault = state.vault_path.lock().unwrap();
    let vault_path = vault.as_ref().ok_or("No vault open")?;

    let root = Path::new(vault_path);
    build_tree(root, root).map_err(|e| e.to_string())
}

/// Recursively build the file tree
fn build_tree(root: &Path, current: &Path) -> Result<Vec<FileTreeNode>, String> {
    let mut nodes = Vec::new();

    let mut entries: Vec<PathBuf> = fs::read_dir(current)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .collect();

    entries.sort_by(|a, b| {
        let a_is_dir = a.is_dir();
        let b_is_dir = b.is_dir();
        match (a_is_dir, b_is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.file_name().cmp(&b.file_name()),
        }
    });

    for entry in entries {
        let name = entry
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        // Skip hidden files and .git directory
        if name.starts_with('.') {
            continue;
        }

        // Skip node_modules and other non-vault dirs
        if name == "node_modules" || name == "target" {
            continue;
        }

        let rel_path = entry
            .strip_prefix(root)
            .unwrap_or(&entry)
            .to_string_lossy()
            .replace('\\', "/");

        if entry.is_dir() {
            let children = build_tree(root, &entry)?;
            nodes.push(FileTreeNode::Folder {
                name,
                path: rel_path,
                children,
            });
        } else {
            let ext = entry
                .extension()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();

            // Only show markdown files and common assets
            if ext == "md" || ext == "markdown" || ext == "txt" {
                nodes.push(FileTreeNode::File {
                    name,
                    path: rel_path,
                    extension: ext,
                });
            }
        }
    }

    Ok(nodes)
}
