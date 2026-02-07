use anyhow::Result;
use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher, Event};
use std::path::Path;
use std::sync::mpsc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

/// File change event emitted to the frontend
#[derive(Debug, Clone, serde::Serialize)]
pub struct FileChangeEvent {
    pub kind: String,
    pub paths: Vec<String>,
}

/// Start watching a directory for changes and emit Tauri events
pub fn start_watcher(
    app_handle: AppHandle,
    vault_path: String,
) -> Result<RecommendedWatcher> {
    let (tx, rx) = mpsc::channel();

    let mut watcher = RecommendedWatcher::new(
        move |result: std::result::Result<Event, notify::Error>| {
            if let Ok(event) = result {
                let _ = tx.send(event);
            }
        },
        Config::default().with_poll_interval(Duration::from_secs(1)),
    )?;

    watcher.watch(Path::new(&vault_path), RecursiveMode::Recursive)?;

    // Spawn a thread to forward events to Tauri
    let vault_path_clone = vault_path.clone();
    std::thread::spawn(move || {
        // Debounce: collect events for 300ms before emitting
        loop {
            match rx.recv_timeout(Duration::from_millis(300)) {
                Ok(event) => {
                    let paths: Vec<String> = event
                        .paths
                        .iter()
                        .filter_map(|p| {
                            p.strip_prefix(&vault_path_clone)
                                .ok()
                                .map(|rel| rel.to_string_lossy().replace('\\', "/"))
                        })
                        .filter(|p| {
                            // Only emit for markdown files, ignore .git directory
                            !p.starts_with(".git") && (p.ends_with(".md") || p.ends_with(".markdown"))
                        })
                        .collect();

                    if !paths.is_empty() {
                        let kind = match event.kind {
                            notify::EventKind::Create(_) => "create",
                            notify::EventKind::Modify(_) => "modify",
                            notify::EventKind::Remove(_) => "remove",
                            _ => continue,
                        };

                        let _ = app_handle.emit(
                            "file-change",
                            FileChangeEvent {
                                kind: kind.to_string(),
                                paths,
                            },
                        );
                    }
                }
                Err(mpsc::RecvTimeoutError::Timeout) => continue,
                Err(mpsc::RecvTimeoutError::Disconnected) => break,
            }
        }
    });

    Ok(watcher)
}
