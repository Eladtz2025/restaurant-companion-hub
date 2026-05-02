'use server';

import type {
  Checklist,
  ChecklistCompletion,
  ChecklistItem,
  ChecklistStatus,
  ChecklistWithItems,
  ShiftType,
} from '@/lib/types';

/**
 * STUB. In-memory checklists store. Orchestrator phase replaces with DB.
 */

const checklistsByTenant = new Map<string, Checklist[]>();
const itemsByChecklist = new Map<string, ChecklistItem[]>();
const completionsByKey = new Map<string, ChecklistCompletion>();

let counter = 1000;
function newId(prefix: string) {
  counter += 1;
  return `${prefix}_${counter}`;
}

function nowISO() {
  return new Date().toISOString();
}

function completionKey(tenantId: string, checklistId: string, date: string) {
  return `${tenantId}:${checklistId}:${date}`;
}

function deriveStatus(total: number, completed: number): ChecklistStatus {
  if (total === 0 || completed === 0) return completed > 0 ? 'partial' : 'pending';
  if (completed >= total) return 'completed';
  return 'partial';
}

function ensureSeed(tenantId: string) {
  if (checklistsByTenant.has(tenantId)) return;
  const created = nowISO();
  const lists: Checklist[] = [
    {
      id: newId('chk'),
      tenantId,
      name: 'ציוד בוקר',
      shift: 'morning',
      active: true,
      createdAt: created,
      updatedAt: created,
    },
    {
      id: newId('chk'),
      tenantId,
      name: 'בטיחות',
      shift: 'morning',
      active: true,
      createdAt: created,
      updatedAt: created,
    },
    {
      id: newId('chk'),
      tenantId,
      name: 'סגירת ערב',
      shift: 'evening',
      active: true,
      createdAt: created,
      updatedAt: created,
    },
  ];
  checklistsByTenant.set(tenantId, lists);

  const seedItems: Record<string, string[]> = {
    'ציוד בוקר': [
      'לבדוק ציוד קירור',
      'לנקות משטחי עבודה',
      'לאמת מלאי שמן',
      'לבדוק טמפרטורת תנור',
    ],
    'בטיחות': [
      'לבדוק מטפי כיבוי',
      'לוודא ערכת עזרה ראשונה',
      'לבדוק יציאות חירום',
    ],
    'סגירת ערב': [
      'לכבות ציוד',
      'לנקות מטבח',
      'לסגור מקררים',
      'לרוקן פחים',
      'לנעול דלתות',
    ],
  };

  for (const list of lists) {
    const texts = seedItems[list.name] ?? [];
    const items: ChecklistItem[] = texts.map((text, idx) => ({
      id: newId('item'),
      tenantId,
      checklistId: list.id,
      text,
      sortOrder: idx,
      createdAt: created,
    }));
    itemsByChecklist.set(list.id, items);
  }
}

export async function getChecklists(
  tenantId: string,
  shift?: ShiftType,
): Promise<Checklist[]> {
  ensureSeed(tenantId);
  const lists = (checklistsByTenant.get(tenantId) ?? []).filter((c) => c.active);
  return (shift ? lists.filter((c) => c.shift === shift) : lists).map((c) => ({ ...c }));
}

export async function getChecklistWithItems(
  tenantId: string,
  id: string,
): Promise<ChecklistWithItems | null> {
  ensureSeed(tenantId);
  const list = (checklistsByTenant.get(tenantId) ?? []).find((c) => c.id === id);
  if (!list) return null;
  const items = (itemsByChecklist.get(id) ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);
  return { ...list, items: items.map((i) => ({ ...i })) };
}

export async function createChecklist(
  tenantId: string,
  data: { name: string; shift: ShiftType; active?: boolean },
): Promise<Checklist> {
  if (!data.name?.trim()) throw new Error('שם הרשימה הוא שדה חובה');
  if (!data.shift) throw new Error('יש לבחור משמרת');
  ensureSeed(tenantId);
  const created = nowISO();
  const list: Checklist = {
    id: newId('chk'),
    tenantId,
    name: data.name.trim(),
    shift: data.shift,
    active: data.active ?? true,
    createdAt: created,
    updatedAt: created,
  };
  const arr = checklistsByTenant.get(tenantId) ?? [];
  arr.push(list);
  checklistsByTenant.set(tenantId, arr);
  itemsByChecklist.set(list.id, []);
  return { ...list };
}

export async function updateChecklist(
  tenantId: string,
  id: string,
  data: Partial<{ name: string; shift: ShiftType; active: boolean }>,
): Promise<Checklist> {
  ensureSeed(tenantId);
  const arr = checklistsByTenant.get(tenantId) ?? [];
  const idx = arr.findIndex((c) => c.id === id);
  if (idx === -1) throw new Error('הרשימה לא נמצאה');
  const prev = arr[idx]!;
  const next: Checklist = {
    ...prev,
    name: data.name !== undefined ? data.name.trim() : prev.name,
    shift: data.shift ?? prev.shift,
    active: data.active ?? prev.active,
    updatedAt: nowISO(),
  };
  arr[idx] = next;
  return { ...next };
}

export async function addChecklistItem(
  tenantId: string,
  checklistId: string,
  item: { text: string; sortOrder?: number },
): Promise<ChecklistItem> {
  if (!item.text?.trim()) throw new Error('יש להזין טקסט');
  ensureSeed(tenantId);
  const items = itemsByChecklist.get(checklistId) ?? [];
  const created: ChecklistItem = {
    id: newId('item'),
    tenantId,
    checklistId,
    text: item.text.trim(),
    sortOrder: item.sortOrder ?? items.length,
    createdAt: nowISO(),
  };
  items.push(created);
  itemsByChecklist.set(checklistId, items);
  return { ...created };
}

export async function removeChecklistItem(
  tenantId: string,
  itemId: string,
): Promise<void> {
  for (const [cid, items] of itemsByChecklist.entries()) {
    const idx = items.findIndex((i) => i.id === itemId && i.tenantId === tenantId);
    if (idx !== -1) {
      items.splice(idx, 1);
      itemsByChecklist.set(cid, items);
      return;
    }
  }
}

export async function getChecklistCompletion(
  tenantId: string,
  checklistId: string,
  date: string,
): Promise<ChecklistCompletion | null> {
  const c = completionsByKey.get(completionKey(tenantId, checklistId, date));
  return c ? { ...c, completedItems: [...c.completedItems] } : null;
}

export async function upsertChecklistCompletion(
  tenantId: string,
  checklistId: string,
  date: string,
  update: {
    completedBy?: string | null;
    completedItems: string[];
    notes?: string | null;
    signatureUrl?: string | null;
  },
): Promise<ChecklistCompletion> {
  ensureSeed(tenantId);
  const items = itemsByChecklist.get(checklistId) ?? [];
  const status = deriveStatus(items.length, update.completedItems.length);
  const key = completionKey(tenantId, checklistId, date);
  const existing = completionsByKey.get(key);
  const now = nowISO();
  const next: ChecklistCompletion = {
    id: existing?.id ?? newId('comp'),
    tenantId,
    checklistId,
    completionDate: date,
    completedBy: update.completedBy ?? existing?.completedBy ?? null,
    signatureUrl: update.signatureUrl ?? existing?.signatureUrl ?? null,
    completedItems: [...update.completedItems],
    notes: update.notes ?? existing?.notes ?? null,
    status,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  completionsByKey.set(key, next);
  return { ...next, completedItems: [...next.completedItems] };
}
