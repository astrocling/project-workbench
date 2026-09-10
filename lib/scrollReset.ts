/**
 * App Router keeps window scroll across client navigations when a shared layout
 * (e.g. AppShell) does not remount. Decide when to scroll to top.
 */

export function navigationKey(pathname: string, search: string): string {
  if (!search) return pathname;
  const query = search.startsWith("?") ? search : `?${search}`;
  return `${pathname}${query}`;
}

export function shouldResetWindowScroll({
  previousKey,
  nextKey,
  isPopNavigation,
}: {
  previousKey: string | null;
  nextKey: string;
  isPopNavigation: boolean;
}): boolean {
  if (previousKey === null) return false;
  if (isPopNavigation) return false;
  return previousKey !== nextKey;
}

export function resetWindowScroll(): void {
  window.scrollTo(0, 0);
}
