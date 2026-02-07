import React from "react";
import { useEditorStore } from "../../stores/editorStore";
import { useVaultStore } from "../../stores/vaultStore";
import * as api from "../../lib/api";

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatDisplay(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

async function openDailyNote(dateStr: string) {
  const path = `daily/${dateStr}.md`;

  try {
    await useEditorStore.getState().openFile(path);
  } catch {
    try {
      await api.createFolder("daily");
    } catch {
      // folder may already exist
    }

    const template = `---
date: ${dateStr}
type: daily-note
---

# ${formatDisplay(new Date(dateStr + "T00:00:00"))}

## Tasks
- [ ] 

## Notes


## Journal

`;
    await api.writeFile(path, template);
    await useVaultStore.getState().refreshFileTree();
    await useEditorStore.getState().openFile(path);
  }
}

export function DailyNotes() {
  const today = new Date();
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(d);
  }

  return (
    <div className="daily-notes-panel" style={{ padding: "8px" }}>
      <div className="sidebar-section-title">Daily Notes</div>

      <button
        className="daily-today-btn"
        onClick={() => openDailyNote(formatDate(today))}
      >
        Open Today's Note
      </button>

      <div className="daily-list">
        {dates.map((d) => {
          const ds = formatDate(d);
          const isToday = ds === formatDate(today);
          return (
            <div
              key={ds}
              className={`daily-list-item ${isToday ? "today" : ""}`}
              onClick={() => openDailyNote(ds)}
            >
              <span className="daily-date">{ds}</span>
              <span className="daily-day">
                {d.toLocaleDateString("en-US", { weekday: "short" })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Call this from a global shortcut (Alt+D) */
export function openTodayNote() {
  openDailyNote(formatDate(new Date()));
}
