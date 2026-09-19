import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { Bold, Italic, List, ListOrdered, CheckSquare, Link2 } from 'lucide-react';

interface TiptapEditorProps {
  value: string;
  onChange: (html: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  isTaskListDefault?: boolean;
  disabled?: boolean;
}

export const TiptapEditor: React.FC<TiptapEditorProps> = ({
  value,
  onChange,
  onBlur,
  placeholder = 'Write update…',
  isTaskListDefault = false,
  disabled = false
}) => {
  const editor = useEditor({
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        dropcursor: false
      }),
      TaskList,
      TaskItem.configure({
        nested: true
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: 'noopener noreferrer nofollow',
          target: '_blank'
        }
      }),
      Placeholder.configure({
        placeholder
      })
    ],
    content: value || (isTaskListDefault ? '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul>' : '<p></p>'),
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onBlur: () => {
      if (onBlur) onBlur();
    }
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML() && !editor.isFocused) {
      editor.commands.setContent(value || '<p></p>');
    }
  }, [value, editor]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled);
    }
  }, [disabled, editor]);

  if (!editor) return null;

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div
      style={{
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-control)',
        background: 'var(--canvas)',
        overflow: 'hidden',
        opacity: disabled ? 0.6 : 1,
        transition: 'border-color 0.1s ease'
      }}
      className="tiptap-container"
    >
      {/* 5-button minimal toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '2px',
          padding: '4px 8px',
          background: 'var(--surface-2)',
          borderBottom: '1px solid var(--border-default)'
        }}
      >
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`btn-compact ${editor.isActive('bold') ? 'btn-primary' : 'btn-secondary'}`}
          style={{ height: '24px', width: '24px', padding: 0 }}
          title="Bold (Ctrl+B)"
        >
          <Bold size={13} />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`btn-compact ${editor.isActive('italic') ? 'btn-primary' : 'btn-secondary'}`}
          style={{ height: '24px', width: '24px', padding: 0 }}
          title="Italic (Ctrl+I)"
        >
          <Italic size={13} />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`btn-compact ${editor.isActive('bulletList') ? 'btn-primary' : 'btn-secondary'}`}
          style={{ height: '24px', width: '24px', padding: 0 }}
          title="Bullet list (- )"
        >
          <List size={13} />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`btn-compact ${editor.isActive('orderedList') ? 'btn-primary' : 'btn-secondary'}`}
          style={{ height: '24px', width: '24px', padding: 0 }}
          title="Numbered list (1. )"
        >
          <ListOrdered size={13} />
        </button>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          className={`btn-compact ${editor.isActive('taskList') ? 'btn-primary' : 'btn-secondary'}`}
          style={{ height: '24px', width: '24px', padding: 0 }}
          title="Task item checklist"
        >
          <CheckSquare size={13} />
        </button>

        <button
          type="button"
          onClick={setLink}
          className={`btn-compact ${editor.isActive('link') ? 'btn-primary' : 'btn-secondary'}`}
          style={{ height: '24px', width: '24px', padding: 0 }}
          title="Insert link"
        >
          <Link2 size={13} />
        </button>
      </div>

      <div style={{ padding: '10px 12px', minHeight: '90px' }}>
        <EditorContent editor={editor} />
      </div>

      <style>{`
        .ProseMirror {
          outline: none;
          min-height: 70px;
          font-family: var(--font-sans);
          font-size: 13.5px;
          line-height: 1.55;
          color: var(--text-primary);
        }
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: var(--text-muted);
          pointer-events: none;
          height: 0;
        }
        .ProseMirror ul, .ProseMirror ol {
          padding-left: 20px;
          margin: 4px 0;
        }
        .ProseMirror ul[data-type="taskList"] {
          list-style: none;
          padding-left: 0;
          margin: 4px 0;
        }
        .ProseMirror ul[data-type="taskList"] li {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          margin: 4px 0;
        }
        .ProseMirror ul[data-type="taskList"] li > label {
          margin-top: 3px;
          cursor: pointer;
        }
        .ProseMirror ul[data-type="taskList"] li > div {
          flex: 1;
        }
        .ProseMirror strong {
          font-weight: 600;
          color: var(--text-primary);
        }
        .ProseMirror a {
          color: var(--accent);
          text-decoration: underline;
        }
        .tiptap-container:focus-within {
          border-color: var(--accent) !important;
        }
      `}</style>
    </div>
  );
};
