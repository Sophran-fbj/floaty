import { useState, useRef, useEffect } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import styles from "./TitleBar.module.css";

const appWindow = getCurrentWebviewWindow();

interface TitleBarProps {
  title: string;
  onTitleChange: (title: string) => void;
  onClose: () => void;
  onDelete: () => void;
}

export function TitleBar({ title, onTitleChange, onClose, onDelete }: TitleBarProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    if ((e.target as HTMLElement).closest("input")) return;
    if ((e.target as HTMLElement).closest("." + styles.titleText)) return;
    appWindow.startDragging();
  };

  const commitTitle = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed !== title) {
      onTitleChange(trimmed);
    }
  };

  const handleTitleClick = () => {
    setDraft(title);
    setEditing(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      commitTitle();
    } else if (e.key === "Escape") {
      setEditing(false);
      setDraft(title);
    }
  };

  return (
    <div className={styles.titleBar} onMouseDown={handleMouseDown}>
      <div className={styles.titleArea}>
        {editing ? (
          <input
            ref={inputRef}
            className={styles.titleInput}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={handleKeyDown}
            placeholder="无标题"
          />
        ) : (
          <span
            className={`${styles.titleText} ${!title ? styles.placeholder : ""}`}
            onClick={handleTitleClick}
          >
            {title || "无标题"}
          </span>
        )}
      </div>
      <div className={styles.actions}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={styles.btn}
              onClick={onDelete}
            >
              🗑
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">删除便签</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={styles.btn}
              onClick={onClose}
            >
              ✕
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">关闭</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
