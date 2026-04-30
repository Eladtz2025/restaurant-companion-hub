import type { IngredientCategory, IngredientUnit } from '@/lib/types';

export interface IngredientRow {
  name_he: string;
  unit: IngredientUnit;
  category: IngredientCategory;
  cost_per_unit_cents: number;
  pkg_qty?: number;
}

export interface ParseResult {
  valid: IngredientRow[];
  invalid: { row: number; reason: string }[];
}

// Hebrew → canonical unit mappings (longest match first within each group)
const UNIT_MAP: Record<string, IngredientUnit> = {
  'ק"ג': 'kg',
  קילוגרם: 'kg',
  קג: 'kg',
  kg: 'kg',
  גרם: 'g',
  gr: 'g',
  g: 'g',
  ליטר: 'l',
  liter: 'l',
  litre: 'l',
  l: 'l',
  'מ"ל': 'ml',
  מיליליטר: 'ml',
  ml: 'ml',
  "יח'": 'unit',
  יח: 'unit',
  יחידה: 'unit',
  unit: 'unit',
  pcs: 'unit',
  piece: 'unit',
  אריזה: 'pkg',
  pkg: 'pkg',
  pack: 'pkg',
  package: 'pkg',
};

// Hebrew → canonical category mappings
const CATEGORY_MAP: Record<string, IngredientCategory> = {
  ירקות: 'produce',
  פירות: 'produce',
  'ירקות ופירות': 'produce',
  produce: 'produce',
  בשר: 'meat',
  meat: 'meat',
  דגים: 'fish',
  דג: 'fish',
  fish: 'fish',
  חלב: 'dairy',
  חלבי: 'dairy',
  dairy: 'dairy',
  יבש: 'dry',
  'מוצרים יבשים': 'dry',
  dry: 'dry',
  אלכוהול: 'alcohol',
  alcohol: 'alcohol',
  אחר: 'other',
  other: 'other',
  שונות: 'other',
};

function normalizeUnit(raw: string): IngredientUnit | null {
  const key = raw.trim().toLowerCase();
  for (const [k, v] of Object.entries(UNIT_MAP)) {
    if (k.toLowerCase() === key) return v;
  }
  return null;
}

function normalizeCategory(raw: string): IngredientCategory {
  const key = raw.trim().toLowerCase();
  for (const [k, v] of Object.entries(CATEGORY_MAP)) {
    if (k.toLowerCase() === key) return v;
  }
  return 'other';
}

// Split a CSV line respecting quoted fields.
// A field is quoted only if " appears as the very first character of the field.
// Mid-field " characters (e.g. Hebrew abbreviations like מ"ל) are treated as literals.
function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let i = 0;

  while (i <= line.length) {
    if (i === line.length) {
      fields.push('');
      break;
    }

    if (line[i] === '"') {
      // Quoted field: consume until closing quote
      i++; // skip opening quote
      let current = '';
      while (i < line.length) {
        if (line[i] === '"') {
          if (line[i + 1] === '"') {
            current += '"';
            i += 2;
          } else {
            i++; // skip closing quote
            break;
          }
        } else {
          current += line[i++];
        }
      }
      fields.push(current.trim());
      // skip comma after quoted field
      if (line[i] === ',') i++;
    } else {
      // Unquoted field: read until next comma
      let current = '';
      while (i < line.length && line[i] !== ',') {
        current += line[i++];
      }
      fields.push(current.trim());
      if (line[i] === ',') i++;
    }
  }

  return fields;
}

// Detect which column index corresponds to each field based on header row
interface ColumnMap {
  name: number;
  unit: number;
  category: number;
  cost: number;
  pkgQty: number;
}

const HEBREW_HEADERS: Record<keyof ColumnMap, string[]> = {
  name: ['שם', 'שם מרכיב'],
  unit: ['יחידה', 'יח'],
  category: ['קטגוריה', 'קטגוריות'],
  cost: ['מחיר ליחידה', 'מחיר', 'עלות'],
  pkgQty: ['כמות לאריזה', 'כמות'],
};

const ENGLISH_HEADERS: Record<keyof ColumnMap, string[]> = {
  name: ['name', 'name_he'],
  unit: ['unit'],
  category: ['category'],
  cost: ['cost', 'cost_per_unit', 'price'],
  pkgQty: ['pkg_qty', 'pkg', 'package_qty'],
};

function detectColumns(headers: string[]): ColumnMap | null {
  const normalized = headers.map((h) => h.trim().toLowerCase());
  const result: Partial<ColumnMap> = {};

  for (const [field, variants] of Object.entries({
    ...HEBREW_HEADERS,
    ...Object.fromEntries(
      Object.entries(ENGLISH_HEADERS).map(([k, v]) => [
        k,
        [...(HEBREW_HEADERS[k as keyof ColumnMap] ?? []), ...v],
      ]),
    ),
  }) as [keyof ColumnMap, string[]][]) {
    const idx = normalized.findIndex((h) => variants.some((v) => v.toLowerCase() === h));
    if (idx !== -1) result[field] = idx;
  }

  if (result.name === undefined || result.unit === undefined) return null;
  return {
    name: result.name,
    unit: result.unit,
    category: result.category ?? -1,
    cost: result.cost ?? -1,
    pkgQty: result.pkgQty ?? -1,
  };
}

export function parseIngredientCSV(csvText: string): ParseResult {
  const valid: IngredientRow[] = [];
  const invalid: { row: number; reason: string }[] = [];

  const lines = csvText.split(/\r?\n/);
  if (lines.length === 0) return { valid, invalid };

  // Find first non-empty line as header
  let headerIdx = 0;
  while (headerIdx < lines.length && (lines[headerIdx] ?? '').trim() === '') headerIdx++;
  if (headerIdx >= lines.length) return { valid, invalid };

  const headers = splitCsvLine(lines[headerIdx] ?? '');
  const cols = detectColumns(headers);
  if (!cols) {
    invalid.push({ row: 1, reason: 'כותרות עמודות לא תקינות — נדרש עמודת שם ויחידה' });
    return { valid, invalid };
  }

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const lineNum = i + 1;
    const rawLine = lines[i] ?? '';
    const line = rawLine.trim();
    if (!line) continue;

    const fields = splitCsvLine(rawLine);

    const rawName = fields[cols.name]?.trim() ?? '';
    if (!rawName) continue; // silently skip rows with no name

    const rawUnit = fields[cols.unit]?.trim() ?? '';
    const unit = normalizeUnit(rawUnit);
    if (!unit) {
      invalid.push({ row: lineNum, reason: `שורה ${lineNum}: יחידה לא מוכרת — "${rawUnit}"` });
      continue;
    }

    const rawCategory = cols.category >= 0 ? (fields[cols.category]?.trim() ?? '') : '';
    const category = rawCategory ? normalizeCategory(rawCategory) : 'other';

    const rawCost = cols.cost >= 0 ? (fields[cols.cost]?.trim() ?? '') : '';
    let costCents = 0;
    if (rawCost) {
      const costShekel = parseFloat(rawCost.replace(/[^\d.]/g, ''));
      if (isNaN(costShekel) || costShekel < 0) {
        invalid.push({ row: lineNum, reason: `שורה ${lineNum}: מחיר לא תקין — "${rawCost}"` });
        continue;
      }
      costCents = Math.round(costShekel * 100);
    }

    const rawPkgQty = cols.pkgQty >= 0 ? (fields[cols.pkgQty]?.trim() ?? '') : '';
    let pkgQty: number | undefined;
    if (rawPkgQty) {
      const qty = parseFloat(rawPkgQty);
      if (isNaN(qty) || qty <= 0) {
        invalid.push({
          row: lineNum,
          reason: `שורה ${lineNum}: כמות לאריזה לא תקינה — "${rawPkgQty}"`,
        });
        continue;
      }
      pkgQty = qty;
    }

    valid.push({
      name_he: rawName,
      unit,
      category,
      cost_per_unit_cents: costCents,
      ...(pkgQty !== undefined ? { pkg_qty: pkgQty } : {}),
    });
  }

  return { valid, invalid };
}

// Deduplicate by name_he (case-insensitive), last occurrence wins
export function deduplicateRows(rows: IngredientRow[]): IngredientRow[] {
  const map = new Map<string, IngredientRow>();
  for (const row of rows) {
    map.set(row.name_he.toLowerCase(), row);
  }
  return Array.from(map.values());
}
