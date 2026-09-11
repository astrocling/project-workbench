import type { ReactNode } from "react";
import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { createHeadingSlugTracker } from "@/lib/markdownHeadings";

function flattenMarkdownText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenMarkdownText).join("");
  if (typeof node === "object" && node !== null && "props" in node) {
    return flattenMarkdownText((node as { props: { children?: ReactNode } }).props.children);
  }
  return "";
}

const headingClass = {
  h1: "scroll-mt-20 text-display-md font-bold text-surface-900 dark:text-white mt-8 mb-4 first:mt-0",
  h2: "scroll-mt-20 text-title-lg font-semibold text-surface-800 dark:text-surface-100 mt-6 mb-3",
  h3: "scroll-mt-20 text-title-md font-semibold text-surface-800 dark:text-surface-100 mt-4 mb-2",
  h4: "scroll-mt-20 text-title-sm font-semibold text-surface-800 dark:text-surface-100 mt-3 mb-2",
} as const;

export function MarkdownDoc({
  content,
  hideH1 = false,
}: {
  content: string;
  hideH1?: boolean;
}) {
  const nextId = createHeadingSlugTracker();

  function heading(tag: keyof typeof headingClass): Components["h1"] {
    const Tag = tag;
    return function Heading({ children }) {
      const id = nextId(flattenMarkdownText(children));
      if (tag === "h1" && hideH1) return null;
      return (
        <Tag id={id} className={headingClass[tag]}>
          {children}
        </Tag>
      );
    };
  }

  const components: Components = {
    h1: heading("h1"),
    h2: heading("h2"),
    h3: heading("h3"),
    h4: heading("h4"),
    p: ({ children }) => (
      <p className="text-body-md text-surface-700 dark:text-surface-200 mb-3">{children}</p>
    ),
    ul: ({ children }) => (
      <ul className="mb-4 list-outside list-disc space-y-1 pl-6 text-body-md text-surface-700 dark:text-surface-200 [ul_&]:mb-2 [ul_&]:mt-1">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="mb-4 list-outside list-decimal space-y-1 pl-6 text-body-md text-surface-700 dark:text-surface-200 [ol_&]:mb-2 [ol_&]:mt-1">
        {children}
      </ol>
    ),
    li: ({ children }) => (
      <li className="pl-1 [&>p]:mb-1 [&>p:last-child]:mb-0">{children}</li>
    ),
    a: ({ href, children }) => {
      const external = href?.startsWith("http://") || href?.startsWith("https://");
      return (
        <a
          href={href}
          className="text-jblue-500 dark:text-jblue-400 hover:text-jblue-700 dark:hover:text-jblue-200 underline"
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {children}
        </a>
      );
    },
    strong: ({ children }) => (
      <strong className="font-semibold text-surface-900 dark:text-surface-100">{children}</strong>
    ),
    hr: () => <hr className="my-6 border-surface-200 dark:border-dark-border" />,
    code: ({ children }) => (
      <code className="rounded bg-surface-100 px-1 py-0.5 text-body-sm dark:bg-dark-muted">{children}</code>
    ),
    table: ({ children }) => (
      <div className="mb-4 overflow-x-auto">
        <table className="w-full border-collapse text-body-sm text-surface-700 dark:text-surface-200">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="border-b border-surface-200 bg-surface-100 dark:border-dark-border dark:bg-dark-raised">
        {children}
      </thead>
    ),
    th: ({ children }) => (
      <th className="px-3 py-2 text-left font-semibold text-surface-800 dark:text-surface-100">{children}</th>
    ),
    td: ({ children }) => (
      <td className="border-b border-surface-200 px-3 py-2 align-top dark:border-dark-border">{children}</td>
    ),
  };

  return (
    <article className="max-w-[72ch]">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </article>
  );
}
