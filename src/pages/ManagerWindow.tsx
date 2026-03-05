import { useEffect, useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ArrowUpToLine, Trash2, RotateCcw, X } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import type { Note } from "@/types/note";
import styles from "./ManagerWindow.module.css";

function SortableNoteCard({
  note,
  confirmDeleteId,
  onOpen,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
  formatTime,
  getNoteTitle,
}: {
  note: Note;
  confirmDeleteId: string | null;
  onOpen: (id: string) => void;
  onDeleteRequest: (id: string) => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
  formatTime: (isoStr: string) => string;
  getNoteTitle: (note: Note) => string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: note.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${styles.noteCard} ${note.is_visible ? styles.noteCardOpen : ""} ${note.is_pinned ? styles.noteCardPinned : ""} ${isDragging ? styles.dragging : ""}`}
      onClick={() => onOpen(note.id)}
      {...attributes}
      {...listeners}
    >
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
        <div className={styles.noteTitle}>{getNoteTitle(note)}</div>
        <div className={styles.noteTime}>
          {formatTime(note.updated_at)}
        </div>
      </div>
      {note.is_pinned && (
        <div className={styles.pinnedIcon} title="已置顶">
          <ArrowUpToLine size={14} strokeWidth={3} />
        </div>
      )}
      <div className={styles.noteActions}>
        <Popover
          open={confirmDeleteId === note.id}
          onOpenChange={(open) => {
            if (!open) onDeleteCancel();
          }}
        >
          <PopoverTrigger asChild>
            <button
              className={`${styles.smallBtn} ${styles.deleteBtn}`}
              onClick={(e) => {
                e.stopPropagation();
                onDeleteRequest(note.id);
              }}
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
          </PopoverTrigger>
          <PopoverContent
            className="w-auto p-3"
            side="left"
            align="center"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm text-muted-foreground mb-3">移到回收站？</p>
            <div className="flex justify-center gap-2">
              <button
                className="px-3 py-1.5 text-xs rounded-md bg-muted text-muted-foreground hover:bg-muted/70 transition-colors cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteCancel();
                }}
              >
                取消
              </button>
              <button
                className="px-3 py-1.5 text-xs rounded-md bg-red-500/85 text-white hover:bg-red-500 transition-colors cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteConfirm();
                }}
              >
                删除
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

function NoteCardContent({
  note,
  formatTime,
  getNoteTitle,
}: {
  note: Note;
  formatTime: (isoStr: string) => string;
  getNoteTitle: (note: Note) => string;
}) {
  return (
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
        <div className={styles.noteTitle}>{getNoteTitle(note)}</div>
        <div className={styles.noteTime}>{formatTime(note.updated_at)}</div>
      </div>
      {note.is_pinned && (
        <div className={styles.pinnedIcon} title="已置顶">
          <ArrowUpToLine size={14} strokeWidth={3} />
        </div>
      )}
    </>
  );
}

export function ManagerWindow() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [trashNotes, setTrashNotes] = useState<Note[]>([]);
  const [activeTab, setActiveTab] = useState<"notes" | "trash">("notes");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmEmptyTrash, setConfirmEmptyTrash] = useState(false);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const dragRef = useRef<HTMLDivElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  const loadNotes = useCallback(async () => {
    try {
      const data = await invoke<Note[]>("get_all_notes");
      setNotes(data);
    } catch (e) {
      console.warn("Failed to load notes:", e);
    }
  }, []);

  const loadTrashNotes = useCallback(async () => {
    try {
      const data = await invoke<Note[]>("get_deleted_notes");
      setTrashNotes(data);
    } catch (e) {
      console.warn("Failed to load trash notes:", e);
    }
  }, []);

  useEffect(() => {
    loadNotes();
    loadTrashNotes();
  }, [loadNotes, loadTrashNotes]);

  // Refresh notes when the window becomes visible again (after hide/show cycle)
  useEffect(() => {
    const onVisibility = async () => {
      if (document.visibilityState === "visible") {
        loadNotes();
        loadTrashNotes();
        setConfirmDeleteId(null);
        setConfirmEmptyTrash(false);
        // Fix DPI scaling after screen lock/unlock
        try {
          const { getCurrentWebviewWindow } = await import("@tauri-apps/api/webviewWindow");
          const { LogicalSize } = await import("@tauri-apps/api/dpi");
          const win = getCurrentWebviewWindow();
          const size = await win.innerSize();
          const factor = await win.scaleFactor();
          await win.setSize(new LogicalSize(
            Math.round(size.width / factor),
            Math.round(size.height / factor)
          ));
        } catch {}
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [loadNotes, loadTrashNotes]);

  // Refresh notes when any note state changes (Rust backend emits "notes-changed")
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let mounted = true;
    let debounceTimer: ReturnType<typeof setTimeout>;
    listen("notes-changed", () => {
      if (!mounted) return;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        loadNotes();
        loadTrashNotes();
      }, 300);
    }).then((fn) => {
      if (mounted) {
        unlisten = fn;
      } else {
        fn();
      }
    });
    return () => {
      mounted = false;
      clearTimeout(debounceTimer);
      unlisten?.();
    };
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

  // Drag title bar: only start dragging after mouse moves a threshold distance,
  // so a simple click (to activate window) won't trigger drag.
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      if ((e.target as HTMLElement).closest("button")) return;
      const startX = e.screenX;
      const startY = e.screenY;
      const threshold = 4;

      const onMouseMove = async (moveEvent: MouseEvent) => {
        const dx = moveEvent.screenX - startX;
        const dy = moveEvent.screenY - startY;
        if (dx * dx + dy * dy >= threshold * threshold) {
          cleanup();
          try {
            const { getCurrentWebviewWindow } = await import(
              "@tauri-apps/api/webviewWindow"
            );
            getCurrentWebviewWindow().startDragging();
          } catch {}
        }
      };

      const onMouseUp = () => cleanup();

      const cleanup = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      };

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [],
  );

  const handleMinimize = useCallback(async () => {
    try {
      const { getCurrentWebviewWindow } = await import(
        "@tauri-apps/api/webviewWindow"
      );
      await getCurrentWebviewWindow().minimize();
    } catch (e) {
      console.error("Minimize failed:", e);
    }
  }, []);

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

  const handleDeleteRequest = useCallback((id: string) => {
    setConfirmDeleteId(id);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    try {
      await invoke("delete_note_and_close", { id });
    } catch (err) {
      console.warn("Failed to delete note:", err);
      loadNotes();
    }
  }, [confirmDeleteId, loadNotes]);

  const handleDeleteCancel = useCallback(() => {
    setConfirmDeleteId(null);
  }, []);

  const handleRestoreNote = useCallback(async (id: string) => {
    try {
      await invoke("restore_note", { id });
    } catch (e) {
      console.warn("Failed to restore note:", e);
    }
  }, []);

  const handlePermanentDelete = useCallback(async (id: string) => {
    try {
      await invoke("permanently_delete_note", { id });
    } catch (e) {
      console.warn("Failed to permanently delete note:", e);
    }
  }, []);

  const handleEmptyTrash = useCallback(async () => {
    try {
      await invoke("empty_trash");
      setConfirmEmptyTrash(false);
    } catch (e) {
      console.warn("Failed to empty trash:", e);
    }
  }, []);

  const handleDndStart = useCallback(
    (event: DragStartEvent) => {
      const found = notes.find((n) => n.id === event.active.id);
      setActiveNote(found ?? null);
    },
    [notes],
  );

  const handleDndEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveNote(null);
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = notes.findIndex((n) => n.id === active.id);
      const newIndex = notes.findIndex((n) => n.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const prevNotes = notes;
      const reordered = arrayMove(notes, oldIndex, newIndex);
      setNotes(reordered);

      const ids = reordered.map((n) => n.id);
      invoke("reorder_notes", { ids }).catch((e: unknown) => {
        console.warn("Failed to reorder notes:", e);
        setNotes(prevNotes);
      });
    },
    [notes],
  );

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
        <span className={styles.titleText}>{activeTab === "notes" ? "管理便签" : "回收站"}</span>
        <div className={styles.titleActions}>
          <button
            className={`${styles.iconBtn} ${activeTab === "trash" ? styles.trashActive : ""}`}
            onClick={() => setActiveTab(activeTab === "notes" ? "trash" : "notes")}
            title={activeTab === "notes" ? "回收站" : "返回便签"}
          >
            <Trash2 size={14} />
          </button>
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
            className={styles.iconBtn}
            onClick={handleMinimize}
            title="最小化"
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
              <path d="M5 12h14" />
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
        {activeTab === "notes" ? (
          <>
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
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDndStart}
                onDragEnd={handleDndEnd}
              >
                <SortableContext
                  items={notes.map((n) => n.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {notes.map((note) => (
                    <SortableNoteCard
                      key={note.id}
                      note={note}
                      confirmDeleteId={confirmDeleteId}
                      onOpen={handleOpenNote}
                      onDeleteRequest={handleDeleteRequest}
                      onDeleteConfirm={handleDeleteConfirm}
                      onDeleteCancel={handleDeleteCancel}
                      formatTime={formatTime}
                      getNoteTitle={getNoteTitle}
                    />
                  ))}
                </SortableContext>
                <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
                  {activeNote ? (
                    <div
                      className={`${styles.noteCard} ${styles.dragOverlay} ${activeNote.is_visible ? styles.noteCardOpen : ""} ${activeNote.is_pinned ? styles.noteCardPinned : ""}`}
                    >
                      <NoteCardContent
                        note={activeNote}
                        formatTime={formatTime}
                        getNoteTitle={getNoteTitle}
                      />
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            )}
          </>
        ) : (
          <>
            {trashNotes.length === 0 ? (
              <div className={styles.emptyState}>
                <Trash2 size={32} strokeWidth={1.5} />
                <span>回收站为空</span>
              </div>
            ) : (
              <>
                {trashNotes.map((note) => (
                  <div key={note.id} className={`${styles.noteCard} ${styles.trashCard}`}>
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
                      <div className={styles.noteTitle}>{getNoteTitle(note)}</div>
                      <div className={styles.noteTime}>
                        删除于 {note.deleted_at ? formatTime(note.deleted_at) : ""}
                      </div>
                    </div>
                    <div className={styles.trashActions}>
                      <button
                        className={`${styles.smallBtn} ${styles.restoreBtn}`}
                        onClick={() => handleRestoreNote(note.id)}
                        title="恢复"
                      >
                        <RotateCcw size={14} />
                      </button>
                      <button
                        className={`${styles.smallBtn} ${styles.deleteBtn}`}
                        onClick={() => handlePermanentDelete(note.id)}
                        title="永久删除"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                <div className={styles.emptyTrashArea}>
                  {confirmEmptyTrash ? (
                    <div className={styles.emptyTrashConfirm}>
                      <span>确定清空回收站？此操作不可撤销</span>
                      <div className={styles.emptyTrashBtns}>
                        <button
                          className={styles.emptyTrashCancel}
                          onClick={() => setConfirmEmptyTrash(false)}
                        >
                          取消
                        </button>
                        <button
                          className={styles.emptyTrashConfirmBtn}
                          onClick={handleEmptyTrash}
                        >
                          清空
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className={styles.emptyTrashBtn}
                      onClick={() => setConfirmEmptyTrash(true)}
                    >
                      清空回收站
                    </button>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>

      <div className={styles.statusBar}>
        <span>
          {activeTab === "notes"
            ? `共 ${notes.length} 个便签`
            : `回收站 ${trashNotes.length} 个便签`}
        </span>
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
