import { type CSSProperties, useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Extension } from "@tiptap/core";
import type { Editor } from "@tiptap/react";
import Document from "@tiptap/extension-document";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { openUrl } from "@tauri-apps/plugin-opener";
import styles from "./NoteEditor.module.css";

/**
 * Backspace at the start of a list item → lift (convert to paragraph)
 * instead of merging with the previous line.
 */
const ListBackspace = Extension.create({
  name: "listBackspace",
  priority: 1000,
  addKeyboardShortcuts() {
    return {
      Backspace: ({ editor }) => {
        const { selection } = editor.state;
        const { $from, empty } = selection;
        if (!empty || $from.parentOffset !== 0) return false;

        for (let d = $from.depth; d > 0; d--) {
          const node = $from.node(d);
          const name = node.type.name;
          if (name === "listItem" || name === "taskItem") {
            if ($from.before($from.depth) === $from.start(d)) {
              return editor.commands.liftListItem(
                name as "listItem" | "taskItem",
              );
            }
            return false;
          }
        }
        return false;
      },
    };
  },
});

/**
 * Remove trailing empty paragraph when the cursor is elsewhere.
 * Uses requestAnimationFrame + transaction meta to avoid infinite loops.
 */
const CleanTrailingEmpty = Extension.create({
  name: "cleanTrailingEmpty",
  onTransaction({ editor, transaction }) {
    if (!transaction.docChanged) return;
    if (transaction.getMeta("cleanTrailingEmpty")) return;

    requestAnimationFrame(() => {
      const { doc, selection } = editor.state;
      const lastChild = doc.lastChild;
      if (!lastChild || doc.childCount <= 1) return;
      if (lastChild.type.name !== "paragraph") return;
      if (lastChild.content.size !== 0) return;

      const lastChildStart = doc.content.size - lastChild.nodeSize;
      if (selection.from >= lastChildStart) return;

      const { tr } = editor.state;
      tr.delete(lastChildStart, doc.content.size);
      tr.setMeta("cleanTrailingEmpty", true);
      editor.view.dispatch(tr);
    });
  },
});

interface NoteEditorProps {
  initialContent: string;
  fontSize: number;
  onChange: (content: string) => void;
  onEditorReady?: (editor: Editor) => void;
}

export function NoteEditor({
  initialContent,
  fontSize,
  onChange,
  onEditorReady,
}: NoteEditorProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const onKey = (e: KeyboardEvent) => {
      el.classList.toggle(styles.ctrlHeld, e.ctrlKey || e.metaKey);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    window.addEventListener("blur", () => el.classList.remove(styles.ctrlHeld));
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        document: false,
        paragraph: false,
        text: false,
      }),
      Document,
      Paragraph.extend({
        addProseMirrorPlugins() {
          return [];
        },
      }),
      Text.extend({
        addProseMirrorPlugins() {
          return [];
        },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        defaultProtocol: "https",
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      ListBackspace,
      CleanTrailingEmpty,
    ],
    editorProps: {
      handleDOMEvents: {
        click: (_view, event) => {
          const anchor = (event.target as HTMLElement).closest("a");
          if (!anchor) return false;
          event.preventDefault();
          if (event.ctrlKey || event.metaKey) {
            const href = anchor.getAttribute("href");
            if (href) openUrl(href);
          }
          return false;
        },
      },
      clipboardTextSerializer: (slice) => {
        const text: string[] = [];
        slice.content.forEach((node) => {
          if (node.type.name === 'paragraph') {
            text.push(node.textContent);
          } else if (node.type.name === 'heading') {
            text.push(node.textContent);
          } else if (node.type.name === 'bulletList' || node.type.name === 'orderedList') {
            node.forEach((listItem) => {
              text.push(listItem.textContent);
            });
          } else if (node.type.name === 'taskList') {
            node.forEach((taskItem) => {
              text.push(taskItem.textContent);
            });
          } else {
            text.push(node.textContent);
          }
        });
        return text.join('\n');
      },
    },
    content: tryParseJSON(initialContent),
    onUpdate: ({ editor }) => {
      onChange(JSON.stringify(editor.getJSON()));
    },
    onCreate: ({ editor }) => {
      onEditorReady?.(editor);
    },
  });

  return (
    <div ref={wrapperRef} className={styles.editor}>
      <EditorContent
        editor={editor}
        className={styles.editorContent}
        style={{ '--editor-font-size': `${fontSize}px` } as CSSProperties}
      />
    </div>
  );
}

function tryParseJSON(str: string) {
  if (!str) return "<p></p>";
  try {
    return JSON.parse(str);
  } catch {
    return str || "<p></p>";
  }
}
