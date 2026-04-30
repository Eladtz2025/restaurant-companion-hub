'use client';

import { LogOut, Menu } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { createBrowserSupabaseClient } from '@/lib/supabase/browser';

import { TenantSwitcher } from './TenantSwitcher';

type Props = {
  pageTitle?: string;
  onMenuClick: () => void;
};

export function Topbar({ pageTitle, onMenuClick }: Props) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  }

  return (
    <header className="bg-card flex h-14 shrink-0 items-center justify-between border-b px-4">
      {/* Right side (RTL visual start): hamburger + tenant switcher */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="hover:bg-accent rounded-md p-1.5 md:hidden"
          aria-label="פתח תפריט"
        >
          <Menu className="h-5 w-5" />
        </button>
        <TenantSwitcher />
      </div>

      {/* Center: page title */}
      {pageTitle && (
        <h1 className="absolute start-1/2 -translate-x-1/2 text-sm font-semibold md:text-base">
          {pageTitle}
        </h1>
      )}

      {/* Left side (RTL visual end): logout */}
      <button
        onClick={handleLogout}
        className="text-muted-foreground hover:bg-accent hover:text-foreground flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm"
        aria-label="התנתקות"
      >
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:inline">יציאה</span>
      </button>
    </header>
  );
}
