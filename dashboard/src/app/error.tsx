'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    const errorIcon = '/favicon.ico';
    const defaultIcon = '/icon-default.svg';
    const linkEl =
      (document.querySelector("link[rel~='icon']") as HTMLLinkElement | null) ||
      (document.createElement('link') as HTMLLinkElement);

    const previousHref = linkEl.href;
    linkEl.rel = 'icon';
    linkEl.href = errorIcon;
    if (!linkEl.parentNode) {
      document.head.appendChild(linkEl);
    }

    return () => {
      linkEl.href = previousHref || defaultIcon;
    };
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-surface border border-divider rounded-2xl p-6 shadow-lg space-y-4">
        <div>
          <p className="text-lg font-semibold">Something went wrong.</p>
          {error?.message && (
            <p className="text-default-500 text-sm mt-1 break-words">{error.message}</p>
          )}
        </div>
        <button
          onClick={reset}
          className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-primary text-white font-semibold hover:opacity-90 transition"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
