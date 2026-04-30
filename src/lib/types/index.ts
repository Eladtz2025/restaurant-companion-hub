export type MenuCategory = 'appetizer' | 'main' | 'dessert' | 'drink' | 'side' | 'special';
export type RecipeType = 'menu' | 'prep';
export type IngredientUnit = 'kg' | 'g' | 'l' | 'ml' | 'unit' | 'pkg';

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
  costPerUnitCents: number;
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
  createdAt: string;
  updatedAt: string;
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
