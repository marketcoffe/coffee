import { lazy, type ComponentType } from 'react';

/**
 * Wrapper around React.lazy that retries loading a chunk on failure.
 * Handles transient network errors and stale chunk caching in production.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  retries = 2,
  delay = 1000
): React.LazyExoticComponent<T> {
  return lazy(() => {
    return new Promise<{ default: T }>((resolve, reject) => {
      const attempt = (remaining: number) => {
        factory()
          .then(resolve)
          .catch((error) => {
            if (remaining > 0) {
              setTimeout(() => attempt(remaining - 1), delay);
            } else {
              reject(error);
            }
          });
      };
      attempt(retries);
    });
  });
}
