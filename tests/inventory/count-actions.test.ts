import { describe, expect, it } from 'vitest';

// Pure logic tests for inventory count helpers (no DB calls)

type SnapshotRow = {
  ingredientId: string;
  qtyExpected: number | null;
  qtyCounted: number | null;
  variance: number | null;
};

function computeVariance(qtyCounted: number | null, qtyExpected: number | null): number | null {
  if (qtyCounted === null || qtyExpected === null) return null;
  return qtyCounted - qtyExpected;
}

function variancePct(variance: number | null, qtyExpected: number | null): number | null {
  if (variance === null || qtyExpected === null || qtyExpected === 0) return null;
  return (variance / qtyExpected) * 100;
}

function isAboveThreshold(snapshot: SnapshotRow, thresholdPct: number): boolean {
  const pct = variancePct(snapshot.variance, snapshot.qtyExpected);
  if (pct === null) return false;
  return Math.abs(pct) > thresholdPct;
}

function upsertSnapshot(
  existing: Map<string, SnapshotRow>,
  key: string,
  newVal: Omit<SnapshotRow, 'variance'>,
): Map<string, SnapshotRow> {
  const updated = new Map(existing);
  updated.set(key, {
    ...newVal,
    variance: computeVariance(newVal.qtyCounted, newVal.qtyExpected),
  });
  return updated;
}

// ── Variance computation ─────────────────────────────────────────────────────

describe('computeVariance', () => {
  it('returns counted - expected when both are provided', () => {
    expect(computeVariance(8, 10)).toBe(-2);
  });

  it('returns positive value when more than expected', () => {
    expect(computeVariance(12, 10)).toBe(2);
  });

  it('returns null when counted is null', () => {
    expect(computeVariance(null, 10)).toBeNull();
  });

  it('returns null when expected is null', () => {
    expect(computeVariance(5, null)).toBeNull();
  });

  it('returns 0 when counted equals expected', () => {
    expect(computeVariance(10, 10)).toBe(0);
  });
});

// ── Variance percent ─────────────────────────────────────────────────────────

describe('variancePct', () => {
  it('returns correct percentage', () => {
    expect(variancePct(-2, 10)).toBeCloseTo(-20);
  });

  it('returns null when expected is zero', () => {
    expect(variancePct(5, 0)).toBeNull();
  });

  it('returns null when variance is null', () => {
    expect(variancePct(null, 10)).toBeNull();
  });
});

// ── Threshold filter ─────────────────────────────────────────────────────────

describe('isAboveThreshold', () => {
  it('returns true when variance exceeds threshold', () => {
    const snap: SnapshotRow = {
      ingredientId: 'i1',
      qtyExpected: 10,
      qtyCounted: 8,
      variance: -2,
    };
    expect(isAboveThreshold(snap, 5)).toBe(true);
  });

  it('returns false when variance is within threshold', () => {
    const snap: SnapshotRow = {
      ingredientId: 'i1',
      qtyExpected: 10,
      qtyCounted: 9.6,
      variance: -0.4,
    };
    expect(isAboveThreshold(snap, 5)).toBe(false);
  });

  it('handles positive variance above threshold', () => {
    const snap: SnapshotRow = {
      ingredientId: 'i1',
      qtyExpected: 10,
      qtyCounted: 12,
      variance: 2,
    };
    expect(isAboveThreshold(snap, 5)).toBe(true);
  });
});

// ── Upsert logic ─────────────────────────────────────────────────────────────

describe('upsertSnapshot', () => {
  it('inserts a new snapshot when key does not exist', () => {
    const map = new Map<string, SnapshotRow>();
    const result = upsertSnapshot(map, 'i1-2026-01-01', {
      ingredientId: 'i1',
      qtyExpected: 10,
      qtyCounted: 8,
    });
    expect(result.size).toBe(1);
    expect(result.get('i1-2026-01-01')?.variance).toBe(-2);
  });

  it('overwrites an existing snapshot with the same key', () => {
    let map = new Map<string, SnapshotRow>();
    map = upsertSnapshot(map, 'i1-2026-01-01', {
      ingredientId: 'i1',
      qtyExpected: 10,
      qtyCounted: 7,
    });
    map = upsertSnapshot(map, 'i1-2026-01-01', {
      ingredientId: 'i1',
      qtyExpected: 10,
      qtyCounted: 9,
    });
    expect(map.size).toBe(1);
    expect(map.get('i1-2026-01-01')?.qtyCounted).toBe(9);
    expect(map.get('i1-2026-01-01')?.variance).toBe(-1);
  });

  it('stores null variance when qtyCounted is null', () => {
    const map = new Map<string, SnapshotRow>();
    const result = upsertSnapshot(map, 'i1-2026-01-01', {
      ingredientId: 'i1',
      qtyExpected: 10,
      qtyCounted: null,
    });
    expect(result.get('i1-2026-01-01')?.variance).toBeNull();
  });
});
