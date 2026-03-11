export default function AppLoading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 border-2 border-jblue-500 border-t-transparent rounded-full animate-spin" aria-hidden />
        <p className="text-body-sm text-surface-500 dark:text-surface-400">Loading…</p>
      </div>
    </div>
  );
}
