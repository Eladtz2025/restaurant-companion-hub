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
  recipeId?: string | null;
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

export type PrepTaskStatus = 'pending' | 'in_progress' | 'done' | 'skipped';

export interface PrepTask {
  id: string;
  tenantId: string;
  recipeId: string;
  prepDate: string;
  qtyRequired: number;
  qtyActual: number | null;
  unit: string;
  status: PrepTaskStatus;
  notes: string | null;
  assignedTo: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PrepSummary {
  date: string;
  total: number;
  pending: number;
  inProgress: number;
  done: number;
  skipped: number;
}

export type ShiftType = 'morning' | 'afternoon' | 'evening' | 'night';
export type ChecklistStatus = 'pending' | 'partial' | 'completed';

export interface Checklist {
  id: string;
  tenantId: string;
  name: string;
  shift: ShiftType;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistItem {
  id: string;
  tenantId: string;
  checklistId: string;
  text: string;
  sortOrder: number;
  createdAt: string;
}

export interface ChecklistCompletion {
  id: string;
  tenantId: string;
  checklistId: string;
  completionDate: string;
  completedBy: string | null;
  signatureUrl: string | null;
  completedItems: string[];
  notes: string | null;
  status: ChecklistStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistWithItems extends Checklist {
  items: ChecklistItem[];
}

export type KPIMetric =
  | 'prep_completion_rate'
  | 'checklist_completion_rate'
  | 'fc_percent'
  | 'active_recipes';
export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertOperator = 'lt' | 'gt' | 'lte' | 'gte';

export interface Alert {
  id: string;
  metric: KPIMetric;
  value: number;
  threshold: number;
  severity: AlertSeverity;
  message: string;
  acknowledged: boolean;
  firedAt: string;
  date: string;
}

export interface KPISnapshot {
  date: string;
  prepCompletionRate: number;
  checklistCompletionRate: number;
  fcPercent: number | null;
  activeRecipes: number;
  alerts: Alert[];
}

export interface AlertRule {
  id: string;
  metric: KPIMetric;
  threshold: number;
  operator: AlertOperator;
  severity: AlertSeverity;
  active: boolean;
}
