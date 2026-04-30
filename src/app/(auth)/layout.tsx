import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'כניסה — Restaurant OS',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 text-center">
          <span className="text-2xl font-bold tracking-tight">🍽️ Restaurant OS</span>
          <p className="text-muted-foreground mt-1 text-sm">מערכת הפעלה למסעדות</p>
        </div>
        <div className="bg-card rounded-xl border p-8 shadow-sm">{children}</div>
      </div>
    </div>
  );
}
