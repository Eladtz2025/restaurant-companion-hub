import { describe, expect, it } from 'vitest';

import { deduplicateRows, parseIngredientCSV } from '@/lib/ingredients/csv-importer';

describe('parseIngredientCSV — Hebrew headers', () => {
  it('parses a valid CSV with Hebrew headers', () => {
    const csv = `שם,יחידה,קטגוריה,מחיר ליחידה,כמות לאריזה
עגבנייה,קג,ירקות,4.50,10
חלב,ליטר,חלבי,6.00,`;

    const { valid, invalid } = parseIngredientCSV(csv);

    expect(invalid).toHaveLength(0);
    expect(valid).toHaveLength(2);

    expect(valid[0]!).toMatchObject({
      name_he: 'עגבנייה',
      unit: 'kg',
      category: 'produce',
      cost_per_unit_cents: 450,
    });
    expect(valid[1]!).toMatchObject({
      name_he: 'חלב',
      unit: 'l',
      category: 'dairy',
      cost_per_unit_cents: 600,
    });
  });

  it('parses pkg_qty when provided', () => {
    const csv = `שם,יחידה,קטגוריה,מחיר ליחידה,כמות לאריזה
שמן זית,ליטר,יבש,25.00,6`;

    const { valid } = parseIngredientCSV(csv);
    expect(valid[0]!.pkg_qty).toBe(6);
  });
});

describe('parseIngredientCSV — English headers', () => {
  it('parses a valid CSV with English headers', () => {
    const csv = `name,unit,category,cost,pkg_qty
Tomato,kg,produce,4.50,
Milk,l,dairy,6.00,12`;

    const { valid, invalid } = parseIngredientCSV(csv);

    expect(invalid).toHaveLength(0);
    expect(valid).toHaveLength(2);
    expect(valid[0]!).toMatchObject({ name_he: 'Tomato', unit: 'kg', category: 'produce' });
    expect(valid[1]!.pkg_qty).toBe(12);
  });
});

describe('parseIngredientCSV — unit fuzzy matching', () => {
  it('maps Hebrew unit aliases to canonical units', () => {
    const csv = `שם,יחידה,קטגוריה
קמח,גרם,יבש
יין,מ"ל,אלכוהול
ביצים,יחידה,אחר`;

    const { valid, invalid } = parseIngredientCSV(csv);
    expect(invalid).toHaveLength(0);
    expect(valid[0]!.unit).toBe('g');
    expect(valid[1]!.unit).toBe('ml');
    expect(valid[2]!.unit).toBe('unit');
  });

  it('collects error for unrecognised unit, other rows proceed', () => {
    const csv = `שם,יחידה,קטגוריה
עגבנייה,קג,ירקות
בשר,XXX,בשר
חלב,ליטר,חלבי`;

    const { valid, invalid } = parseIngredientCSV(csv);
    expect(invalid).toHaveLength(1);
    expect(invalid[0]!.reason).toContain('XXX');
    expect(valid).toHaveLength(2);
  });
});

describe('parseIngredientCSV — empty rows', () => {
  it('skips empty rows silently', () => {
    const csv = `שם,יחידה,קטגוריה

עגבנייה,קג,ירקות

חלב,ליטר,חלבי
`;

    const { valid, invalid } = parseIngredientCSV(csv);
    expect(invalid).toHaveLength(0);
    expect(valid).toHaveLength(2);
  });
});

describe('parseIngredientCSV — mixed valid + invalid', () => {
  it('imports 8 good rows and collects 2 errors', () => {
    const csv = `name,unit,category,cost
Apple,kg,produce,3.00
Beef,BAD_UNIT,meat,50.00
Chicken,kg,meat,40.00
Flour,g,dry,0.50
Salt,g,dry,0.10
Oil,l,dry,12.00
Wine,l,alcohol,30.00
Butter,kg,dairy,20.00
Cheese,kg,dairy,60.00
Fish,NOPE,fish,35.00`;

    const { valid, invalid } = parseIngredientCSV(csv);
    expect(valid).toHaveLength(8);
    expect(invalid).toHaveLength(2);
    expect(invalid[0]!.reason).toContain('BAD_UNIT');
    expect(invalid[1]!.reason).toContain('NOPE');
  });
});

describe('deduplicateRows', () => {
  it('deduplicates by name_he case-insensitively, last occurrence wins', () => {
    const rows = [
      {
        name_he: 'עגבנייה',
        unit: 'kg' as const,
        category: 'produce' as const,
        cost_per_unit_cents: 100,
      },
      { name_he: 'חלב', unit: 'l' as const, category: 'dairy' as const, cost_per_unit_cents: 200 },
      {
        name_he: 'עגבנייה',
        unit: 'kg' as const,
        category: 'produce' as const,
        cost_per_unit_cents: 999,
      },
    ];

    const result = deduplicateRows(rows);
    expect(result).toHaveLength(2);
    const tomato = result.find((r) => r.name_he === 'עגבנייה');
    expect(tomato?.cost_per_unit_cents).toBe(999);
  });

  it('returns all rows when no duplicates exist', () => {
    const rows = [
      { name_he: 'א', unit: 'kg' as const, category: 'produce' as const, cost_per_unit_cents: 0 },
      { name_he: 'ב', unit: 'g' as const, category: 'dry' as const, cost_per_unit_cents: 0 },
    ];
    expect(deduplicateRows(rows)).toHaveLength(2);
  });
});

describe('parseIngredientCSV — category fallback', () => {
  it('defaults to "other" when category column is missing', () => {
    const csv = `name,unit
Tomato,kg`;

    const { valid } = parseIngredientCSV(csv);
    expect(valid[0]!.category).toBe('other');
  });

  it('defaults to "other" for unrecognised category value', () => {
    const csv = `name,unit,category
Tomato,kg,UNKNOWN_CAT`;

    const { valid } = parseIngredientCSV(csv);
    expect(valid[0]!.category).toBe('other');
  });
});
