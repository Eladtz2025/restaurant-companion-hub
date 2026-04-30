'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useTenant } from '@/contexts/TenantContext';
import { createBrowserSupabaseClient } from '@/lib/supabase/browser';

type TenantOption = { id: string; slug: string; name: string };

export function TenantSwitcher() {
  const { tenantSlug, tenantName, tenantId } = useTenant();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [loading, setLoading] = useState(false);

  async function handleOpen() {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    setLoading(true);
    const supabase = createBrowserSupabaseClient();
    const { data: memberships } = await supabase
      .from('memberships')
      .select('tenants(id, slug, name)')
      .limit(20);

    const list: TenantOption[] = [];
    for (const m of memberships ?? []) {
      const t = m.tenants as unknown as { id: string; slug: string; name: string } | null;
      if (t) list.push({ id: t.id, slug: t.slug, name: t.name });
    }
    setTenants(list);
    setLoading(false);
  }

  return (
    <div className="relative">
      <button
        onClick={handleOpen}
        className="hover:bg-accent flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium"
      >
        <span className="max-w-[120px] truncate">{tenantName}</span>
        <svg
          className="h-3.5 w-3.5 opacity-60"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="bg-popover absolute end-0 top-full z-20 mt-1 min-w-[160px] rounded-md border p-1 shadow-md">
            {loading && <p className="text-muted-foreground px-3 py-2 text-xs">טוען...</p>}
            {!loading && tenants.length === 0 && (
              <p className="text-muted-foreground px-3 py-2 text-xs">אין מסעדות נוספות</p>
            )}
            {tenants.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setOpen(false);
                  if (t.slug !== tenantSlug) router.push(`/${t.slug}`);
                }}
                className={`hover:bg-accent flex w-full items-center gap-2 rounded px-3 py-2 text-sm ${
                  t.id === tenantId ? 'font-semibold' : ''
                }`}
              >
                {t.name}
                {t.id === tenantId && (
                  <svg className="ms-auto h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
