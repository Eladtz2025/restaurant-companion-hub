'use client';

import { useState } from 'react';

import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

import type { Role } from '@/lib/permissions';

type Props = {
  tenantSlug: string;
  userRole: Role;
  children: React.ReactNode;
};

export function AppShell({ tenantSlug, userRole, children }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="bg-background flex h-screen overflow-hidden">
      <Sidebar
        tenantSlug={tenantSlug}
        userRole={userRole}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
        onToggleCollapse={() => setCollapsed((c) => !c)}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
