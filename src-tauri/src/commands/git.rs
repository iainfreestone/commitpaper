use tauri::State;

use crate::models::git_status::*;
use crate::services::git_service;
use crate::AppState;

#[tauri::command]
pub fn git_status(state: State<'_, AppState>) -> Result<Vec<FileStatus>, String> {
    let vault = state.vault_path.lock().unwrap();
    let vault_path = vault.as_ref().ok_or("No vault open")?;

    let repo = git_service::open_repo(vault_path).map_err(|e| e.to_string())?;
    git_service::get_status(&repo).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn git_stage_file(path: String, state: State<'_, AppState>) -> Result<(), String> {
    let vault = state.vault_path.lock().unwrap();
    let vault_path = vault.as_ref().ok_or("No vault open")?;

    let repo = git_service::open_repo(vault_path).map_err(|e| e.to_string())?;
    git_service::stage_file(&repo, &path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn git_unstage_file(path: String, state: State<'_, AppState>) -> Result<(), String> {
    let vault = state.vault_path.lock().unwrap();
    let vault_path = vault.as_ref().ok_or("No vault open")?;

    let repo = git_service::open_repo(vault_path).map_err(|e| e.to_string())?;
    git_service::unstage_file(&repo, &path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn git_stage_all(state: State<'_, AppState>) -> Result<(), String> {
    let vault = state.vault_path.lock().unwrap();
    let vault_path = vault.as_ref().ok_or("No vault open")?;

    let repo = git_service::open_repo(vault_path).map_err(|e| e.to_string())?;
    git_service::stage_all(&repo).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn git_commit(message: String, state: State<'_, AppState>) -> Result<String, String> {
    let vault = state.vault_path.lock().unwrap();
    let vault_path = vault.as_ref().ok_or("No vault open")?;

    let repo = git_service::open_repo(vault_path).map_err(|e| e.to_string())?;
    git_service::commit(&repo, &message).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn git_current_branch(state: State<'_, AppState>) -> Result<String, String> {
    let vault = state.vault_path.lock().unwrap();
    let vault_path = vault.as_ref().ok_or("No vault open")?;

    let repo = git_service::open_repo(vault_path).map_err(|e| e.to_string())?;
    git_service::current_branch(&repo).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn git_branches(state: State<'_, AppState>) -> Result<Vec<BranchInfo>, String> {
    let vault = state.vault_path.lock().unwrap();
    let vault_path = vault.as_ref().ok_or("No vault open")?;

    let repo = git_service::open_repo(vault_path).map_err(|e| e.to_string())?;
    git_service::list_branches(&repo).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn git_create_branch(name: String, state: State<'_, AppState>) -> Result<(), String> {
    let vault = state.vault_path.lock().unwrap();
    let vault_path = vault.as_ref().ok_or("No vault open")?;

    let repo = git_service::open_repo(vault_path).map_err(|e| e.to_string())?;
    git_service::create_branch(&repo, &name).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn git_checkout_branch(name: String, state: State<'_, AppState>) -> Result<(), String> {
    let vault = state.vault_path.lock().unwrap();
    let vault_path = vault.as_ref().ok_or("No vault open")?;

    let repo = git_service::open_repo(vault_path).map_err(|e| e.to_string())?;
    git_service::checkout_branch(&repo, &name).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn git_log(max_count: Option<usize>, state: State<'_, AppState>) -> Result<Vec<CommitInfo>, String> {
    let vault = state.vault_path.lock().unwrap();
    let vault_path = vault.as_ref().ok_or("No vault open")?;

    let repo = git_service::open_repo(vault_path).map_err(|e| e.to_string())?;
    git_service::get_log(&repo, max_count.unwrap_or(50)).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn git_file_log(
    file_path: String,
    max_count: Option<usize>,
    state: State<'_, AppState>,
) -> Result<Vec<CommitInfo>, String> {
    let vault = state.vault_path.lock().unwrap();
    let vault_path = vault.as_ref().ok_or("No vault open")?;

    let repo = git_service::open_repo(vault_path).map_err(|e| e.to_string())?;
    git_service::get_file_log(&repo, &file_path, max_count.unwrap_or(50))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn git_file_at_commit(
    commit_id: String,
    file_path: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let vault = state.vault_path.lock().unwrap();
    let vault_path = vault.as_ref().ok_or("No vault open")?;

    let repo = git_service::open_repo(vault_path).map_err(|e| e.to_string())?;
    git_service::get_file_at_commit(&repo, &commit_id, &file_path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn git_diff(state: State<'_, AppState>) -> Result<Vec<FileDiff>, String> {
    let vault = state.vault_path.lock().unwrap();
    let vault_path = vault.as_ref().ok_or("No vault open")?;

    let repo = git_service::open_repo(vault_path).map_err(|e| e.to_string())?;
    git_service::get_diff(&repo).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn git_pull(state: State<'_, AppState>) -> Result<String, String> {
    let vault = state.vault_path.lock().unwrap();
    let vault_path = vault.as_ref().ok_or("No vault open")?;

    let repo = git_service::open_repo(vault_path).map_err(|e| e.to_string())?;
    git_service::pull(&repo).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn git_push(state: State<'_, AppState>) -> Result<(), String> {
    let vault = state.vault_path.lock().unwrap();
    let vault_path = vault.as_ref().ok_or("No vault open")?;

    let repo = git_service::open_repo(vault_path).map_err(|e| e.to_string())?;
    git_service::push(&repo).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn git_conflicts(state: State<'_, AppState>) -> Result<Vec<ConflictFile>, String> {
    let vault = state.vault_path.lock().unwrap();
    let vault_path = vault.as_ref().ok_or("No vault open")?;

    let repo = git_service::open_repo(vault_path).map_err(|e| e.to_string())?;
    git_service::get_conflicts(&repo).map_err(|e| e.to_string())
}
