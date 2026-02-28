import { useEffect, useRef, useCallback, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { TitleBar } from "@/components/TitleBar/TitleBar";
import { NoteEditor } from "@/components/NoteEditor/NoteEditor";
import { NoteToolbar } from "@/components/NoteToolbar/NoteToolbar";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Editor } from "@tiptap/react";
import type { Note } from "@/types/note";

interface NoteWindowProps {
  noteId: string;
}

export function NoteWindow({ noteId }: NoteWindowProps) {
  const [note, setNote] = useState<Note | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resizeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load note data ONCE — editor is the source of truth after this
  useEffect(() => {
    invoke<Note>("get_note", { id: noteId })
      .then((data) => setNote(data))
      .catch((e) => {
        console.error("Failed to load note:", e);
        setLoadError(true);
      });
  }, [noteId]);

  // Show window once note is loaded and UI rendered
  const hasShownWindow = useRef(false);
  useEffect(() => {
    if (note && !hasShownWindow.current) {
      hasShownWindow.current = true;
      requestAnimationFrame(() => {
        invoke("show_note_window", { id: noteId }).catch(console.warn);
      });
    }
  }, [note, noteId]);

  // Known good window size — updated only when resize looks legitimate
  const goodSize = useRef<{ width: number; height: number } | null>(null);

  // Track window move/resize — save logical pixel values
  useEffect(() => {
    let unlistenMove: (() => void) | undefined;
    let unlistenResize: (() => void) | undefined;
    let mounted = true;

    // Delay registration to skip initial window positioning events
    const initTimeout = setTimeout(async () => {
      if (!mounted) return;
      try {
        const { getCurrentWebviewWindow } = await import(
          "@tauri-apps/api/webviewWindow"
        );
        const appWindow = getCurrentWebviewWindow();

        // Capture initial good size
        {
          const factor = await appWindow.scaleFactor();
          const size = await appWindow.innerSize();
          goodSize.current = {
            width: Math.round(size.width / factor),
            height: Math.round(size.height / factor),
          };
        }

        const moveUn = await appWindow.onMoved(() => {
          if (!mounted) return;
          if (moveTimer.current) clearTimeout(moveTimer.current);
          moveTimer.current = setTimeout(async () => {
            try {
              const factor = await appWindow.scaleFactor();
              const pos = await appWindow.outerPosition();
              invoke("update_note", {
                id: noteId,
                data: {
                  pos_x: Math.round(pos.x / factor),
                  pos_y: Math.round(pos.y / factor),
                },
              }).catch(console.warn);
            } catch {}
          }, 300);
        });

        const resizeUn = await appWindow.onResized(() => {
          if (!mounted) return;
          if (resizeTimer.current) clearTimeout(resizeTimer.current);
          resizeTimer.current = setTimeout(async () => {
            try {
              const factor = await appWindow.scaleFactor();
              const size = await appWindow.innerSize();
              const w = Math.round(size.width / factor);
              const h = Math.round(size.height / factor);
              // Skip saving if size is suspiciously small (e.g. screen lock/unlock glitch)
              if (w < 200 || h < 100) return;
              goodSize.current = { width: w, height: h };
              invoke("update_note", {
                id: noteId,
                data: { width: w, height: h },
              }).catch(console.warn);
            } catch {}
          }, 300);
        });

        // Restore correct size when window becomes visible again (screen unlock)
        const handleVisibility = async () => {
          if (document.visibilityState === "visible" && goodSize.current) {
            // Small delay to let the OS finish restoring
            setTimeout(async () => {
              try {
                const factor = await appWindow.scaleFactor();
                const size = await appWindow.innerSize();
                const currentW = Math.round(size.width / factor);
                const currentH = Math.round(size.height / factor);
                // If current size is much smaller than the last known good size, restore
                if (
                  goodSize.current &&
                  (currentW < goodSize.current.width * 0.7 ||
                    currentH < goodSize.current.height * 0.7)
                ) {
                  const { LogicalSize } = await import("@tauri-apps/api/dpi");
                  await appWindow.setSize(
                    new LogicalSize(goodSize.current.width, goodSize.current.height),
                  );
                }
              } catch {}
            }, 200);
          }
        };
        document.addEventListener("visibilitychange", handleVisibility);

        if (mounted) {
          unlistenMove = moveUn;
          unlistenResize = resizeUn;
        } else {
          moveUn();
          resizeUn();
          document.removeEventListener("visibilitychange", handleVisibility);
        }
      } catch (e) {
        console.warn("Window event listeners not available:", e);
      }
    }, 500);

    return () => {
      mounted = false;
      clearTimeout(initTimeout);
      if (moveTimer.current) clearTimeout(moveTimer.current);
      if (resizeTimer.current) clearTimeout(resizeTimer.current);
      unlistenMove?.();
      unlistenResize?.();
    };
  }, [noteId]);

  // Flush pending save on unmount
  useEffect(() => {
    return () => {
      if (saveTimeout.current) {
        clearTimeout(saveTimeout.current);
        if (editorRef.current) {
          invoke("update_note", {
            id: noteId,
            data: { content: JSON.stringify(editorRef.current.getJSON()) },
          }).catch(console.warn);
        }
      }
    };
  }, [noteId]);

  // Debounced content save — fire-and-forget, no store update
  const handleContentChange = useCallback(
    (content: string) => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(() => {
        invoke("update_note", { id: noteId, data: { content } }).catch(
          console.warn,
        );
      }, 500);
    },
    [noteId],
  );

  const handleEditorReady = useCallback((e: Editor) => {
    editorRef.current = e;
    setEditor(e);
  }, []);

  const handleTitleChange = useCallback(
    (newTitle: string) => {
      setNote((prev) => (prev ? { ...prev, title: newTitle } : prev));
      invoke("update_note", { id: noteId, data: { title: newTitle } }).catch(
        console.warn,
      );
    },
    [noteId],
  );

  const handleFontSizeChange = useCallback(
    (newSize: number) => {
      setNote((prev) => (prev ? { ...prev, font_size: newSize } : prev));
      invoke("update_note", { id: noteId, data: { font_size: newSize } }).catch(
        console.warn,
      );
    },
    [noteId],
  );

  const handleTogglePin = useCallback(() => {
    setNote((prev) => {
      if (!prev) return prev;
      const newPinned = !prev.is_pinned;
      invoke("set_note_pinned", { id: noteId, pinned: newPinned }).catch(
        console.warn,
      );
      return { ...prev, is_pinned: newPinned };
    });
  }, [noteId]);

  const handleClose = useCallback(async () => {
    // Flush pending content save
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
      saveTimeout.current = null;
    }
    if (editorRef.current) {
      await invoke("update_note", {
        id: noteId,
        data: { content: JSON.stringify(editorRef.current.getJSON()) },
      }).catch(console.warn);
    }
    try {
      await invoke("close_note_window", { id: noteId });
    } catch (e) {
      console.warn("close_note_window failed:", e);
    }
  }, [noteId]);

  const handleDeleteRequest = useCallback(() => {
    setConfirmingDelete(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    setConfirmingDelete(false);
    if (saveTimeout.current) {
      clearTimeout(saveTimeout.current);
      saveTimeout.current = null;
    }
    try {
      await invoke("delete_note_and_close", { id: noteId });
    } catch (e) {
      console.warn("delete_note_and_close failed:", e);
    }
  }, [noteId]);

  const handleDeleteCancel = useCallback(() => {
    setConfirmingDelete(false);
  }, []);

  if (!note) {
    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        fontSize: 14,
        color: "#999",
        backgroundColor: "#FFF9C4",
        gap: 12,
      }}>
        {loadError ? (
          <>
            <span style={{ color: "#e53e3e" }}>便签加载失败</span>
            <button
              onClick={() => {
                import("@tauri-apps/api/webviewWindow").then(({ getCurrentWebviewWindow }) => {
                  getCurrentWebviewWindow().close();
                });
              }}
              style={{
                padding: "4px 16px",
                fontSize: 13,
                border: "1px solid rgba(0,0,0,0.2)",
                borderRadius: 4,
                background: "rgba(0,0,0,0.05)",
                cursor: "pointer",
              }}
            >
              关闭窗口
            </button>
          </>
        ) : (
          <span>加载中...</span>
        )}
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300} disableHoverableContent>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          overflow: "hidden",
          backgroundColor: "#FFF9C4",
          boxShadow: "0 2px 12px rgba(0,0,0,0.12)",
        }}
      >
        <TitleBar
          title={note.title}
          isPinned={note.is_pinned}
          onTitleChange={handleTitleChange}
          onTogglePin={handleTogglePin}
          onClose={handleClose}
          onDelete={handleDeleteRequest}
        />
        {confirmingDelete && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "6px 12px",
              background: "rgba(220, 38, 38, 0.08)",
              borderBottom: "1px solid rgba(220, 38, 38, 0.15)",
              fontSize: 13,
            }}
          >
            <span style={{ color: "rgba(0,0,0,0.7)" }}>确定删除？</span>
            <button
              onClick={handleDeleteConfirm}
              style={{
                padding: "2px 12px",
                fontSize: 12,
                border: "none",
                borderRadius: 3,
                background: "#dc2626",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              删除
            </button>
            <button
              onClick={handleDeleteCancel}
              style={{
                padding: "2px 12px",
                fontSize: 12,
                border: "1px solid rgba(0,0,0,0.15)",
                borderRadius: 3,
                background: "rgba(255,255,255,0.6)",
                cursor: "pointer",
              }}
            >
              取消
            </button>
          </div>
        )}
        <NoteEditor
          initialContent={note.content}
          fontSize={note.font_size}
          onChange={handleContentChange}
          onEditorReady={handleEditorReady}
        />
        <NoteToolbar editor={editor} fontSize={note.font_size} onFontSizeChange={handleFontSizeChange} />
      </div>
    </TooltipProvider>
  );
}
