import { describe, expect, it } from 'vitest';

import { buildAlertMessage, evalThreshold, evaluateRules } from '@/lib/dashboard/kpis';

import type { AlertRule, KPISnapshot } from '@/lib/types';

const BASE_SNAPSHOT: Omit<KPISnapshot, 'alerts'> = {
  date: '2026-05-02',
  prepCompletionRate: 80,
  checklistCompletionRate: 90,
  fcPercent: 30,
  activeRecipes: 10,
};

function makeRule(overrides: Partial<AlertRule> = {}): AlertRule {
  return {
    id: 'rule-1',
    tenantId: 'tenant-1',
    metric: 'prep_completion_rate',
    threshold: 70,
    operator: 'lt',
    severity: 'warning',
    active: true,
    createdAt: '2026-05-01T00:00:00Z',
    ...overrides,
  };
}

describe('evalThreshold', () => {
  it('lt — returns true when value is less than threshold', () => {
    expect(evalThreshold(50, 'lt', 70)).toBe(true);
  });

  it('lt — returns false when value is not less than threshold', () => {
    expect(evalThreshold(80, 'lt', 70)).toBe(false);
  });

  it('gt — returns true when value is greater than threshold', () => {
    expect(evalThreshold(90, 'gt', 70)).toBe(true);
  });

  it('gt — returns false when value is not greater than threshold', () => {
    expect(evalThreshold(60, 'gt', 70)).toBe(false);
  });

  it('lte — returns true when value equals threshold', () => {
    expect(evalThreshold(70, 'lte', 70)).toBe(true);
  });

  it('lte — returns false when value is above threshold', () => {
    expect(evalThreshold(71, 'lte', 70)).toBe(false);
  });

  it('gte — returns true when value equals threshold', () => {
    expect(evalThreshold(70, 'gte', 70)).toBe(true);
  });

  it('gte — returns false when value is below threshold', () => {
    expect(evalThreshold(69, 'gte', 70)).toBe(false);
  });
});

describe('buildAlertMessage', () => {
  it('returns Hebrew message containing value and threshold', () => {
    const msg = buildAlertMessage('prep_completion_rate', 65.5, 70, 'lt');
    expect(msg).toContain('65.5');
    expect(msg).toContain('70');
    expect(msg).toContain('אחוז השלמת הכנות');
  });

  it('uses correct Hebrew operator label for gt', () => {
    const msg = buildAlertMessage('fc_percent', 40, 35, 'gt');
    expect(msg).toContain('מעל');
    expect(msg).toContain('40.0');
    expect(msg).toContain('35');
  });
});

describe('evaluateRules', () => {
  it('no rules — returns empty array', () => {
    const result = evaluateRules([], BASE_SNAPSHOT);
    expect(result).toHaveLength(0);
  });

  it('rule triggered — fires alert with correct metric and message', () => {
    const rule = makeRule({ metric: 'prep_completion_rate', threshold: 90, operator: 'lt' });
    const result = evaluateRules([rule], { ...BASE_SNAPSHOT, prepCompletionRate: 80 });
    expect(result).toHaveLength(1);
    expect(result[0]!.metric).toBe('prep_completion_rate');
    expect(result[0]!.value).toBe(80);
    expect(result[0]!.threshold).toBe(90);
    expect(result[0]!.severity).toBe('warning');
    expect(result[0]!.date).toBe('2026-05-02');
    expect(result[0]!.message).toBeTruthy();
  });

  it('inactive rule — skipped even when threshold would trigger', () => {
    const rule = makeRule({ active: false, threshold: 90, operator: 'lt' });
    const result = evaluateRules([rule], BASE_SNAPSHOT);
    expect(result).toHaveLength(0);
  });

  it('null metric value — skipped', () => {
    const rule = makeRule({ metric: 'fc_percent', threshold: 50, operator: 'gt' });
    const result = evaluateRules([rule], { ...BASE_SNAPSHOT, fcPercent: null });
    expect(result).toHaveLength(0);
  });

  it('multiple rules — fires only those triggered', () => {
    const rules: AlertRule[] = [
      makeRule({ id: 'r1', metric: 'prep_completion_rate', threshold: 90, operator: 'lt' }),
      makeRule({ id: 'r2', metric: 'checklist_completion_rate', threshold: 50, operator: 'lt' }),
    ];
    const result = evaluateRules(rules, {
      ...BASE_SNAPSHOT,
      prepCompletionRate: 80,
      checklistCompletionRate: 90,
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.metric).toBe('prep_completion_rate');
  });

  it('KPI snapshot with zero tasks — prepCompletionRate 0 triggers lt rule', () => {
    const rule = makeRule({ metric: 'prep_completion_rate', threshold: 50, operator: 'lt' });
    const result = evaluateRules([rule], { ...BASE_SNAPSHOT, prepCompletionRate: 0 });
    expect(result).toHaveLength(1);
    expect(result[0]!.value).toBe(0);
  });

  it('critical severity is preserved in fired alert', () => {
    const rule = makeRule({ severity: 'critical', threshold: 90, operator: 'lt' });
    const result = evaluateRules([rule], BASE_SNAPSHOT);
    expect(result[0]!.severity).toBe('critical');
  });
});
