'use client';

import { Download, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { IfRole } from '@/components/shared/IfRole';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { deleteMenuItem, getMenuItems, toggleMenuItemActive } from '@/lib/actions/menu-items';
import { getRecipes } from '@/lib/actions/recipes';

import { DeleteMenuItemDialog } from './DeleteMenuItemDialog';
import { LinkRecipePopover } from './LinkRecipePopover';
import { MenuItemDrawer } from './MenuItemDrawer';

import type { Role } from '@/lib/permissions';
import type { MenuItem, Recipe } from '@/lib/types';

const CATEGORY_TABS: Array<{ value: 'all' | string; label: string }> = [
  { value: 'all', label: 'הכל' },
  { value: 'appetizer', label: 'מנות ראשונות' },
  { value: 'main', label: 'עיקריות' },
  { value: 'dessert', label: 'קינוחים' },
  { value: 'drink', label: 'שתייה' },
  { value: 'side', label: 'תוספות' },
  { value: 'special', label: 'מיוחד' },
];

const CATEGORY_LABEL: Record<string, string> = {
  appetizer: 'מנה ראשונה',
  main: 'עיקרית',
  dessert: 'קינוח',
  drink: 'שתייה',
  side: 'תוסף',
  special: 'מיוחד',
};

function formatPrice(cents: number) {
  return `${(cents / 100).toFixed(2)} ₪`;
}

interface Props {
  tenantId: string;
  tenantSlug: string;
  userRole: Role | null;
  initialItems: MenuItem[];
  initialError: string | null;
}

export function MenuClient({ tenantId, userRole, initialItems, initialError }: Props) {
  const [items, setItems] = useState<MenuItem[]>(initialItems);
  const [error, setError] = useState<string | null>(initialError);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<MenuItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<MenuItem | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [recipeMap, setRecipeMap] = useState<Map<string, Recipe>>(new Map());
  const [, startTransition] = useTransition();
  const [refreshing, setRefreshing] = useState(false);

  // Load menu recipes for showing names of linked recipes
  useEffect(() => {
    let cancelled = false;
    getRecipes(tenantId, 'menu')
      .then((rs) => {
        if (cancelled) return;
        const m = new Map<string, Recipe>();
        rs.forEach((r) => m.set(r.id, r));
        setRecipeMap(m);
      })
      .catch(() => {
        // silent; popover will retry on its own
      });
    return () => {
      cancelled = true;
    };
  }, [tenantId]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (category !== 'all' && it.category !== category) return false;
      if (!q) return true;
      return it.nameHe.toLowerCase().includes(q) || (it.nameEn?.toLowerCase().includes(q) ?? false);
    });
  }, [items, search, category]);

  function upsertItem(item: MenuItem) {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === item.id);
      if (idx === -1) return [...prev, item];
      const next = [...prev];
      next[idx] = { ...next[idx], ...item };
      return next;
    });
  }

  function handleToggleActive(item: MenuItem) {
    const previous = item.active;
    // optimistic
    upsertItem({ ...item, active: !previous });
    startTransition(async () => {
      try {
        const updated = await toggleMenuItemActive(tenantId, item.id);
        upsertItem(updated);
      } catch (err) {
        upsertItem({ ...item, active: previous });
        toast.error(err instanceof Error ? err.message : 'שגיאה בעדכון סטטוס');
      }
    });
  }

  function handleDelete() {
    if (!deletingItem) return;
    const target = deletingItem;
    const snapshot = items;
    // optimistic remove
    setItems((prev) => prev.filter((i) => i.id !== target.id));
    setDeleteBusy(true);
    deleteMenuItem(tenantId, target.id)
      .then(() => {
        toast.success('הפריט נמחק');
        setDeletingItem(null);
      })
      .catch((err) => {
        setItems(snapshot);
        toast.error(err instanceof Error ? err.message : 'שגיאה במחיקה');
      })
      .finally(() => setDeleteBusy(false));
  }

  function handleExportCsv() {
    const rows = [
      ['שם', 'קטגוריה', 'מחיר', 'מזהה-POS'],
      ...filtered.map((i) => [
        i.nameHe,
        CATEGORY_LABEL[i.category] ?? i.category,
        (i.priceCents / 100).toFixed(2),
        i.posExternalId ?? '',
      ]),
    ];
    const csv = rows
      .map((r) =>
        r
          .map((cell) => {
            const s = String(cell);
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(','),
      )
      .join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `menu-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleRetry() {
    setRefreshing(true);
    setError(null);
    getMenuItems(tenantId)
      .then((next) => setItems(next))
      .catch((err) => setError(err instanceof Error ? err.message : 'unknown'))
      .finally(() => setRefreshing(false));
  }

  function openNew() {
    setEditing(null);
    setDrawerOpen(true);
  }

  function openEdit(item: MenuItem) {
    setEditing(item);
    setDrawerOpen(true);
  }

  const headerActions = (
    <IfRole userRole={userRole} roles={['owner', 'manager']}>
      <Button variant="outline" onClick={handleExportCsv} disabled={items.length === 0}>
        <Download className="ml-2 h-4 w-4" />
        ייצא CSV
      </Button>
      <Button onClick={openNew}>
        <Plus className="ml-2 h-4 w-4" />
        הוסף פריט
      </Button>
    </IfRole>
  );

  return (
    <div dir="rtl">
      <PageHeader title="תפריט" actions={headerActions} />

      <div className="relative mb-4">
        <Search className="text-muted-foreground absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חיפוש פריט..."
          className="pr-9 text-right"
          dir="rtl"
        />
      </div>

      <Tabs value={category} onValueChange={setCategory} className="mb-4" dir="rtl">
        <TabsList className="flex flex-wrap">
          {CATEGORY_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {error ? (
        <div className="border-destructive/40 bg-destructive/5 rounded-md border p-6 text-center">
          <p className="text-destructive mb-3 text-sm">שגיאה בטעינת התפריט. נסה שוב.</p>
          <Button variant="outline" onClick={handleRetry} disabled={refreshing}>
            נסה שוב
          </Button>
        </div>
      ) : refreshing ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-md border p-10 text-center">
          <p className="text-muted-foreground mb-4">אין פריטי תפריט עדיין</p>
          <IfRole userRole={userRole} roles={['owner', 'manager']}>
            <Button onClick={openNew}>
              <Plus className="ml-2 h-4 w-4" />
              הוסף פריט ראשון
            </Button>
          </IfRole>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">שם מנה</TableHead>
                <TableHead className="text-right">קטגוריה</TableHead>
                <TableHead className="text-right">מחיר</TableHead>
                <TableHead className="text-right">מתכון מקושר</TableHead>
                <TableHead className="text-right">פעיל</TableHead>
                <TableHead className="text-right">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
                    לא נמצאו פריטים תואמים
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((item) => {
                  const linkedName = item.recipeId ? recipeMap.get(item.recipeId)?.nameHe : null;
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="text-right">
                        <div className="font-medium">{item.nameHe}</div>
                        {item.nameEn && (
                          <div className="text-muted-foreground text-xs">{item.nameEn}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {CATEGORY_LABEL[item.category] ?? item.category}
                      </TableCell>
                      <TableCell className="text-right">{formatPrice(item.priceCents)}</TableCell>
                      <TableCell className="text-right">
                        <IfRole
                          userRole={userRole}
                          roles={['owner', 'manager']}
                          fallback={
                            <span className="text-muted-foreground text-sm">
                              {linkedName ?? '—'}
                            </span>
                          }
                        >
                          <LinkRecipePopover
                            tenantId={tenantId}
                            item={item}
                            linkedRecipeName={linkedName}
                            onLinked={upsertItem}
                          />
                        </IfRole>
                      </TableCell>
                      <TableCell className="text-right">
                        <IfRole
                          userRole={userRole}
                          roles={['owner', 'manager']}
                          fallback={
                            <span className="text-muted-foreground text-xs">
                              {item.active ? 'פעיל' : 'לא פעיל'}
                            </span>
                          }
                        >
                          <Switch
                            checked={item.active}
                            onCheckedChange={() => handleToggleActive(item)}
                            aria-label="פעיל"
                          />
                        </IfRole>
                      </TableCell>
                      <TableCell className="text-right">
                        <IfRole userRole={userRole} roles={['owner', 'manager']}>
                          <div className="flex flex-row-reverse items-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openEdit(item)}
                              aria-label="ערוך"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDeletingItem(item)}
                              aria-label="מחק"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </IfRole>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <MenuItemDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        tenantId={tenantId}
        editing={editing}
        onSaved={upsertItem}
      />

      <DeleteMenuItemDialog
        open={!!deletingItem}
        onOpenChange={(o) => !o && setDeletingItem(null)}
        itemName={deletingItem?.nameHe ?? ''}
        onConfirm={handleDelete}
        busy={deleteBusy}
      />
    </div>
  );
}
