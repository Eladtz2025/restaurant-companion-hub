import { describe, expect, it } from 'vitest';

// Pure logic tests for computeExpectedQty algorithm

type ReceiptLine = {
  ingredientId: string;
  qty: number;
  receivedDate: string;
  status: 'pending' | 'approved' | 'disputed';
};

type WasteEntry = {
  ingredientId: string;
  qty: number;
  occurredDate: string;
};

type PrepConsumption = {
  ingredientId: string;
  qty: number;
  prepDate: string;
};

function computeExpected(opts: {
  prevCounted: number;
  prevDate: string;
  targetDate: string;
  receipts: ReceiptLine[];
  waste: WasteEntry[];
  consumption: PrepConsumption[];
  ingredientId: string;
}): number {
  let qty = opts.prevCounted;

  // Add approved receipts between prevDate and targetDate (exclusive)
  for (const r of opts.receipts) {
    if (
      r.ingredientId === opts.ingredientId &&
      r.status === 'approved' &&
      r.receivedDate > opts.prevDate &&
      r.receivedDate <= opts.targetDate
    ) {
      qty += r.qty;
    }
  }

  // Subtract waste events
  for (const w of opts.waste) {
    if (
      w.ingredientId === opts.ingredientId &&
      w.occurredDate >= opts.prevDate &&
      w.occurredDate < opts.targetDate
    ) {
      qty -= w.qty;
    }
  }

  // Subtract theoretical consumption from prep
  for (const c of opts.consumption) {
    if (
      c.ingredientId === opts.ingredientId &&
      c.prepDate >= opts.prevDate &&
      c.prepDate < opts.targetDate
    ) {
      qty -= c.qty;
    }
  }

  return Math.max(0, qty);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('computeExpectedQty', () => {
  it('returns prev count unchanged when no activity', () => {
    expect(
      computeExpected({
        ingredientId: 'i1',
        prevCounted: 10,
        prevDate: '2026-01-01',
        targetDate: '2026-01-05',
        receipts: [],
        waste: [],
        consumption: [],
      }),
    ).toBe(10);
  });

  it('adds approved receipts received between dates', () => {
    expect(
      computeExpected({
        ingredientId: 'i1',
        prevCounted: 5,
        prevDate: '2026-01-01',
        targetDate: '2026-01-05',
        receipts: [{ ingredientId: 'i1', qty: 20, receivedDate: '2026-01-03', status: 'approved' }],
        waste: [],
        consumption: [],
      }),
    ).toBe(25);
  });

  it('does not add pending receipts', () => {
    expect(
      computeExpected({
        ingredientId: 'i1',
        prevCounted: 5,
        prevDate: '2026-01-01',
        targetDate: '2026-01-05',
        receipts: [{ ingredientId: 'i1', qty: 20, receivedDate: '2026-01-03', status: 'pending' }],
        waste: [],
        consumption: [],
      }),
    ).toBe(5);
  });

  it('subtracts waste events', () => {
    expect(
      computeExpected({
        ingredientId: 'i1',
        prevCounted: 10,
        prevDate: '2026-01-01',
        targetDate: '2026-01-05',
        receipts: [],
        waste: [{ ingredientId: 'i1', qty: 2, occurredDate: '2026-01-03' }],
        consumption: [],
      }),
    ).toBe(8);
  });

  it('subtracts theoretical consumption', () => {
    expect(
      computeExpected({
        ingredientId: 'i1',
        prevCounted: 10,
        prevDate: '2026-01-01',
        targetDate: '2026-01-05',
        receipts: [],
        waste: [],
        consumption: [{ ingredientId: 'i1', qty: 3, prepDate: '2026-01-02' }],
      }),
    ).toBe(7);
  });

  it('combines receipts, waste, and consumption correctly', () => {
    expect(
      computeExpected({
        ingredientId: 'i1',
        prevCounted: 10,
        prevDate: '2026-01-01',
        targetDate: '2026-01-05',
        receipts: [{ ingredientId: 'i1', qty: 20, receivedDate: '2026-01-02', status: 'approved' }],
        waste: [{ ingredientId: 'i1', qty: 1, occurredDate: '2026-01-03' }],
        consumption: [{ ingredientId: 'i1', qty: 4, prepDate: '2026-01-04' }],
      }),
    ).toBe(25); // 10 + 20 - 1 - 4 = 25
  });

  it('floors at zero (never negative)', () => {
    expect(
      computeExpected({
        ingredientId: 'i1',
        prevCounted: 2,
        prevDate: '2026-01-01',
        targetDate: '2026-01-05',
        receipts: [],
        waste: [{ ingredientId: 'i1', qty: 5, occurredDate: '2026-01-02' }],
        consumption: [],
      }),
    ).toBe(0);
  });

  it('ignores activity for other ingredients', () => {
    expect(
      computeExpected({
        ingredientId: 'i1',
        prevCounted: 10,
        prevDate: '2026-01-01',
        targetDate: '2026-01-05',
        receipts: [
          { ingredientId: 'OTHER', qty: 100, receivedDate: '2026-01-02', status: 'approved' },
        ],
        waste: [{ ingredientId: 'OTHER', qty: 5, occurredDate: '2026-01-03' }],
        consumption: [{ ingredientId: 'OTHER', qty: 3, prepDate: '2026-01-04' }],
      }),
    ).toBe(10);
  });

  it('excludes receipts received before prevDate', () => {
    expect(
      computeExpected({
        ingredientId: 'i1',
        prevCounted: 5,
        prevDate: '2026-01-03',
        targetDate: '2026-01-07',
        receipts: [{ ingredientId: 'i1', qty: 10, receivedDate: '2026-01-02', status: 'approved' }],
        waste: [],
        consumption: [],
      }),
    ).toBe(5);
  });
});
