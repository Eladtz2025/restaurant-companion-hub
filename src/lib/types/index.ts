export type MenuCategory = 'appetizer' | 'main' | 'dessert' | 'drink' | 'side' | 'special';
export type RecipeType = 'menu' | 'prep';
export type IngredientUnit = 'kg' | 'g' | 'l' | 'ml' | 'unit' | 'pkg';
export type IngredientCategory =
  | 'produce'
  | 'meat'
  | 'fish'
  | 'dairy'
  | 'dry'
  | 'alcohol'
  | 'other';

export interface MenuItem {
  id: string;
  tenantId: string;
  posExternalId: string | null;
  nameHe: string;
  nameEn: string | null;
  category: string;
  priceCents: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Ingredient {
  id: string;
  tenantId: string;
  nameHe: string;
  nameEn: string | null;
  unit: IngredientUnit;
  category: IngredientCategory;
  costPerUnitCents: number;
  pkgQty: number | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Recipe {
  id: string;
  tenantId: string;
  nameHe: string;
  nameEn: string | null;
  type: RecipeType;
  yieldQty: number;
  yieldUnit: IngredientUnit;
  active: boolean;
  imageUrl?: string | null;
  instructionsMd?: string | null;
  videoUrl?: string | null;
  currentVersion?: number;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeVersion {
  id: string;
  tenantId: string;
  recipeId: string;
  version: number;
  snapshotData: RecipeWithComponents;
  changedBy: string | null;
  changeNote: string | null;
  createdAt: string;
}

export interface RecipeComponent {
  id: string;
  tenantId: string;
  recipeId: string;
  ingredientId: string | null;
  subRecipeId: string | null;
  qty: number;
  unit: IngredientUnit;
  sortOrder: number;
  createdAt: string;
}

export interface RecipeWithComponents extends Recipe {
  components: RecipeComponent[];
}
