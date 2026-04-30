'use client';

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <span className="text-6xl" role="img" aria-label="אין חיבור">
        📡
      </span>
      <h1 className="text-2xl font-bold">אין חיבור לאינטרנט</h1>
      <p className="text-muted-foreground">בדוק את החיבור שלך ונסה שוב</p>
      <button
        onClick={() => window.location.reload()}
        className="bg-primary text-primary-foreground mt-2 rounded-md px-6 py-2 text-sm font-medium"
      >
        נסה שוב
      </button>
    </div>
  );
}
