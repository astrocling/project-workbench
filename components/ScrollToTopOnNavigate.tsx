"use client";

import { Suspense, useLayoutEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  navigationKey,
  resetWindowScroll,
  shouldResetWindowScroll,
} from "@/lib/scrollReset";

function ScrollToTopOnNavigateInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const previousKeyRef = useRef<string | null>(null);
  const isPopNavigationRef = useRef(false);

  useLayoutEffect(() => {
    const onPopState = () => {
      isPopNavigationRef.current = true;
    };
    window.addEventListener("popstate", onPopState, true);
    return () => window.removeEventListener("popstate", onPopState, true);
  }, []);

  const search = searchParams.toString();
  useLayoutEffect(() => {
    const nextKey = navigationKey(pathname, search);
    const shouldReset = shouldResetWindowScroll({
      previousKey: previousKeyRef.current,
      nextKey,
      isPopNavigation: isPopNavigationRef.current,
    });
    previousKeyRef.current = nextKey;
    isPopNavigationRef.current = false;
    if (!shouldReset) return;
    resetWindowScroll();
    // Next.js may apply layout scroll restoration after this effect.
    const frame = requestAnimationFrame(() => resetWindowScroll());
    return () => cancelAnimationFrame(frame);
  }, [pathname, search]);

  return null;
}

/** Scrolls the window to top on in-app PUSH navigations (not back/forward). */
export function ScrollToTopOnNavigate() {
  return (
    <Suspense fallback={null}>
      <ScrollToTopOnNavigateInner />
    </Suspense>
  );
}
