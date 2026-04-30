import type { IngredientUnit } from '@/lib/types';

type BaseUnit = 'g' | 'ml' | 'unit';

interface ConversionEntry {
  base: BaseUnit;
  factor: number; // how many base units per 1 of this unit
}

const CONVERSION_TABLE: Record<IngredientUnit, ConversionEntry> = {
  kg: { base: 'g', factor: 1000 },
  g: { base: 'g', factor: 1 },
  l: { base: 'ml', factor: 1000 },
  ml: { base: 'ml', factor: 1 },
  unit: { base: 'unit', factor: 1 },
  pkg: { base: 'unit', factor: 1 }, // 1 pkg = 1 unit unless pkg_qty overrides it
};

export function canConvert(fromUnit: IngredientUnit, toUnit: IngredientUnit): boolean {
  return CONVERSION_TABLE[fromUnit].base === CONVERSION_TABLE[toUnit].base;
}

export function convert(qty: number, fromUnit: IngredientUnit, toUnit: IngredientUnit): number {
  if (!canConvert(fromUnit, toUnit)) {
    throw new Error(`Cannot convert from ${fromUnit} to ${toUnit}: incompatible base units`);
  }
  const fromFactor = CONVERSION_TABLE[fromUnit].factor;
  const toFactor = CONVERSION_TABLE[toUnit].factor;
  // qty in fromUnit → qty * fromFactor = qty in base unit → / toFactor = qty in toUnit
  return (qty * fromFactor) / toFactor;
}

export function normalizeToBase(
  qty: number,
  unit: IngredientUnit,
): { qty: number; baseUnit: BaseUnit } {
  const entry = CONVERSION_TABLE[unit];
  return { qty: qty * entry.factor, baseUnit: entry.base };
}
