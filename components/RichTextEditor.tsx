"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { useEffect, useCallback } from "react";

type RichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
};

function toEditorContent(value: string): string {
  if (!value) return "";
  if (value.startsWith("<")) return value;
  const escaped = value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<p>${escaped.replace(/\n/g, "<br>")}</p>`;
}

const toolbarButtonClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-md text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-dark-raised disabled:opacity-40 disabled:pointer-events-none transition-colors";

const toolbarButtonActiveClass =
  "bg-jblue-500/10 text-jblue-700 dark:text-jblue-400";

const editorClassName =
  "min-h-24 px-3 py-2 text-body-sm text-surface-800 dark:text-surface-100 focus:outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-1 [&_p]:my-1 [&_a]:text-jblue-600 [&_a]:underline dark:[&_a]:text-jblue-400";

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  className = "",
}: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        blockquote: false,
        code: false,
        codeBlock: false,
        heading: false,
        horizontalRule: false,
        orderedList: false,
        strike: false,
        italic: false,
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
      }),
    ],
    content: toEditorContent(value),
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
    editorProps: {
      attributes: {
        class: editorClassName,
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const next = toEditorContent(value);
    if (next !== current) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [editor, value]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Enter URL", previousUrl ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  }, [editor]);

  if (!editor) {
    return (
      <div
        className={`rounded-md border border-surface-300 dark:border-dark-muted bg-white dark:bg-dark-raised ${className}`}
      >
        <div className="min-h-24 px-3 py-2 text-body-sm text-surface-400 dark:text-surface-500">
          {placeholder}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`rounded-md border border-surface-300 dark:border-dark-muted bg-white dark:bg-dark-raised overflow-hidden ${className}`}
    >
      <div className="flex items-center gap-0.5 border-b border-surface-200 dark:border-dark-border px-2 py-1">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={!editor.can().chain().focus().toggleBold().run()}
          className={`${toolbarButtonClass} font-bold ${
            editor.isActive("bold") ? toolbarButtonActiveClass : ""
          }`}
          aria-label="Bold"
          title="Bold"
        >
          B
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`${toolbarButtonClass} ${
            editor.isActive("bulletList") ? toolbarButtonActiveClass : ""
          }`}
          aria-label="Bullet list"
          title="Bullet list"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <circle cx="4" cy="6" r="1" fill="currentColor" />
            <circle cx="4" cy="12" r="1" fill="currentColor" />
            <circle cx="4" cy="18" r="1" fill="currentColor" />
          </svg>
        </button>
        <button
          type="button"
          onClick={setLink}
          className={`${toolbarButtonClass} ${
            editor.isActive("link") ? toolbarButtonActiveClass : ""
          }`}
          aria-label="Link"
          title="Link"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
        </button>
      </div>
      <div className="relative">
        {placeholder && editor.isEmpty && (
          <p className="pointer-events-none absolute left-3 top-2 text-body-sm text-surface-400 dark:text-surface-500">
            {placeholder}
          </p>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
