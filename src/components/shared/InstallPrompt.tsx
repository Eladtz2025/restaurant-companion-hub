'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'resto-visit-count';
const PROMPT_AFTER_VISITS = 3;

export function InstallPrompt() {
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    // Increment visit count.
    const count = Number(localStorage.getItem(STORAGE_KEY) ?? '0') + 1;
    localStorage.setItem(STORAGE_KEY, String(count));

    if (count < PROMPT_AFTER_VISITS) return;

    // Listen for the browser's install prompt.
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShow(true);
    };

    window.addEventListener('beforeinstallprompt', handler as EventListener);
    return () => window.removeEventListener('beforeinstallprompt', handler as EventListener);
  }, []);

  if (!show) return null;

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setShow(false);
  }

  return (
    <div className="bg-card fixed start-4 end-4 bottom-4 z-50 mx-auto max-w-sm rounded-xl border p-4 shadow-lg">
      <p className="text-sm font-medium">הוסף למסך הבית</p>
      <p className="text-muted-foreground mt-0.5 text-xs">
        התקן את האפליקציה לגישה מהירה ממסך הבית שלך
      </p>
      <div className="mt-3 flex gap-2">
        <button
          onClick={handleInstall}
          className="bg-primary text-primary-foreground flex-1 rounded-md px-3 py-1.5 text-sm font-medium"
        >
          התקן
        </button>
        <button onClick={() => setShow(false)} className="rounded-md border px-3 py-1.5 text-sm">
          אחר כך
        </button>
      </div>
    </div>
  );
}

// Extend Window type for beforeinstallprompt event.
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
