'use client';

import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { IfRole } from '@/components/shared/IfRole';
import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  addChecklistItem,
  getChecklistCompletion,
  getChecklistWithItems,
  getChecklists,
  removeChecklistItem,
  updateChecklist,
} from '@/lib/actions/checklists';
import { hasRole } from '@/lib/permissions';

import { ChecklistCompletionSheet } from './ChecklistCompletionSheet';
import { ChecklistTemplateDrawer } from './ChecklistTemplateDrawer';

import type { Role } from '@/lib/permissions';
import type {
  Checklist,
  ChecklistCompletion,
  ChecklistItem,
  ShiftType,
} from '@/lib/types';

interface Props {
  tenantId: string;
  tenantSlug: string;
  userRole: Role | null;
  userId: string | null;
}

const SHIFT_TABS: Array<{ value: ShiftType; label: string }> = [
  { value: 'morning', label: 'בוקר' },
  { value: 'afternoon', label: 'צהריים' },
  { value: 'evening', label: 'ערב' },
  { value: 'night', label: 'לילה' },
];

const SHIFT_LABEL: Record<ShiftType, string> = {
  morning: 'בוקר',
  afternoon: 'צהריים',
  evening: 'ערב',
  night: 'לילה',
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function shiftDate(iso: string, days: number) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const dateFormatter = new Intl.DateTimeFormat('he-IL', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

function formatDateHe(iso: string) {
  return dateFormatter.format(new Date(iso + 'T00:00:00'));
}

export function ChecklistsClient({ tenantId, userRole, userId }: Props) {
  const isManager = hasRole(userRole, 'manager');

  const [tab, setTab] = useState<'daily' | 'templates'>('daily');

  // Daily state
  const [date, setDate] = useState<string>(todayISO());
  const [shift, setShift] = useState<ShiftType>('morning');
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [completions, setCompletions] = useState<Record<string, ChecklistCompletion | null>>({});
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({});
  const [loadingDaily, setLoadingDaily] = useState(true);
  const [errorDaily, setErrorDaily] = useState<string | null>(null);

  const [completionOpen, setCompletionOpen] = useState(false);
  const [activeChecklist, setActiveChecklist] = useState<Checklist | null>(null);

  // Templates state
  const [templates, setTemplates] = useState<Checklist[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [errorTemplates, setErrorTemplates] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [itemsById, setItemsById] = useState<Record<string, ChecklistItem[]>>({});
  const [newItemText, setNewItemText] = useState<Record<string, string>>({});

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingChecklist, setEditingChecklist] = useState<Checklist | null>(null);

  const loadDaily = useCallback(async () => {
    setLoadingDaily(true);
    setErrorDaily(null);
    try {
      const lists = await getChecklists(tenantId, shift);
      const detailed = await Promise.all(
        lists.map((c) =>
          Promise.all([
            getChecklistCompletion(tenantId, c.id, date),
            getChecklistWithItems(tenantId, c.id),
          ]),
        ),
      );
      const compMap: Record<string, ChecklistCompletion | null> = {};
      const countMap: Record<string, number> = {};
      lists.forEach((c, i) => {
        const detailEntry = detailed[i];
        if (!detailEntry) return;
        const [comp, withItems] = detailEntry;
        compMap[c.id] = comp;
        countMap[c.id] = withItems?.items.length ?? 0;
      });
      setChecklists(lists);
      setCompletions(compMap);
      setItemCounts(countMap);
    } catch (err) {
      setErrorDaily(err instanceof Error ? err.message : 'שגיאה לא ידועה');
    } finally {
      setLoadingDaily(false);
    }
  }, [tenantId, shift, date]);

  const loadTemplates = useCallback(async () => {
    setLoadingTemplates(true);
    setErrorTemplates(null);
    try {
      const lists = await getChecklists(tenantId);
      setTemplates(lists);
    } catch (err) {
      setErrorTemplates(err instanceof Error ? err.message : 'שגיאה לא ידועה');
    } finally {
      setLoadingTemplates(false);
    }
  }, [tenantId]);

  useEffect(() => {
    if (tab === 'daily') loadDaily();
  }, [tab, loadDaily]);

  useEffect(() => {
    if (tab === 'templates') loadTemplates();
  }, [tab, loadTemplates]);

  function handleOpenCompletion(c: Checklist) {
    setActiveChecklist(c);
    setCompletionOpen(true);
  }

  function handleCompletionSaved(comp: ChecklistCompletion) {
    setCompletions((prev) => ({ ...prev, [comp.checklistId]: comp }));
  }

  async function toggleExpand(c: Checklist) {
    const next = !expanded[c.id];
    setExpanded((prev) => ({ ...prev, [c.id]: next }));
    if (next && !itemsById[c.id]) {
      try {
        const detail = await getChecklistWithItems(tenantId, c.id);
        setItemsById((prev) => ({ ...prev, [c.id]: detail?.items ?? [] }));
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'שגיאה בטעינת סעיפים');
      }
    }
  }

  async function handleAddItem(c: Checklist) {
    const text = (newItemText[c.id] ?? '').trim();
    if (!text) return;
    try {
      const created = await addChecklistItem(tenantId, c.id, { text });
      setItemsById((prev) => ({
        ...prev,
        [c.id]: [...(prev[c.id] ?? []), created],
      }));
      setNewItemText((prev) => ({ ...prev, [c.id]: '' }));
      toast.success('סעיף נוסף');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'שגיאה בהוספה');
    }
  }

  async function handleRemoveItem(checklistId: string, itemId: string) {
    const prev = itemsById[checklistId] ?? [];
    setItemsById((s) => ({
      ...s,
      [checklistId]: prev.filter((i) => i.id !== itemId),
    }));
    try {
      await removeChecklistItem(tenantId, itemId);
    } catch (err) {
      setItemsById((s) => ({ ...s, [checklistId]: prev }));
      toast.error(err instanceof Error ? err.message : 'שגיאה במחיקה');
    }
  }

  async function handleDeleteChecklist(c: Checklist) {
    const prev = templates;
    setTemplates((s) => s.filter((x) => x.id !== c.id));
    try {
      await updateChecklist(tenantId, c.id, { active: false });
      toast.success('הרשימה הוסרה');
    } catch (err) {
      setTemplates(prev);
      toast.error(err instanceof Error ? err.message : 'שגיאה במחיקה');
    }
  }

  function handleTemplateSaved(saved: Checklist) {
    setTemplates((prev) => {
      const idx = prev.findIndex((c) => c.id === saved.id);
      if (idx === -1) return [...prev, saved];
      const copy = prev.slice();
      copy[idx] = saved;
      return copy;
    });
  }

  function statusBadge(c: Checklist) {
    const total = itemCounts[c.id] ?? 0;
    const completed = completions[c.id]?.completedItems.length ?? 0;
    let label = 'ממתין';
    let cls = 'bg-gray-100 text-gray-700 hover:bg-gray-100';
    if (total > 0 && completed >= total) {
      label = 'הושלם';
      cls = 'bg-green-100 text-green-800 hover:bg-green-100';
    } else if (completed > 0) {
      label = 'חלקי';
      cls = 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100';
    }
    return { label, cls, total, completed };
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="צ׳קליסטים" subtitle="ניהול ומילוי רשימות יומיות" />

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'daily' | 'templates')}>
        <TabsList>
          <TabsTrigger value="daily">מילוי יומי</TabsTrigger>
          {isManager && <TabsTrigger value="templates">ניהול תבניות</TabsTrigger>}
        </TabsList>

        {/* DAILY TAB */}
        <TabsContent value="daily" className="flex flex-col gap-4">
          <div className="flex items-center justify-center gap-3">
            <Button variant="outline" size="sm" onClick={() => setDate(shiftDate(date, -1))}>
              <ChevronRight className="h-4 w-4" />
              אתמול
            </Button>
            <div className="flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium">
              <Calendar className="h-4 w-4" />
              {formatDateHe(date)}
            </div>
            <Button variant="outline" size="sm" onClick={() => setDate(shiftDate(date, 1))}>
              מחר
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>

          <Tabs value={shift} onValueChange={(v) => setShift(v as ShiftType)}>
            <TabsList>
              {SHIFT_TABS.map((s) => (
                <TabsTrigger key={s.value} value={s.value}>
                  {s.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {loadingDaily && (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          )}

          {!loadingDaily && errorDaily && (
            <Card className="flex flex-col items-center gap-3 p-8 text-center">
              <p className="text-destructive text-sm">שגיאה בטעינה. נסה שוב.</p>
              <Button variant="outline" size="sm" onClick={loadDaily}>
                נסה שוב
              </Button>
            </Card>
          )}

          {!loadingDaily && !errorDaily && checklists.length === 0 && (
            <Card className="text-muted-foreground flex flex-col items-center gap-3 p-12 text-center">
              <ClipboardList className="h-10 w-10 opacity-60" />
              <p className="text-sm">אין רשימות למשמרת זו</p>
            </Card>
          )}

          {!loadingDaily &&
            !errorDaily &&
            checklists.map((c) => {
              const meta = statusBadge(c);
              const progressColor =
                meta.total > 0 && meta.completed >= meta.total
                  ? 'text-green-700'
                  : meta.completed > 0
                    ? 'text-yellow-700'
                    : 'text-gray-500';
              return (
                <Card key={c.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="flex items-center gap-3">
                    <ClipboardList className="text-muted-foreground h-5 w-5" />
                    <div>
                      <p className="font-medium">{c.name}</p>
                      <p className={`text-sm ${progressColor}`}>
                        {meta.completed}/{meta.total} סעיפים
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge className={meta.cls}>{meta.label}</Badge>
                    <Button size="sm" onClick={() => handleOpenCompletion(c)}>
                      פתח
                    </Button>
                  </div>
                </Card>
              );
            })}
        </TabsContent>

        {/* TEMPLATES TAB */}
        <IfRole userRole={userRole} roles={['owner', 'manager']}>
          <TabsContent value="templates" className="flex flex-col gap-4">
            <div className="flex justify-end">
              <Button
                onClick={() => {
                  setEditingChecklist(null);
                  setDrawerOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
                הוסף רשימה
              </Button>
            </div>

            {loadingTemplates && (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            )}

            {!loadingTemplates && errorTemplates && (
              <Card className="flex flex-col items-center gap-3 p-8 text-center">
                <p className="text-destructive text-sm">שגיאה בטעינה. נסה שוב.</p>
                <Button variant="outline" size="sm" onClick={loadTemplates}>
                  נסה שוב
                </Button>
              </Card>
            )}

            {!loadingTemplates && !errorTemplates && templates.length === 0 && (
              <Card className="text-muted-foreground flex flex-col items-center gap-3 p-12 text-center">
                <ClipboardList className="h-10 w-10 opacity-60" />
                <p className="text-sm">אין תבניות. הוסף רשימה חדשה.</p>
              </Card>
            )}

            {!loadingTemplates &&
              !errorTemplates &&
              templates.map((c) => {
                const isOpen = !!expanded[c.id];
                const items = itemsById[c.id] ?? [];
                return (
                  <Card key={c.id} className="overflow-hidden">
                    <div className="flex items-center justify-between gap-3 p-4">
                      <button
                        type="button"
                        onClick={() => toggleExpand(c)}
                        className="flex flex-1 items-center gap-2 text-start"
                      >
                        <ChevronLeft
                          className={`h-4 w-4 transition-transform ${isOpen ? '-rotate-90' : ''}`}
                        />
                        <span className="font-medium">{c.name}</span>
                        <Badge variant="outline">{SHIFT_LABEL[c.shift]}</Badge>
                      </button>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingChecklist(c);
                            setDrawerOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                          ערוך
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteChecklist(c)}
                        >
                          <Trash2 className="h-4 w-4" />
                          מחק
                        </Button>
                      </div>
                    </div>

                    {isOpen && (
                      <div className="border-t p-4">
                        {items.length === 0 ? (
                          <p className="text-muted-foreground mb-3 text-sm">
                            אין סעיפים. הוסף את הראשון למטה.
                          </p>
                        ) : (
                          <ul className="mb-3 flex flex-col gap-2">
                            {items.map((item) => (
                              <li
                                key={item.id}
                                className="bg-muted/30 flex items-center gap-2 rounded-md px-3 py-2"
                              >
                                <GripVertical className="text-muted-foreground h-4 w-4" />
                                <span className="flex-1 text-sm">{item.text}</span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() => handleRemoveItem(c.id, item.id)}
                                  aria-label="הסר סעיף"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </li>
                            ))}
                          </ul>
                        )}

                        <div className="flex items-center gap-2">
                          <Input
                            value={newItemText[c.id] ?? ''}
                            onChange={(e) =>
                              setNewItemText((prev) => ({ ...prev, [c.id]: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddItem(c);
                              }
                            }}
                            placeholder="הוסף סעיף חדש…"
                            className="h-9"
                          />
                          <Button size="sm" onClick={() => handleAddItem(c)}>
                            <Plus className="h-4 w-4" />
                            הוסף
                          </Button>
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
          </TabsContent>
        </IfRole>
      </Tabs>

      <ChecklistCompletionSheet
        tenantId={tenantId}
        userId={userId}
        date={date}
        checklist={activeChecklist}
        open={completionOpen}
        onOpenChange={setCompletionOpen}
        onSaved={handleCompletionSaved}
      />

      <ChecklistTemplateDrawer
        tenantId={tenantId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        checklist={editingChecklist}
        onSaved={handleTemplateSaved}
      />
    </div>
  );
}
