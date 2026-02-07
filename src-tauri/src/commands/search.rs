use tauri::State;

use crate::models::vault::SearchResult;
use crate::AppState;

/// Search notes by query
#[tauri::command]
pub fn search_notes(query: String, state: State<'_, AppState>) -> Result<Vec<SearchResult>, String> {
    let index = &state.search_index;
    index.search(&query, 20).map_err(|e| e.to_string())
}
