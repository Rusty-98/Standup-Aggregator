import React, { useEffect, useRef, useState } from 'react';
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

function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withProtocol);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    return null;
  }
}

export const TiptapEditor: React.FC<TiptapEditorProps> = ({
  value,
  onChange,
  onBlur,
  placeholder = 'Write update…',
  isTaskListDefault = false,
  disabled = false
}) => {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);

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
      editor.commands.setContent(
        value || (isTaskListDefault
          ? '<ul data-type="taskList"><li data-type="taskItem" data-checked="false"><p></p></li></ul>'
          : '<p></p>')
      );
    }
  }, [value, editor, isTaskListDefault]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(!disabled);
    }
  }, [disabled, editor]);

  useEffect(() => {
    if (linkOpen) {
      linkInputRef.current?.focus();
      linkInputRef.current?.select();
    }
  }, [linkOpen]);

  if (!editor) {
    return <div className="skeleton" style={{ height: 120, borderRadius: 'var(--radius-control)' }} aria-hidden />;
  }

  const openLinkPopover = () => {
    const previousUrl = editor.getAttributes('link').href || '';
    setLinkValue(previousUrl);
    setLinkError(null);
    setLinkOpen(true);
  };

  const applyLink = () => {
    const normalized = normalizeUrl(linkValue);
    if (normalized === null) {
      setLinkError('Enter a valid http(s) URL.');
      return;
    }
    if (normalized === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: normalized }).run();
    }
    setLinkOpen(false);
    setLinkError(null);
  };

  const toolBtn = (
    active: boolean,
    onClick: () => void,
    title: string,
    children: React.ReactNode
  ) => (
    <button
      type="button"
      onClick={onClick}
      className={`btn-compact ${active ? 'btn-primary' : 'btn-secondary'}`}
      style={{ height: '24px', width: '24px', padding: 0 }}
      title={title}
      aria-label={title}
      aria-pressed={active}
    >
      {children}
    </button>
  );

  return (
    <div
      style={{
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-control)',
        background: 'var(--canvas)',
        overflow: 'hidden',
        opacity: disabled ? 0.6 : 1,
        transition: 'border-color var(--motion)',
        position: 'relative'
      }}
      className="tiptap-container"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '2px',
          padding: '4px 8px',
          background: 'var(--surface-2)',
          borderBottom: '1px solid var(--border-default)'
        }}
        role="toolbar"
        aria-label="Formatting"
      >
        {toolBtn(editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), 'Bold (Ctrl+B)', <Bold size={13} />)}
        {toolBtn(editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), 'Italic (Ctrl+I)', <Italic size={13} />)}
        {toolBtn(editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), 'Bullet list', <List size={13} />)}
        {toolBtn(editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), 'Numbered list', <ListOrdered size={13} />)}
        {toolBtn(editor.isActive('taskList'), () => editor.chain().focus().toggleTaskList().run(), 'Task checklist', <CheckSquare size={13} />)}
        {toolBtn(editor.isActive('link'), openLinkPopover, 'Insert link', <Link2 size={13} />)}
      </div>

      {linkOpen && (
        <div
          className="link-popover"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: '10px 12px',
            borderBottom: '1px solid var(--border-default)',
            background: 'var(--surface-1)'
          }}
        >
          <label className="field" style={{ margin: 0 }}>
            <span className="field-label">Link URL</span>
            <input
              ref={linkInputRef}
              type="url"
              value={linkValue}
              onChange={e => {
                setLinkValue(e.target.value);
                setLinkError(null);
              }}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  applyLink();
                }
                if (e.key === 'Escape') {
                  e.preventDefault();
                  setLinkOpen(false);
                }
              }}
              placeholder="https://…"
              aria-invalid={!!linkError}
            />
            {linkError && <span className="field-error">{linkError}</span>}
          </label>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn-secondary btn-compact" onClick={() => setLinkOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn-primary btn-compact" onClick={applyLink}>
              Apply
            </button>
          </div>
        </div>
      )}

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
