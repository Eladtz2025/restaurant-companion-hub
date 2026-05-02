'use client';

import {
  ChefHat,
  CheckSquare,
  ClipboardList,
  Home,
  LayoutDashboard,
  Package,
  Settings,
  TrendingUp,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { hasRole } from '@/lib/permissions';

import type { Role } from '@/lib/permissions';

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  minRole: Role;
};

const NAV_ITEMS: NavItem[] = [
  { label: 'בית', href: '', icon: Home, minRole: 'staff' },
  { label: 'לוח בקרה', href: '/dashboard', icon: LayoutDashboard, minRole: 'manager' },
  { label: 'Prep List', href: '/prep', icon: ClipboardList, minRole: 'chef' },
  { label: 'צ׳קליסט', href: '/checklists', icon: CheckSquare, minRole: 'staff' },
  { label: 'מלאי', href: '/inventory', icon: Package, minRole: 'chef' },
  { label: 'תפריט ומתכונים', href: '/menu', icon: UtensilsCrossed, minRole: 'manager' },
  { label: 'ביצועי פלור', href: '/floor', icon: LayoutDashboard, minRole: 'manager' },
  { label: 'פיננסי', href: '/finance', icon: TrendingUp, minRole: 'manager' },
  { label: 'נהלים', href: '/procedures', icon: ChefHat, minRole: 'staff' },
  { label: 'הגדרות', href: '/settings', icon: Settings, minRole: 'manager' },
];

type Props = {
  tenantSlug: string;
  userRole: Role;
  collapsed: boolean;
  mobileOpen: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
};

export function Sidebar({
  tenantSlug,
  userRole,
  collapsed,
  mobileOpen,
  onClose,
  onToggleCollapse,
}: Props) {
  const pathname = usePathname();
  const base = `/${tenantSlug}`;

  const visibleItems = NAV_ITEMS.filter((item) => hasRole(userRole, item.minRole));

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 z-20 bg-black/50 md:hidden" onClick={onClose} />}

      {/* Sidebar panel */}
      <aside
        className={`bg-card fixed end-0 top-0 z-30 flex h-full flex-col border-s transition-all duration-200 md:relative md:z-auto md:translate-x-0 ${mobileOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'} ${collapsed ? 'w-12' : 'w-60'} `}
      >
        {/* Tenant name / close btn */}
        <div className="flex h-14 items-center justify-between border-b px-3">
          {!collapsed && <span className="truncate text-sm font-bold">{tenantSlug}</span>}
          <button
            onClick={onClose}
            className="hover:bg-accent rounded-md p-1.5 md:hidden"
            aria-label="סגור תפריט"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-2">
          {visibleItems.map((item) => {
            const href = `${base}${item.href}`;
            const isActive =
              item.href === '' ? pathname === base : pathname.startsWith(`${base}${item.href}`);

            return (
              <Link
                key={item.href}
                href={href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2 text-sm transition-colors ${isActive ? 'bg-accent text-accent-foreground font-semibold' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'} ${collapsed ? 'justify-center' : ''} `}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Collapse toggle (desktop only) */}
        <button
          onClick={onToggleCollapse}
          className="text-muted-foreground hover:bg-accent hidden items-center justify-center border-t p-3 md:flex"
          aria-label={collapsed ? 'הרחב תפריט' : 'צמצם תפריט'}
        >
          <svg
            className={`h-4 w-4 transition-transform ${collapsed ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </aside>
    </>
  );
}
