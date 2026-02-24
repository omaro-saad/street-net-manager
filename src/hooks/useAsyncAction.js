/**
 * Reusable hook for Create/Update/Delete/Upload/Download operations.
 * - Locks immediately on first click (prevents double submit).
 * - Enforces minimum loading display time (default 1s) for stable UX.
 * - Always unlocks on success or error.
 *
 * Usage:
 *   const { execute, isLoading, error, clearError } = useAsyncAction({ minLoadingMs: 1000 });
 *   const handleAdd = () => execute(async () => { await apiAdd(...); ... });
 *   <button disabled={isLoading} onClick={handleAdd}>Add</button>
 *   <LoadingOverlay visible={isLoading} />
 */
import { useCallback, useRef, useState } from "react";

const DEFAULT_MIN_MS = 1000;

export function useAsyncAction(options = {}) {
  const { minLoadingMs = DEFAULT_MIN_MS } = options;
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const inProgressRef = useRef(false);

  const execute = useCallback(
    async (asyncFn) => {
      if (typeof asyncFn !== "function") return undefined;
      if (inProgressRef.current) return undefined;

      inProgressRef.current = true;
      setIsLoading(true);
      setError(null);
      const start = Date.now();

      try {
        const result = await asyncFn();
        const elapsed = Date.now() - start;
        const remaining = Math.max(0, minLoadingMs - elapsed);
        if (remaining > 0) {
          await new Promise((r) => setTimeout(r, remaining));
        }
        return result;
      } catch (e) {
        const message = e?.message ?? String(e ?? "خطأ");
        setError(message);
        throw e;
      } finally {
        inProgressRef.current = false;
        setIsLoading(false);
      }
    },
    [minLoadingMs]
  );

  const clearError = useCallback(() => setError(null), []);

  return { execute, isLoading, error, clearError };
}
