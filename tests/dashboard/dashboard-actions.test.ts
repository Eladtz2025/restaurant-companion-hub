import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: () => ({
    getAll: () => [],
    set: vi.fn(),
    get: vi.fn(),
  }),
}));

vi.mock('@/lib/audit/logger', () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

type AlertRuleRow = {
  id: string;
  tenant_id: string;
  metric: string;
  threshold: number;
  operator: string;
  severity: string;
  active: boolean;
  created_at: string;
};

type AlertRow = {
  id: string;
  tenant_id: string;
  rule_id: string | null;
  metric: string;
  value: number;
  threshold: number;
  severity: string;
  message: string;
  acknowledged: boolean;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  fired_at: string;
  date: string;
  created_at: string;
};

let alertRules: AlertRuleRow[] = [];
let alerts: AlertRow[] = [];
let idSeq = 0;

const TENANT = '11111111-1111-1111-8111-111111111111';
const DATE = '2026-05-02';
const USER_ID = 'user-00000000-0000-0000-0000-000000000001';

function makeId() {
  return `aaaaaaaa-${String(++idSeq).padStart(4, '0')}-aaaa-8aaa-aaaaaaaaaaaa`;
}

vi.mock('@/lib/supabase/server', () => ({
  createServerSupabaseClient: vi.fn(),
}));

import { createServerSupabaseClient } from '@/lib/supabase/server';

function mockSupabase() {
  const client = {
    from: vi.fn((table: string) => {
      if (table === 'prep_tasks') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }

      if (table === 'checklist_completions') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        };
      }

      if (table === 'recipes') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ count: 5, error: null }),
            }),
          }),
        };
      }

      if (table === 'alerts') {
        return {
          select: vi.fn().mockImplementation(() => {
            const chain: Record<string, unknown> = {};
            let filtered = [...alerts];
            chain.eq = vi.fn().mockImplementation((col: string, val: unknown) => {
              filtered = filtered.filter((r) => (r as Record<string, unknown>)[col] === val);
              return chain;
            });

            Object.defineProperty(chain, Symbol.toStringTag, { value: 'Promise' });

            return {
              eq: vi.fn().mockImplementation((col: string, val: unknown) => {
                let f = [...alerts].filter((r) => (r as Record<string, unknown>)[col] === val);
                return {
                  eq: vi.fn().mockImplementation((col2: string, val2: unknown) => {
                    f = f.filter((r) => (r as Record<string, unknown>)[col2] === val2);
                    return {
                      eq: vi.fn().mockResolvedValue({ data: f, error: null }),
                    };
                  }),
                };
              }),
            };
          }),
          insert: vi.fn().mockImplementation((rows: Partial<AlertRow>[]) => {
            const inserted: AlertRow[] = (Array.isArray(rows) ? rows : [rows]).map((r) => ({
              id: makeId(),
              tenant_id: r.tenant_id ?? TENANT,
              rule_id: r.rule_id ?? null,
              metric: r.metric ?? 'prep_completion_rate',
              value: r.value ?? 0,
              threshold: r.threshold ?? 0,
              severity: r.severity ?? 'warning',
              message: r.message ?? '',
              acknowledged: false,
              acknowledged_by: null,
              acknowledged_at: null,
              fired_at: new Date().toISOString(),
              date: r.date ?? DATE,
              created_at: new Date().toISOString(),
            }));
            alerts.push(...inserted);
            return {
              select: vi.fn().mockResolvedValue({ data: inserted, error: null }),
            };
          }),
          update: vi.fn().mockImplementation((patch: Partial<AlertRow>) => ({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation((_col2: string, val2: unknown) => {
                const idx = alerts.findIndex((r) => r.id === val2);
                if (idx !== -1) Object.assign(alerts[idx]!, patch);
                const row = alerts[idx] ?? null;
                return {
                  select: vi.fn().mockReturnValue({
                    single: vi.fn().mockResolvedValue({
                      data: row,
                      error: row ? null : { message: 'Not found' },
                    }),
                  }),
                };
              }),
            }),
          })),
        };
      }

      if (table === 'alert_rules') {
        return {
          select: vi.fn().mockImplementation(() => {
            const state = { filtered: [...alertRules] };
            const chain = {
              eq: vi.fn().mockImplementation((col: string, val: unknown) => {
                state.filtered = state.filtered.filter(
                  (r) => (r as Record<string, unknown>)[col] === val,
                );
                return chain;
              }),
              order: vi
                .fn()
                .mockImplementation(() => Promise.resolve({ data: state.filtered, error: null })),
            };
            return chain;
          }),
          insert: vi.fn().mockImplementation((data: Partial<AlertRuleRow>) => {
            const row: AlertRuleRow = {
              id: makeId(),
              tenant_id: data.tenant_id ?? TENANT,
              metric: data.metric ?? 'prep_completion_rate',
              threshold: data.threshold ?? 0,
              operator: data.operator ?? 'lt',
              severity: data.severity ?? 'warning',
              active: true,
              created_at: new Date().toISOString(),
            };
            alertRules.push(row);
            return {
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: row, error: null }),
              }),
            };
          }),
        };
      }

      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      };
    }),
  };

  (createServerSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue(client);
  return client;
}

const { getKPISnapshot, getAlertRules, createAlertRule, acknowledgeAlert, fireAlertsForSnapshot } =
  await import('@/lib/actions/dashboard');

describe('Dashboard Actions', () => {
  beforeEach(() => {
    alertRules = [];
    alerts = [];
    idSeq = 0;
    mockSupabase();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('getKPISnapshot — returns 0% when no prep tasks', async () => {
    const snapshot = await getKPISnapshot(TENANT, DATE);
    expect(snapshot.prepCompletionRate).toBe(0);
    expect(snapshot.checklistCompletionRate).toBe(0);
    expect(snapshot.date).toBe(DATE);
    expect(snapshot.fcPercent).toBeNull();
  });

  it('getKPISnapshot — calculates 60% prep completion (3 done of 5)', async () => {
    const prepData = [
      { status: 'done' },
      { status: 'done' },
      { status: 'done' },
      { status: 'pending' },
      { status: 'pending' },
    ];
    const client = {
      from: vi.fn((table: string) => {
        if (table === 'prep_tasks') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: prepData, error: null }),
              }),
            }),
          };
        }
        if (table === 'checklist_completions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          };
        }
        if (table === 'recipes') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ count: 10, error: null }),
              }),
            }),
          };
        }
        if (table === 'alerts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  eq: vi.fn().mockResolvedValue({ data: [], error: null }),
                }),
              }),
            }),
          };
        }
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis() };
      }),
    };
    (createServerSupabaseClient as ReturnType<typeof vi.fn>).mockResolvedValue(client);

    const snapshot = await getKPISnapshot(TENANT, DATE);
    expect(snapshot.prepCompletionRate).toBeCloseTo(60);
  });

  it('getAlertRules — returns only active rules for tenant', async () => {
    alertRules = [
      {
        id: 'r1',
        tenant_id: TENANT,
        metric: 'prep_completion_rate',
        threshold: 70,
        operator: 'lt',
        severity: 'warning',
        active: true,
        created_at: '2026-05-01T00:00:00Z',
      },
      {
        id: 'r2',
        tenant_id: TENANT,
        metric: 'fc_percent',
        threshold: 35,
        operator: 'gt',
        severity: 'critical',
        active: false,
        created_at: '2026-05-01T00:00:00Z',
      },
    ];
    mockSupabase();

    const rules = await getAlertRules(TENANT);
    expect(rules).toHaveLength(1);
    expect(rules[0]!.metric).toBe('prep_completion_rate');
  });

  it('createAlertRule — creates and returns a rule', async () => {
    const rule = await createAlertRule(TENANT, {
      metric: 'fc_percent',
      threshold: 35,
      operator: 'gt',
      severity: 'critical',
    });

    expect(rule.metric).toBe('fc_percent');
    expect(rule.threshold).toBe(35);
    expect(rule.operator).toBe('gt');
    expect(rule.severity).toBe('critical');
    expect(rule.tenantId).toBe(TENANT);
    expect(rule.active).toBe(true);
  });

  it('acknowledgeAlert — marks alert as acknowledged', async () => {
    const alertId = makeId();
    alerts = [
      {
        id: alertId,
        tenant_id: TENANT,
        rule_id: null,
        metric: 'prep_completion_rate',
        value: 50,
        threshold: 70,
        severity: 'warning',
        message: 'test',
        acknowledged: false,
        acknowledged_by: null,
        acknowledged_at: null,
        fired_at: new Date().toISOString(),
        date: DATE,
        created_at: new Date().toISOString(),
      },
    ];
    mockSupabase();

    const updated = await acknowledgeAlert(TENANT, alertId, USER_ID);
    expect(updated.acknowledged).toBe(true);
    expect(updated.acknowledgedBy).toBe(USER_ID);
    expect(updated.acknowledgedAt).not.toBeNull();
  });

  it('fireAlertsForSnapshot — inserts fired alerts and returns them', async () => {
    alertRules = [
      {
        id: 'r1',
        tenant_id: TENANT,
        metric: 'prep_completion_rate',
        threshold: 90,
        operator: 'lt',
        severity: 'warning',
        active: true,
        created_at: '2026-05-01T00:00:00Z',
      },
    ];
    mockSupabase();

    const snapshot = {
      date: DATE,
      prepCompletionRate: 60,
      checklistCompletionRate: 80,
      fcPercent: null,
      activeRecipes: 5,
      alerts: [],
    };

    const fired = await fireAlertsForSnapshot(TENANT, snapshot);
    expect(fired).toHaveLength(1);
    expect(fired[0]!.metric).toBe('prep_completion_rate');
    expect(fired[0]!.value).toBe(60);
  });

  it('fireAlertsForSnapshot — returns empty array when no rules trigger', async () => {
    alertRules = [
      {
        id: 'r1',
        tenant_id: TENANT,
        metric: 'prep_completion_rate',
        threshold: 50,
        operator: 'lt',
        severity: 'warning',
        active: true,
        created_at: '2026-05-01T00:00:00Z',
      },
    ];
    mockSupabase();

    const snapshot = {
      date: DATE,
      prepCompletionRate: 90,
      checklistCompletionRate: 80,
      fcPercent: null,
      activeRecipes: 5,
      alerts: [],
    };

    const fired = await fireAlertsForSnapshot(TENANT, snapshot);
    expect(fired).toHaveLength(0);
  });
});
