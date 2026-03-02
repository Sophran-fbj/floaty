import { useEffect, useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Note } from "@/types/note";
import styles from "./ManagerWindow.module.css";

export function ManagerWindow() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const dragRef = useRef<HTMLDivElement>(null);

  const loadNotes = useCallback(async () => {
    try {
      const data = await invoke<Note[]>("get_all_notes");
      setNotes(data);
    } catch (e) {
      console.warn("Failed to load notes:", e);
    }
  }, []);

  useEffect(() => {
    loadNotes();
  }, [loadNotes]);

  // Refresh notes when the window becomes visible again (after hide/show cycle)
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        loadNotes();
        setConfirmDeleteId(null);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [loadNotes]);

  // Show manager window once rendered
  const hasShown = useRef(false);
  useEffect(() => {
    if (!hasShown.current) {
      hasShown.current = true;
      import("@tauri-apps/api/webviewWindow").then(
        ({ getCurrentWebviewWindow }) => {
          const win = getCurrentWebviewWindow();
          win.show().catch(console.warn);
          win.setFocus().catch(console.warn);
        },
      );
    }
  }, []);

  const handleDragStart = useCallback(
    async (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest("button")) return;
      try {
        const { getCurrentWebviewWindow } = await import(
          "@tauri-apps/api/webviewWindow"
        );
        getCurrentWebviewWindow().startDragging();
      } catch {}
    },
    [],
  );

  const handleClose = useCallback(async () => {
    try {
      const { getCurrentWebviewWindow } = await import(
        "@tauri-apps/api/webviewWindow"
      );
      // Hide instead of close — avoids re-creating WebView2 on next open
      getCurrentWebviewWindow().hide();
    } catch {}
  }, []);

  const handleNewNote = useCallback(async () => {
    try {
      const note = await invoke<Note>("create_note");
      await invoke("open_note_window", { id: note.id });
      loadNotes();
    } catch (e) {
      console.warn("Failed to create note:", e);
    }
  }, [loadNotes]);

  const handleOpenNote = useCallback(async (id: string) => {
    try {
      await invoke("open_note_window", { id });
    } catch (e) {
      console.warn("Failed to open note:", e);
    }
  }, []);

  const handleDeleteRequest = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setConfirmDeleteId(id);
    },
    [],
  );

  const handleDeleteConfirm = useCallback(async () => {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    try {
      await invoke("delete_note_and_close", { id });
      loadNotes();
    } catch (err) {
      console.warn("Failed to delete note:", err);
    }
  }, [confirmDeleteId, loadNotes]);

  const handleDeleteCancel = useCallback(() => {
    setConfirmDeleteId(null);
  }, []);

  const formatTime = (isoStr: string) => {
    try {
      const d = new Date(isoStr + "Z");
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return "刚刚";
      if (diffMin < 60) return `${diffMin}分钟前`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr}小时前`;
      const diffDay = Math.floor(diffHr / 24);
      if (diffDay < 30) return `${diffDay}天前`;
      return d.toLocaleDateString("zh-CN");
    } catch {
      return "";
    }
  };

  const getNoteTitle = (note: Note) => {
    if (note.title && note.title.trim()) return note.title;
    // Try to extract first line from content
    try {
      const json = JSON.parse(note.content);
      const firstText = findFirstText(json);
      if (firstText) return firstText;
    } catch {}
    return "无标题便签";
  };

  return (
    <div className={styles.container}>
      <div
        ref={dragRef}
        className={styles.titleBar}
        onMouseDown={handleDragStart}
      >
        <span className={styles.titleText}>管理便签</span>
        <div className={styles.titleActions}>
          <button
            className={styles.iconBtn}
            onClick={handleNewNote}
            title="新建便签"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          <button
            className={styles.iconBtn}
            onClick={loadNotes}
            title="刷新列表"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
            </svg>
          </button>
          <button
            className={`${styles.iconBtn} ${styles.closeBtn}`}
            onClick={handleClose}
            title="关闭"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className={styles.content}>
        {notes.length === 0 ? (
          <div className={styles.emptyState}>
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z" />
              <path d="M15 3v4a2 2 0 0 0 2 2h4" />
            </svg>
            <span>暂无便签</span>
          </div>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className={styles.noteCard}
              onClick={() =>
                confirmDeleteId !== note.id && handleOpenNote(note.id)
              }
            >
              {confirmDeleteId === note.id ? (
                <div className={styles.confirmRow}>
                  <span className={styles.confirmText}>确定删除？</span>
                  <button
                    className={styles.confirmBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteConfirm();
                    }}
                  >
                    删除
                  </button>
                  <button
                    className={styles.cancelBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCancel();
                    }}
                  >
                    取消
                  </button>
                </div>
              ) : (
                <>
                  <div className={styles.noteIcon}>
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M16 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8Z" />
                      <path d="M15 3v4a2 2 0 0 0 2 2h4" />
                    </svg>
                  </div>
                  <div className={styles.noteInfo}>
                    <div className={styles.noteTitle}>
                      {getNoteTitle(note)}
                    </div>
                    <div className={styles.noteTime}>
                      {formatTime(note.updated_at)}
                    </div>
                  </div>
                  {note.is_pinned && (
                    <div className={styles.pinnedIcon} title="已置顶">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        stroke="currentColor"
                        strokeWidth="1"
                      >
                        <path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z" />
                      </svg>
                    </div>
                  )}
                  <div className={styles.noteActions}>
                    <button
                      className={`${styles.smallBtn} ${styles.deleteBtn}`}
                      onClick={(e) => handleDeleteRequest(e, note.id)}
                      title="删除"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>

      <div className={styles.statusBar}>
        <span>共 {notes.length} 个便签</span>
      </div>
    </div>
  );
}

/** Recursively find the first non-empty text string in a TipTap JSON document */
function findFirstText(node: unknown): string | null {
  if (!node || typeof node !== "object") return null;
  const obj = node as Record<string, unknown>;
  if (obj.type === "text" && typeof obj.text === "string" && obj.text.trim()) {
    const text = (obj.text as string).trim();
    return text.length > 40 ? text.slice(0, 40) + "..." : text;
  }
  if (Array.isArray(obj.content)) {
    for (const child of obj.content) {
      const found = findFirstText(child);
      if (found) return found;
    }
  }
  return null;
}
