use anyhow::{Context, Result};
use git2::{
    BranchType, Cred, DiffOptions, FetchOptions, IndexAddOption, MergeOptions,
    PushOptions, RemoteCallbacks, Repository, Signature, StatusOptions, StatusShow,
};
use std::cell::RefCell;
use std::path::Path;

use crate::models::git_status::*;

/// Open a git repository at the given path, or discover it from a subdirectory
pub fn open_repo(path: &str) -> Result<Repository> {
    Repository::discover(path).context("Failed to find git repository")
}

/// Initialize a new git repository
pub fn init_repo(path: &str) -> Result<Repository> {
    Repository::init(path).context("Failed to initialize git repository")
}

/// Get the status of all files in the working directory
pub fn get_status(repo: &Repository) -> Result<Vec<FileStatus>> {
    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(true)
        .show(StatusShow::IndexAndWorkdir);

    let statuses = repo.statuses(Some(&mut opts))?;
    let mut result = Vec::new();

    for entry in statuses.iter() {
        let path = entry.path().unwrap_or("").to_string();
        let s = entry.status();

        if s.is_index_new() {
            result.push(FileStatus {
                path: path.clone(),
                status: FileStatusKind::Added,
                staged: true,
            });
        } else if s.is_index_modified() {
            result.push(FileStatus {
                path: path.clone(),
                status: FileStatusKind::Modified,
                staged: true,
            });
        } else if s.is_index_deleted() {
            result.push(FileStatus {
                path: path.clone(),
                status: FileStatusKind::Deleted,
                staged: true,
            });
        } else if s.is_index_renamed() {
            result.push(FileStatus {
                path: path.clone(),
                status: FileStatusKind::Renamed,
                staged: true,
            });
        }

        if s.is_wt_modified() {
            result.push(FileStatus {
                path: path.clone(),
                status: FileStatusKind::Modified,
                staged: false,
            });
        } else if s.is_wt_new() {
            result.push(FileStatus {
                path: path.clone(),
                status: FileStatusKind::Untracked,
                staged: false,
            });
        } else if s.is_wt_deleted() {
            result.push(FileStatus {
                path: path.clone(),
                status: FileStatusKind::Deleted,
                staged: false,
            });
        } else if s.is_conflicted() {
            result.push(FileStatus {
                path: path.clone(),
                status: FileStatusKind::Conflicted,
                staged: false,
            });
        }
    }

    Ok(result)
}

/// Stage a specific file
pub fn stage_file(repo: &Repository, path: &str) -> Result<()> {
    let mut index = repo.index()?;
    index.add_path(Path::new(path))?;
    index.write()?;
    Ok(())
}

/// Unstage a specific file
pub fn unstage_file(repo: &Repository, path: &str) -> Result<()> {
    match repo.head() {
        Ok(head_ref) => {
            let head = head_ref.peel_to_commit()?;
            repo.reset_default(Some(head.as_object()), [path])?;
        }
        Err(_) => {
            // No commits yet — just remove from the index directly
            let mut index = repo.index()?;
            index.remove_path(Path::new(path))?;
            index.write()?;
        }
    }
    Ok(())
}

/// Stage all changed files
pub fn stage_all(repo: &Repository) -> Result<()> {
    let mut index = repo.index()?;
    index.add_all(["*"].iter(), IndexAddOption::DEFAULT, None)?;
    index.write()?;
    Ok(())
}

/// Create a commit with the staged changes
pub fn commit(repo: &Repository, message: &str) -> Result<String> {
    let mut index = repo.index()?;
    let oid = index.write_tree()?;
    let tree = repo.find_tree(oid)?;

    let sig = repo
        .signature()
        .unwrap_or_else(|_| Signature::now("Gitsidian User", "user@gitsidian").unwrap());

    let parent = match repo.head() {
        Ok(head) => Some(head.peel_to_commit()?),
        Err(_) => None,
    };

    let parents: Vec<&git2::Commit> = parent.iter().collect();
    let commit_oid = repo.commit(Some("HEAD"), &sig, &sig, message, &tree, &parents)?;

    Ok(commit_oid.to_string())
}

/// Get the current branch name
pub fn current_branch(repo: &Repository) -> Result<String> {
    match repo.head() {
        Ok(head) => {
            let name = head
                .shorthand()
                .unwrap_or("HEAD (detached)")
                .to_string();
            Ok(name)
        }
        Err(e) if e.code() == git2::ErrorCode::UnbornBranch => {
            // No commits yet — try to read the target branch name from HEAD
            // HEAD typically points to refs/heads/main or refs/heads/master
            if let Ok(head_ref) = repo.find_reference("HEAD") {
                if let Some(target) = head_ref.symbolic_target() {
                    let branch = target.trim_start_matches("refs/heads/");
                    return Ok(format!("{} (no commits)", branch));
                }
            }
            Ok("main (no commits)".to_string())
        }
        Err(e) => Err(e.into()),
    }
}

/// List all local branches
pub fn list_branches(repo: &Repository) -> Result<Vec<BranchInfo>> {
    let mut branches = Vec::new();

    for branch in repo.branches(Some(BranchType::Local))? {
        let (branch, _) = branch?;
        let name = branch.name()?.unwrap_or("unknown").to_string();
        let is_head = branch.is_head();

        let (ahead, behind) = if let Ok(upstream) = branch.upstream() {
            let local_oid = branch.get().target().unwrap();
            let upstream_oid = upstream.get().target().unwrap();
            repo.graph_ahead_behind(local_oid, upstream_oid)
                .unwrap_or((0, 0))
        } else {
            (0, 0)
        };

        let upstream_name = branch
            .upstream()
            .ok()
            .and_then(|u| u.name().ok().flatten().map(|s| s.to_string()));

        branches.push(BranchInfo {
            name,
            is_head,
            upstream: upstream_name,
            ahead: ahead as u32,
            behind: behind as u32,
        });
    }

    Ok(branches)
}

/// Create a new branch
pub fn create_branch(repo: &Repository, name: &str) -> Result<()> {
    let head = repo.head()
        .context("Cannot create branch: no commits yet. Make an initial commit first.")?
        .peel_to_commit()?;
    repo.branch(name, &head, false)?;
    Ok(())
}

/// Switch to a branch
pub fn checkout_branch(repo: &Repository, name: &str) -> Result<()> {
    let (object, reference) = repo.revparse_ext(&format!("refs/heads/{}", name))?;
    repo.checkout_tree(&object, None)?;
    if let Some(reference) = reference {
        repo.set_head(reference.name().unwrap())?;
    }
    Ok(())
}

/// Get commit log
pub fn get_log(repo: &Repository, max_count: usize) -> Result<Vec<CommitInfo>> {
    let mut revwalk = repo.revwalk()?;
    match revwalk.push_head() {
        Ok(_) => {}
        Err(_) => return Ok(Vec::new()), // No commits yet
    }
    revwalk.set_sorting(git2::Sort::TIME)?;

    let mut commits = Vec::new();
    for (i, oid) in revwalk.enumerate() {
        if i >= max_count {
            break;
        }
        let oid = oid?;
        let commit = repo.find_commit(oid)?;
        commits.push(CommitInfo {
            id: oid.to_string(),
            short_id: oid.to_string()[..7].to_string(),
            message: commit.message().unwrap_or("").to_string(),
            author: commit.author().name().unwrap_or("").to_string(),
            email: commit.author().email().unwrap_or("").to_string(),
            timestamp: commit.time().seconds(),
        });
    }

    Ok(commits)
}

/// Get commit log for a specific file
pub fn get_file_log(repo: &Repository, file_path: &str, max_count: usize) -> Result<Vec<CommitInfo>> {
    let mut revwalk = repo.revwalk()?;
    match revwalk.push_head() {
        Ok(_) => {}
        Err(_) => return Ok(Vec::new()), // No commits yet
    }
    revwalk.set_sorting(git2::Sort::TIME)?;

    let mut commits = Vec::new();
    let mut last_blob_id = None;

    for oid in revwalk {
        if commits.len() >= max_count {
            break;
        }
        let oid = oid?;
        let commit = repo.find_commit(oid)?;
        let tree = commit.tree()?;

        // Check if this commit modified the file
        let entry = tree.get_path(Path::new(file_path));
        match entry {
            Ok(entry) => {
                let blob_id = entry.id();
                if last_blob_id.is_none() || last_blob_id != Some(blob_id) {
                    last_blob_id = Some(blob_id);
                    commits.push(CommitInfo {
                        id: oid.to_string(),
                        short_id: oid.to_string()[..7].to_string(),
                        message: commit.message().unwrap_or("").to_string(),
                        author: commit.author().name().unwrap_or("").to_string(),
                        email: commit.author().email().unwrap_or("").to_string(),
                        timestamp: commit.time().seconds(),
                    });
                }
            }
            Err(_) => {
                // File didn't exist at this point — if it existed before, it was deleted
                if last_blob_id.is_some() {
                    last_blob_id = None;
                    commits.push(CommitInfo {
                        id: oid.to_string(),
                        short_id: oid.to_string()[..7].to_string(),
                        message: commit.message().unwrap_or("").to_string(),
                        author: commit.author().name().unwrap_or("").to_string(),
                        email: commit.author().email().unwrap_or("").to_string(),
                        timestamp: commit.time().seconds(),
                    });
                }
            }
        }
    }

    Ok(commits)
}

/// Get the content of a file at a specific commit
pub fn get_file_at_commit(repo: &Repository, commit_id: &str, file_path: &str) -> Result<String> {
    let oid = git2::Oid::from_str(commit_id)?;
    let commit = repo.find_commit(oid)?;
    let tree = commit.tree()?;
    let entry = tree.get_path(Path::new(file_path))?;
    let blob = repo.find_blob(entry.id())?;
    let content = std::str::from_utf8(blob.content())?.to_string();
    Ok(content)
}

/// Get diff of working directory changes
pub fn get_diff(repo: &Repository) -> Result<Vec<FileDiff>> {
    let head_tree = repo.head().ok().and_then(|h| h.peel_to_tree().ok());
    let mut opts = DiffOptions::new();

    let diff = repo.diff_tree_to_workdir_with_index(head_tree.as_ref(), Some(&mut opts))?;

    let file_diffs = RefCell::new(Vec::new());

    diff.foreach(
        &mut |delta, _| {
            let path = delta
                .new_file()
                .path()
                .unwrap_or(Path::new(""))
                .to_string_lossy()
                .to_string();
            file_diffs.borrow_mut().push(FileDiff {
                path,
                hunks: Vec::new(),
            });
            true
        },
        None,
        Some(&mut |_delta, hunk| {
            let mut diffs = file_diffs.borrow_mut();
            if let Some(last) = diffs.last_mut() {
                last.hunks.push(DiffHunk {
                    old_start: hunk.old_start(),
                    old_lines: hunk.old_lines(),
                    new_start: hunk.new_start(),
                    new_lines: hunk.new_lines(),
                    lines: Vec::new(),
                });
            }
            true
        }),
        Some(&mut |_delta, _hunk, line| {
            let mut diffs = file_diffs.borrow_mut();
            if let Some(last_file) = diffs.last_mut() {
                if let Some(last_hunk) = last_file.hunks.last_mut() {
                    last_hunk.lines.push(DiffLine {
                        content: std::str::from_utf8(line.content())
                            .unwrap_or("")
                            .to_string(),
                        origin: line.origin(),
                    });
                }
            }
            true
        }),
    )?;

    Ok(file_diffs.into_inner())
}

/// Pull from remote (fetch + merge)
pub fn pull(repo: &Repository) -> Result<String> {
    let mut remote = repo.find_remote("origin")?;
    let branch_name = current_branch(repo)?;

    let mut callbacks = RemoteCallbacks::new();
    callbacks.credentials(|_url, username, allowed| {
        if allowed.contains(git2::CredentialType::SSH_KEY) {
            Cred::ssh_key_from_agent(username.unwrap_or("git"))
        } else {
            Cred::default()
        }
    });

    let mut fetch_opts = FetchOptions::new();
    fetch_opts.remote_callbacks(callbacks);

    remote.fetch(&[&branch_name], Some(&mut fetch_opts), None)?;

    // Merge
    let fetch_head = repo.find_reference("FETCH_HEAD")?;
    let fetch_commit = repo.reference_to_annotated_commit(&fetch_head)?;

    let (analysis, _) = repo.merge_analysis(&[&fetch_commit])?;

    if analysis.is_up_to_date() {
        Ok("Already up to date".to_string())
    } else if analysis.is_fast_forward() {
        let mut reference = repo.find_reference(&format!("refs/heads/{}", branch_name))?;
        reference.set_target(fetch_commit.id(), "Fast-forward")?;
        repo.set_head(&format!("refs/heads/{}", branch_name))?;
        repo.checkout_head(Some(git2::build::CheckoutBuilder::default().force()))?;
        Ok("Fast-forward merge".to_string())
    } else if analysis.is_normal() {
        let mut merge_opts = MergeOptions::new();
        repo.merge(&[&fetch_commit], Some(&mut merge_opts), None)?;
        Ok("Merge completed (may have conflicts)".to_string())
    } else {
        Ok("Nothing to do".to_string())
    }
}

/// Push to remote
pub fn push(repo: &Repository) -> Result<()> {
    let mut remote = repo.find_remote("origin")?;
    let branch_name = current_branch(repo)?;

    let mut callbacks = RemoteCallbacks::new();
    callbacks.credentials(|_url, username, allowed| {
        if allowed.contains(git2::CredentialType::SSH_KEY) {
            Cred::ssh_key_from_agent(username.unwrap_or("git"))
        } else {
            Cred::default()
        }
    });

    let mut push_opts = PushOptions::new();
    push_opts.remote_callbacks(callbacks);

    remote.push(
        &[&format!("refs/heads/{}:refs/heads/{}", branch_name, branch_name)],
        Some(&mut push_opts),
    )?;

    Ok(())
}

/// Get list of conflicted files during a merge
pub fn get_conflicts(repo: &Repository) -> Result<Vec<ConflictFile>> {
    let index = repo.index()?;
    let conflicts = index.conflicts()?;
    let mut result = Vec::new();

    for conflict in conflicts {
        let conflict = conflict?;
        let path = conflict
            .our
            .as_ref()
            .or(conflict.their.as_ref())
            .and_then(|e| String::from_utf8(e.path.clone()).ok())
            .unwrap_or_default();

        let read_blob = |entry: &Option<git2::IndexEntry>| -> Option<String> {
            entry.as_ref().and_then(|e| {
                repo.find_blob(e.id)
                    .ok()
                    .and_then(|b| std::str::from_utf8(b.content()).ok().map(|s| s.to_string()))
            })
        };

        result.push(ConflictFile {
            path,
            ours: read_blob(&conflict.our),
            theirs: read_blob(&conflict.their),
            ancestor: read_blob(&conflict.ancestor),
        });
    }

    Ok(result)
}
