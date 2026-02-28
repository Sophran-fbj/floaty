import type { CSSProperties } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { Extension } from "@tiptap/core";
import type { Editor } from "@tiptap/react";
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
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TaskList,
      TaskItem.configure({ nested: true }),
      ListBackspace,
      CleanTrailingEmpty,
    ],
    content: tryParseJSON(initialContent),
    onUpdate: ({ editor }) => {
      onChange(JSON.stringify(editor.getJSON()));
    },
    onCreate: ({ editor }) => {
      onEditorReady?.(editor);
    },
  });

  return (
    <div className={styles.editor}>
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
