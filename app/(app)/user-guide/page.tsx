import { readFileSync } from "fs";
import { join } from "path";
import { MarkdownDoc } from "@/components/MarkdownDoc";
import { UserGuideNav } from "@/components/UserGuideNav";
import { extractMarkdownH2Sections } from "@/lib/markdownHeadings";
import { CONFLUENCE_USER_GUIDE_URL } from "@/lib/userGuide";

export const metadata = {
  title: "User Guide",
  description: "How to use Project Workbench",
};

export default function UserGuidePage() {
  const content = readFileSync(join(process.cwd(), "docs/USER_GUIDE.md"), "utf-8");
  const sections = extractMarkdownH2Sections(content);

  return (
    <div className="md:grid md:grid-cols-[minmax(0,1fr)_15rem] md:items-start md:gap-10">
      <div>
        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-display-md font-bold text-surface-900 dark:text-white">User Guide</h2>
            <p className="mt-1 text-body-sm text-surface-600 dark:text-surface-400">
              In-app guide for this release. Additional FFW Agency resources live on Confluence.
            </p>
          </div>
          <a
            href={CONFLUENCE_USER_GUIDE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-md border border-surface-200 bg-white px-3 py-2 text-body-sm font-medium text-jblue-500 hover:bg-surface-100 dark:border-dark-border dark:bg-dark-raised dark:text-jblue-400 dark:hover:bg-dark-muted"
          >
            Additional resources on Confluence
          </a>
        </div>
        <UserGuideNav sections={sections} variant="jump" />
        <MarkdownDoc content={content} hideH1 />
      </div>
      <aside className="sticky top-20 hidden max-h-[calc(100vh-6rem)] overflow-y-auto md:block">
        <UserGuideNav sections={sections} variant="toc" />
      </aside>
    </div>
  );
}
