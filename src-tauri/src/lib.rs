mod commands;
mod models;
mod services;

use services::indexer::SearchIndex;
use services::linker::LinkGraph;
use std::sync::Mutex;

/// Shared application state accessible from all Tauri commands
pub struct AppState {
    pub vault_path: Mutex<Option<String>>,
    pub search_index: SearchIndex,
    pub link_graph: LinkGraph,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = AppState {
        vault_path: Mutex::new(None),
        search_index: SearchIndex::new().expect("Failed to create search index"),
        link_graph: LinkGraph::new(),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .manage(app_state)
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Vault commands
            commands::vault::open_vault,
            commands::vault::init_vault_repo,
            commands::vault::get_backlinks,
            commands::vault::get_note_names,
            commands::vault::resolve_wikilink,
            commands::vault::get_graph_data,
            commands::vault::get_local_graph,
            commands::vault::reindex_file,
            // File commands
            commands::files::read_file,
            commands::files::write_file,
            commands::files::create_note,
            commands::files::delete_file,
            commands::files::rename_file,
            commands::files::create_folder,
            commands::files::get_file_tree,
            commands::files::save_binary_file,
            // Git commands
            commands::git::git_status,
            commands::git::git_stage_file,
            commands::git::git_unstage_file,
            commands::git::git_stage_all,
            commands::git::git_commit,
            commands::git::git_current_branch,
            commands::git::git_branches,
            commands::git::git_create_branch,
            commands::git::git_checkout_branch,
            commands::git::git_log,
            commands::git::git_file_log,
            commands::git::git_file_at_commit,
            commands::git::git_diff,
            commands::git::git_pull,
            commands::git::git_push,
            commands::git::git_conflicts,
            // Search commands
            commands::search::search_notes,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Gitsidian");
}
