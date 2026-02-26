export default function ProjectsLoading() {
  return (
    <div className="min-h-screen bg-surface-50 dark:bg-dark-bg">
      <header className="sticky top-0 z-30 h-14 flex items-center justify-between px-6 bg-white/80 dark:bg-dark-bg/90 backdrop-blur-md border-b border-surface-200 dark:border-dark-border">
        <div className="h-6 w-48 bg-surface-200 dark:bg-dark-raised rounded animate-pulse" />
        <div className="flex gap-4 items-center">
          <div className="h-4 w-24 bg-surface-200 dark:bg-dark-raised rounded animate-pulse" />
          <div className="h-8 w-8 bg-surface-200 dark:bg-dark-raised rounded-md animate-pulse" />
          <div className="h-4 w-12 bg-surface-200 dark:bg-dark-raised rounded animate-pulse" />
          <div className="h-4 w-14 bg-surface-200 dark:bg-dark-raised rounded animate-pulse" />
        </div>
      </header>

      <main className="px-8 py-6 max-w-[1440px] mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="h-8 w-28 bg-surface-200 dark:bg-dark-raised rounded animate-pulse" />
          <div className="h-9 w-28 bg-surface-200 dark:bg-dark-raised rounded-md animate-pulse" />
        </div>

        <nav className="flex gap-1 mb-4" aria-hidden>
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-9 w-24 bg-surface-200 dark:bg-dark-raised rounded-md animate-pulse"
            />
          ))}
        </nav>

        <div className="h-4 w-56 bg-surface-200 dark:bg-dark-raised rounded animate-pulse mb-4" />

        <div className="bg-white dark:bg-dark-surface rounded-lg border border-surface-200 dark:border-dark-border overflow-hidden shadow-card-light dark:shadow-card-dark">
          <table className="w-full text-body-sm border-collapse">
            <thead>
              <tr className="bg-surface-50 dark:bg-dark-raised border-b border-surface-200 dark:border-dark-border">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <th key={i} className="text-left px-4 py-3">
                    <div className="h-4 w-16 bg-surface-200 dark:bg-dark-border rounded animate-pulse" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <tr
                  key={i}
                  className="border-b border-surface-100 dark:border-dark-border/60 last:border-0"
                >
                  <td className="px-4 py-3">
                    <div className="h-4 w-32 bg-surface-100 dark:bg-dark-raised rounded animate-pulse" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-4 w-24 bg-surface-100 dark:bg-dark-raised rounded animate-pulse" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-4 w-14 bg-surface-100 dark:bg-dark-raised rounded animate-pulse" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-4 w-20 bg-surface-100 dark:bg-dark-raised rounded animate-pulse" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-4 w-16 bg-surface-100 dark:bg-dark-raised rounded animate-pulse" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-4 w-12 bg-surface-100 dark:bg-dark-raised rounded animate-pulse" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
