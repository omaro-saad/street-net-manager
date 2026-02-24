/**
 * Keeps loading UI visible for at least minMs so fast fetches (e.g. cache) don't flash.
 * Returns a boolean: true when we should show loading (either still loading or within min delay after fetch).
 */
import { useEffect, useRef, useState } from "react";

const DEFAULT_MIN_MS = 1000;

export function useMinLoadingTime(loading, minMs = DEFAULT_MIN_MS) {
  const [displayLoading, setDisplayLoading] = useState(!!loading);
  const startRef = useRef(null);

  useEffect(() => {
    if (loading) {
      startRef.current = Date.now();
      setDisplayLoading(true);
      return;
    }
    if (!loading && startRef.current !== null) {
      const elapsed = Date.now() - startRef.current;
      const remain = Math.max(0, minMs - elapsed);
      const id = setTimeout(() => {
        setDisplayLoading(false);
        startRef.current = null;
      }, remain);
      return () => clearTimeout(id);
    }
  }, [loading, minMs]);

  return displayLoading;
}
