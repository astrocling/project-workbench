import Link from "next/link";
import { APP_VERSION } from "@/lib/version";

export function AppFooter() {
  return (
    <footer className="py-3 text-center">
      <span className="text-body-sm text-surface-500 dark:text-surface-400">
        Project Workbench v{APP_VERSION}
      </span>
      <span className="text-body-sm text-surface-500 dark:text-surface-400 mx-2">·</span>
      <Link
        href="/user-guide"
        className="text-body-sm text-jblue-500 dark:text-jblue-400 hover:text-jblue-700 dark:hover:text-jblue-200 font-medium"
      >
        User Guide
      </Link>
      <span className="text-body-sm text-surface-500 dark:text-surface-400 mx-2">·</span>
      <Link
        href="/changelog"
        className="text-body-sm text-jblue-500 dark:text-jblue-400 hover:text-jblue-700 dark:hover:text-jblue-200 font-medium"
      >
        Changelog
      </Link>
    </footer>
  );
}
