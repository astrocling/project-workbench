export default function RootLoading() {
  return (
    <div className="min-h-screen bg-surface-50 dark:bg-dark-bg flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 border-2 border-jblue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-body-sm text-surface-500 dark:text-surface-400">Loading…</p>
      </div>
    </div>
  );
}
