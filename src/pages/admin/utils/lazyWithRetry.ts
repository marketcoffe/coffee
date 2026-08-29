import { lazy, type ComponentType } from 'react';

export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  retries = 3,
  delay = 1000
): React.LazyExoticComponent<T> {
  return lazy(() => {
    return new Promise<{ default: T }>((resolve, reject) => {
      const attempt = (remaining: number) => {
        factory()
          .then(resolve)
          .catch((error) => {
            const isNetworkError = error instanceof TypeError && (
              error.message.includes('loading dynamically imported module') ||
              error.message.includes('Failed to fetch') ||
              error.message.includes('NetworkError') ||
              error.message.includes('corrupted')
            );
            const isCorruptedContent = error.name === 'NS_ERROR_CORRUPTED_CONTENT' ||
              error.message.includes('NS_ERROR_CORRUPTED_CONTENT');
            
            if (remaining > 0 && (isNetworkError || isCorruptedContent)) {
              setTimeout(() => attempt(remaining - 1), delay * (3 - remaining + 1));
            } else {
              reject(error);
            }
          });
      };
      attempt(retries);
    });
  });
}
