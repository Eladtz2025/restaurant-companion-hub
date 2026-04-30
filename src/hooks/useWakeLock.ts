'use client';

import { useEffect, useRef } from 'react';

/**
 * Acquires a Wake Lock to prevent the screen from sleeping.
 * Releases on unmount or when the page loses visibility.
 * No-ops gracefully in browsers that don't support the Wake Lock API.
 */
export function useWakeLock() {
  const lockRef = useRef<WakeLockSentinel | null>(null);

  async function acquire() {
    if (!('wakeLock' in navigator)) return;
    try {
      lockRef.current = await navigator.wakeLock.request('screen');
    } catch {
      // Denied (e.g. low battery) — silently ignore.
    }
  }

  function release() {
    lockRef.current?.release().catch(() => {});
    lockRef.current = null;
  }

  useEffect(() => {
    acquire();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        release();
      } else {
        acquire();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      release();
    };
  }, []);
}
