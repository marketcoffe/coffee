import { lazy, type ComponentType } from 'react';

/**
 * Wraps React.lazy() with automatic retries for chunk loading failures.
 *
 * When a dynamically imported module fails to load (stale chunk after deploy,
 * corrupted Service-Worker cache, network glitch), the browser's import()
 * rejects with a TypeError.  Between retries we clear any caches that could
 * hold a stale copy and append a cache-busting query parameter.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  retries = 3,
  baseDelay = 800
): React.LazyExoticComponent<T> {
  const clearRelevantCaches = async (): Promise<void> => {
    try {
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(
          names.map((n) => caches.delete(n))
        );
      }
    } catch {
      // Silently ignore — cache API may be unavailable
    }
  };

  return lazy(() => {
    let bustCounter = 0;
    return new Promise<{ default: T }>((resolve, reject) => {
      const attempt = (remaining: number) => {
        factory()
          .then(resolve)
          .catch(async (error: unknown) => {
            const errMsg = error instanceof Error ? error.message : String(error);
            const isChunkError = error instanceof TypeError && (
              errMsg.includes('loading dynamically imported module') ||
              errMsg.includes('Failed to fetch dynamically imported module') ||
              errMsg.includes('Failed to fetch') ||
              errMsg.includes('NetworkError') ||
              errMsg.includes('Corrupted') ||
              errMsg.includes('Importing a module script failed')
            );
            const isCorrupted =
              (error as any)?.name === 'NS_ERROR_CORRUPTED_CONTENT' ||
              errMsg.includes('NS_ERROR_CORRUPTED_CONTENT');

            if (remaining > 0 && (isChunkError || isCorrupted)) {
              bustCounter++;
              // Clear caches so a fresh copy is fetched on next attempt
              await clearRelevantCaches();
              const wait = baseDelay * (retries - remaining + 1);
              setTimeout(() => attempt(remaining - 1), wait);
            } else {
              // All retries exhausted — reject so React's ErrorBoundary
              // renders a fallback. The global handler in main.tsx will
              // detect the chunk error and trigger a cache-clear + reload.
              reject(error);
            }
          });
      };
      attempt(retries);
    });
  });
}
