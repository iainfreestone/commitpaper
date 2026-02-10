import React, { useState, useCallback, useEffect } from "react";
import { useVaultStore } from "../../stores/vaultStore";
import { useEditorStore } from "../../stores/editorStore";
import {
  createNote,
  createFolder,
  deleteFile,
  renameFile,
  getNextUntitledName,
} from "../../lib/api";
import { getSettings, updateSettings } from "../../lib/settings";
import { ContextMenu, ContextMenuItem } from "../ContextMenu";
import type { FileTreeNode } from "../../lib/api";
import {
  trackNoteCreated,
  trackFolderCreated,
  trackNoteDeleted,
  trackNoteRenamed,
} from "../../lib/analytics";

function useStarred() {
  const [starred, setStarred] = useState<string[]>(() => {
    return getSettings().starred;
  });

  // Re-sync when vault settings are loaded
  useEffect(() => {
    const handler = (e: Event) => {
      const settings = (e as CustomEvent).detail;
      if (settings?.starred) setStarred(settings.starred);
    };
    window.addEventListener("vault-settings-loaded", handler);
    return () => window.removeEventListener("vault-settings-loaded", handler);
  }, []);

  const toggle = useCallback((path: string) => {
    setStarred((prev) => {
      const next = prev.includes(path)
        ? prev.filter((p) => p !== path)
        : [...prev, path];
      updateSettings({ starred: next });
      return next;
    });
  }, []);

  const isStarred = useCallback(
    (path: string) => starred.includes(path),
    [starred],
  );
  return { starred, toggle, isStarred };
}

export function FileTree() {
  const fileTree = useVaultStore((s) => s.fileTree);
  const refreshFileTree = useVaultStore((s) => s.refreshFileTree);
  const activeTabPath = useEditorStore((s) => s.activeTabPath);
  const openFile = useEditorStore((s) => s.openFile);
  const [newFileName, setNewFileName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createType, setCreateType] = useState<"file" | "folder">("file");
  const { starred, toggle: toggleStar, isStarred } = useStarred();

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(),
  );
  const toggleFolder = useCallback((path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);
  const expandFolder = useCallback((path: string) => {
    setExpandedFolders((prev) => {
      if (prev.has(path)) return prev;
      const next = new Set(prev);
      next.add(path);
      return next;
    });
  }, []);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: FileTreeNode;
  } | null>(null);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [draggedPath, setDraggedPath] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newFileName.trim()) return;
    try {
      if (createType === "folder") {
        const folderPath = newFileName.trim();
        await createFolder(folderPath);
        trackFolderCreated();
        const parts = folderPath.split("/");
        let accumulated = "";
        for (const part of parts) {
          accumulated = accumulated ? `${accumulated}/${part}` : part;
          expandFolder(accumulated);
        }
      } else {
        const path = newFileName.endsWith(".md")
          ? newFileName
          : `${newFileName}.md`;
        await createNote(path);
        trackNoteCreated();
        openFile(path);
      }
      await refreshFileTree();
      setNewFileName("");
      setIsCreating(false);
    } catch (e) {
      console.error(`Failed to create ${createType}:`, e);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, node: FileTreeNode) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  };

  const handleRename = async (oldPath: string) => {
    if (!renameValue.trim() || renameValue === oldPath.split("/").pop()) {
      setRenamingPath(null);
      return;
    }
    try {
      const dir = oldPath.includes("/")
        ? oldPath.substring(0, oldPath.lastIndexOf("/") + 1)
        : "";
      await renameFile(oldPath, dir + renameValue);
      trackNoteRenamed();
      await refreshFileTree();
    } catch (e) {
      console.error("Failed to rename:", e);
    }
    setRenamingPath(null);
  };

  const handleDelete = async (path: string) => {
    const name = path.split("/").pop() || path;
    const confirmed = window.confirm(
      `Are you sure you want to delete "${name}"? This cannot be undone.`,
    );
    if (!confirmed) return;
    try {
      await deleteFile(path);
      trackNoteDeleted();
      await refreshFileTree();
    } catch (e) {
      console.error("Failed to delete:", e);
    }
  };

  const handleDragStart = (e: React.DragEvent, path: string) => {
    setDraggedPath(path);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = async (e: React.DragEvent, targetFolderPath: string) => {
    e.preventDefault();
    setDropTarget(null);
    if (!draggedPath) return;
    const fileName = draggedPath.split("/").pop() || draggedPath;
    const newPath = targetFolderPath
      ? `${targetFolderPath}/${fileName}`
      : fileName;
    if (newPath === draggedPath) return;
    try {
      await renameFile(draggedPath, newPath);
      await refreshFileTree();
    } catch (e) {
      console.error("Failed to move file:", e);
    }
    setDraggedPath(null);
  };

  const getContextMenuItems = (node: FileTreeNode): ContextMenuItem[] => {
    const items: ContextMenuItem[] = [];
    if (node.type === "file") {
      items.push({
        label: isStarred(node.path) ? "Unstar" : "Star",
        icon: isStarred(node.path) ? "★" : "☆",
        onClick: () => toggleStar(node.path),
      });
      items.push({ separator: true, label: "-" });
    }
    items.push({
      label: "Rename",
      icon: "✏️",
      onClick: () => {
        setRenamingPath(node.path);
        setRenameValue(node.name);
      },
    });
    if (node.type === "folder") {
      items.push({
        label: "New Note Here",
        icon: "📄",
        onClick: () => {
          setIsCreating(true);
          setCreateType("file");
          setNewFileName(node.path + "/");
        },
      });
      items.push({
        label: "New Folder Here",
        icon: "📁",
        onClick: () => {
          setIsCreating(true);
          setCreateType("folder");
          setNewFileName(node.path + "/");
        },
      });
    }
    items.push({ separator: true, label: "-" });
    items.push({
      label: "Delete",
      icon: "🗑️",
      danger: true,
      onClick: () => handleDelete(node.path),
    });
    return items;
  };

  const findNode = (
    tree: FileTreeNode[],
    path: string,
  ): FileTreeNode | null => {
    for (const n of tree) {
      if (n.path === path) return n;
      if (n.children) {
        const f = findNode(n.children, path);
        if (f) return f;
      }
    }
    return null;
  };
  const starredFiles = starred.filter((p) => findNode(fileTree, p) !== null);

  return (
    <div>
      <div
        style={{
          padding: "4px 8px",
          display: "flex",
          alignItems: "center",
          gap: "4px",
        }}
      >
        <span className="sidebar-section-title" style={{ flex: 1 }}>
          Explorer
        </span>
        <button
          className="git-action-btn"
          onClick={() => {
            setIsCreating(true);
            setCreateType("folder");
            setNewFileName("");
          }}
          title="New Folder"
        >
          📁
        </button>
        <button
          className="git-action-btn"
          onClick={async () => {
            try {
              const path = await getNextUntitledName();
              const title = path.replace(/\.md$/, "");
              await createNote(path, `# ${title}\n`);
              openFile(path);
              await refreshFileTree();
            } catch (e) {
              console.error("Failed to create note:", e);
            }
          }}
          title="New Note"
        >
          +
        </button>
      </div>

      {isCreating && (
        <div style={{ padding: "4px 12px" }}>
          <input
            autoFocus
            placeholder={
              createType === "folder" ? "folder-name" : "note-name.md"
            }
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreate();
              if (e.key === "Escape") setIsCreating(false);
            }}
            style={{ width: "100%", fontSize: "12px" }}
          />
        </div>
      )}

      {starredFiles.length > 0 && (
        <>
          <div
            className="sidebar-section-title"
            style={{ padding: "8px 12px 4px" }}
          >
            ★ Starred
          </div>
          {starredFiles.map((path) => {
            const name = (path.split("/").pop() || path).replace(/\.md$/, "");
            return (
              <div
                key={`starred-${path}`}
                className={`file-tree-item ${activeTabPath === path ? "active" : ""}`}
                style={{ paddingLeft: "12px" }}
                onClick={() => openFile(path)}
                onContextMenu={(e) => {
                  const n = findNode(fileTree, path);
                  if (n) handleContextMenu(e, n);
                }}
              >
                <span
                  className="file-tree-icon"
                  style={{ color: "var(--yellow)" }}
                >
                  ★
                </span>
                <span className="file-tree-name">{name}</span>
              </div>
            );
          })}
          <div
            style={{
              borderBottom: "1px solid var(--border-color)",
              margin: "4px 12px",
            }}
          />
        </>
      )}

      {fileTree.map((node) => (
        <FileTreeItem
          key={node.path}
          node={node}
          depth={0}
          activePath={activeTabPath}
          onFileClick={openFile}
          onContextMenu={handleContextMenu}
          renamingPath={renamingPath}
          renameValue={renameValue}
          onRenameChange={setRenameValue}
          onRenameSubmit={handleRename}
          onRenameCancel={() => setRenamingPath(null)}
          dropTarget={dropTarget}
          onDragStart={handleDragStart}
          onDragOver={(e, p, f) => {
            e.preventDefault();
            if (f && draggedPath && draggedPath !== p) setDropTarget(p);
          }}
          onDragLeave={() => setDropTarget(null)}
          onDrop={handleDrop}
          expandedFolders={expandedFolders}
          toggleFolder={toggleFolder}
        />
      ))}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={getContextMenuItems(contextMenu.node)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

function FileTreeItem({
  node,
  depth,
  activePath,
  onFileClick,
  onContextMenu,
  renamingPath,
  renameValue,
  onRenameChange,
  onRenameSubmit,
  onRenameCancel,
  dropTarget,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  expandedFolders,
  toggleFolder,
}: {
  node: FileTreeNode;
  depth: number;
  activePath: string | null;
  onFileClick: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, node: FileTreeNode) => void;
  renamingPath: string | null;
  renameValue: string;
  onRenameChange: (v: string) => void;
  onRenameSubmit: (oldPath: string) => void;
  onRenameCancel: () => void;
  dropTarget: string | null;
  onDragStart: (e: React.DragEvent, path: string) => void;
  onDragOver: (e: React.DragEvent, path: string, isFolder: boolean) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, folderPath: string) => void;
  expandedFolders: Set<string>;
  toggleFolder: (path: string) => void;
}) {
  const isOpen = expandedFolders.has(node.path);
  const isRenaming = renamingPath === node.path;
  const isDropTgt = dropTarget === node.path;

  const renameInput = (
    <input
      autoFocus
      className="file-tree-rename-input"
      value={renameValue}
      onChange={(e) => onRenameChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") onRenameSubmit(node.path);
        if (e.key === "Escape") onRenameCancel();
      }}
      onBlur={() => onRenameSubmit(node.path)}
      onClick={(e) => e.stopPropagation()}
    />
  );

  if (node.type === "folder") {
    return (
      <>
        <div
          className={`file-tree-item ${isDropTgt ? "drop-target" : ""}`}
          style={{ paddingLeft: `${12 + depth * 16}px` }}
          onClick={() => toggleFolder(node.path)}
          onContextMenu={(e) => onContextMenu(e, node)}
          onDragOver={(e) => onDragOver(e, node.path, true)}
          onDragLeave={onDragLeave}
          onDrop={(e) => onDrop(e, node.path)}
        >
          <span className="file-tree-icon">{isOpen ? "▾" : "▸"}</span>
          {isRenaming ? (
            renameInput
          ) : (
            <span className="file-tree-name">{node.name}</span>
          )}
        </div>
        {isOpen &&
          node.children?.map((child) => (
            <FileTreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              activePath={activePath}
              onFileClick={onFileClick}
              onContextMenu={onContextMenu}
              renamingPath={renamingPath}
              renameValue={renameValue}
              onRenameChange={onRenameChange}
              onRenameSubmit={onRenameSubmit}
              onRenameCancel={onRenameCancel}
              dropTarget={dropTarget}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              expandedFolders={expandedFolders}
              toggleFolder={toggleFolder}
            />
          ))}
      </>
    );
  }

  return (
    <div
      className={`file-tree-item ${activePath === node.path ? "active" : ""}`}
      style={{ paddingLeft: `${12 + depth * 16}px` }}
      onClick={() => !isRenaming && onFileClick(node.path)}
      onContextMenu={(e) => onContextMenu(e, node)}
      draggable={!isRenaming}
      onDragStart={(e) => onDragStart(e, node.path)}
    >
      <span className="file-tree-icon">📄</span>
      {isRenaming ? (
        renameInput
      ) : (
        <span className="file-tree-name">{node.name}</span>
      )}
    </div>
  );
}
