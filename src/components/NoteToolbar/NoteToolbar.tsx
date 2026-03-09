import { useState, useRef, useEffect } from "react";
import type { Editor } from "@tiptap/react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Link2, Unlink } from "lucide-react";
import styles from "./NoteToolbar.module.css";

interface NoteToolbarProps {
  editor: Editor | null;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  opacity: number;
  onOpacityChange: (opacity: number) => void;
}

type ToolbarItem = {
  label: string;
  command: string;
  title: string;
  mark: string;
  attrs?: Record<string, any>;
  noActive?: boolean;
};

const TEXT_FORMAT_ITEMS: ToolbarItem[] = [
  { label: "B", command: "toggleBold", title: "加粗", mark: "bold" },
  { label: "I", command: "toggleItalic", title: "斜体", mark: "italic" },
  { label: "U", command: "toggleUnderline", title: "下划线", mark: "underline" },
  { label: "S", command: "toggleStrike", title: "删除线", mark: "strike" },
];

const BLOCK_FORMAT_ITEMS: ToolbarItem[] = [
  { label: "\u2022", command: "toggleBulletList", title: "无序列表", mark: "bulletList", noActive: true },
  { label: "1.", command: "toggleOrderedList", title: "有序列表", mark: "orderedList", noActive: true },
  { label: "\u2611", command: "toggleTaskList", title: "任务列表", mark: "taskList", noActive: true },
];

function LinkButton({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const isActive = editor.isActive("link");

  useEffect(() => {
    if (open) {
      const existing = editor.getAttributes("link").href || "";
      setUrl(existing);
      setTimeout(() => inputRef.current?.select(), 0);
    }
  }, [open, editor]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const applyLink = () => {
    if (!url.trim()) {
      editor.chain().focus().unsetLink().run();
    } else {
      editor.chain().focus().setLink({ href: url.trim() }).run();
    }
    setOpen(false);
  };

  const removeLink = () => {
    editor.chain().focus().unsetLink().run();
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={`${styles.btn} ${isActive ? styles.active : ""}`}
            >
              <Link2 size={14} />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">链接 (Ctrl+K)</TooltipContent>
      </Tooltip>
      <PopoverContent
        side="top"
        align="start"
        className={styles.linkPopover}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className={styles.linkForm}>
          <input
            ref={inputRef}
            type="url"
            className={styles.linkInput}
            placeholder="输入链接地址..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyLink();
              }
              if (e.key === "Escape") {
                setOpen(false);
              }
            }}
          />
          {isActive && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={styles.linkAction}
                  onClick={removeLink}
                >
                  <Unlink size={14} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">移除链接</TooltipContent>
            </Tooltip>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function NoteToolbar({ editor, fontSize, onFontSizeChange, opacity, onOpacityChange }: NoteToolbarProps) {
  if (!editor) return null;

  const renderItem = (item: ToolbarItem) => {
    const isActive = !item.noActive && (item.attrs
      ? editor.isActive(item.mark, item.attrs)
      : editor.isActive(item.mark));

    const handleClick = () => {
      if (item.attrs) {
        (editor.chain().focus() as any)[item.command](item.attrs).run();
      } else {
        (editor.chain().focus() as any)[item.command]().run();
      }
    };

    return (
      <Tooltip key={item.command + (item.attrs?.level || "")}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={`${styles.btn} ${isActive ? styles.active : ""}`}
            onClick={handleClick}
          >
            {item.label}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{item.title}</TooltipContent>
      </Tooltip>
    );
  };

  return (
    <div className={styles.toolbarWrapper}>
      <div className={styles.toolbar}>
        {TEXT_FORMAT_ITEMS.map(renderItem)}
        <LinkButton editor={editor} />
        <div className={styles.separator} />
        {BLOCK_FORMAT_ITEMS.map(renderItem)}
        <div className={styles.spacer} />
        <div className={styles.fontSizeGroup}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={styles.btn}
                onClick={() => onFontSizeChange(Math.max(10, fontSize - 1))}
              >
                A-
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">缩小字体</TooltipContent>
          </Tooltip>
          <span className={styles.fontSizeLabel}>{fontSize}</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={styles.btn}
                onClick={() => onFontSizeChange(Math.min(24, fontSize + 1))}
              >
                A+
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">增大字体</TooltipContent>
          </Tooltip>
        </div>
        <div className={styles.separator} />
        <div className={styles.opacityGroup}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={styles.btn}
                onClick={() => onOpacityChange(Math.max(0.2, Math.round((opacity - 0.1) * 10) / 10))}
              >
                ◐
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">降低透明度</TooltipContent>
          </Tooltip>
          <span className={styles.opacityLabel}>{Math.round(opacity * 100)}%</span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={styles.btn}
                onClick={() => onOpacityChange(Math.min(1.0, Math.round((opacity + 0.1) * 10) / 10))}
              >
                ●
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">增加透明度</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
