'use server';

import type { PrepSummary, PrepTask, PrepTaskStatus } from '@/lib/types';

/**
 * STUB. In-memory prep tasks for development. The orchestrator phase replaces
 * this with real DB queries against a `prep_tasks` table.
 */

const memoryStore = new Map<string, PrepTask[]>();

function key(tenantId: string, date: string) {
  return `${tenantId}:${date}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function seedFor(tenantId: string, date: string): PrepTask[] {
  if (date !== todayISO()) return [];
  const now = new Date().toISOString();
  return [
    {
      id: 'prep_1',
      tenantId,
      recipeId: 'rec_tahini_sauce',
      prepDate: date,
      qtyRequired: 2,
      qtyActual: null,
      unit: 'kg',
      status: 'pending',
      notes: null,
      assignedTo: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prep_2',
      tenantId,
      recipeId: 'rec_pita_dough',
      prepDate: date,
      qtyRequired: 50,
      qtyActual: 30,
      unit: 'unit',
      status: 'in_progress',
      notes: 'להניח לתפיחה שעה',
      assignedTo: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prep_3',
      tenantId,
      recipeId: 'rec_hummus_base',
      prepDate: date,
      qtyRequired: 5,
      qtyActual: 5,
      unit: 'kg',
      status: 'done',
      notes: null,
      assignedTo: null,
      completedAt: now,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prep_4',
      tenantId,
      recipeId: 'rec_chimichurri',
      prepDate: date,
      qtyRequired: 1,
      qtyActual: null,
      unit: 'l',
      status: 'pending',
      notes: null,
      assignedTo: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'prep_5',
      tenantId,
      recipeId: 'rec_chocolate_mousse',
      prepDate: date,
      qtyRequired: 20,
      qtyActual: null,
      unit: 'unit',
      status: 'skipped',
      notes: 'אין ביצים במלאי',
      assignedTo: null,
      completedAt: null,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function ensure(tenantId: string, date: string): PrepTask[] {
  const k = key(tenantId, date);
  if (!memoryStore.has(k)) memoryStore.set(k, seedFor(tenantId, date));
  return memoryStore.get(k)!;
}

export async function getPrepTasksForDate(
  tenantId: string,
  date: string,
): Promise<PrepTask[]> {
  return ensure(tenantId, date).map((t) => ({ ...t }));
}

export async function updatePrepTaskStatus(
  tenantId: string,
  taskId: string,
  update: {
    status: PrepTaskStatus;
    qtyActual?: number | null;
    notes?: string | null;
  },
): Promise<PrepTask> {
  for (const [k, tasks] of memoryStore.entries()) {
    if (!k.startsWith(`${tenantId}:`)) continue;
    const idx = tasks.findIndex((t) => t.id === taskId);
    if (idx === -1) continue;
    const prev = tasks[idx]!;
    const next: PrepTask = {
      ...prev,
      status: update.status,
      qtyActual:
        update.qtyActual === undefined ? prev.qtyActual : update.qtyActual,
      notes: update.notes === undefined ? prev.notes : update.notes,
      completedAt:
        update.status === 'done' ? new Date().toISOString() : prev.completedAt,
      updatedAt: new Date().toISOString(),
    };
    tasks[idx] = next;
    return { ...next };
  }
  throw new Error('Prep task not found');
}

export async function getPrepSummary(
  tenantId: string,
  date: string,
): Promise<PrepSummary> {
  const tasks = ensure(tenantId, date);
  const summary: PrepSummary = {
    date,
    total: tasks.length,
    pending: 0,
    inProgress: 0,
    done: 0,
    skipped: 0,
  };
  for (const t of tasks) {
    if (t.status === 'pending') summary.pending++;
    else if (t.status === 'in_progress') summary.inProgress++;
    else if (t.status === 'done') summary.done++;
    else if (t.status === 'skipped') summary.skipped++;
  }
  return summary;
}
