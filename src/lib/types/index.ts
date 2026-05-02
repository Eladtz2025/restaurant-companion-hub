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
  recipeId?: string | null;
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
  createdAt: string;
  updatedAt: string;
  imageUrl?: string | null;
  currentVersion?: number;
  instructionsMd?: string | null;
  videoUrl?: string | null;
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

export type PrepTaskStatus = 'pending' | 'in_progress' | 'done' | 'skipped';

export interface PrepTask {
  id: string;
  tenantId: string;
  recipeId: string;
  prepDate: string; // ISO date "YYYY-MM-DD"
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
  completionDate: string; // YYYY-MM-DD
  completedBy: string | null;
  signatureUrl: string | null;
  completedItems: string[]; // array of checklist_item IDs
  notes: string | null;
  status: ChecklistStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistWithItems extends Checklist {
  items: ChecklistItem[];
}

export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertOperator = 'lt' | 'gt' | 'lte' | 'gte';
export type KPIMetric =
  | 'prep_completion_rate'
  | 'checklist_completion_rate'
  | 'fc_percent'
  | 'active_recipes';

export interface AlertRule {
  id: string;
  tenantId: string;
  metric: KPIMetric;
  threshold: number;
  operator: AlertOperator;
  severity: AlertSeverity;
  active: boolean;
  createdAt: string;
}

export interface Alert {
  id: string;
  tenantId: string;
  ruleId: string | null;
  metric: KPIMetric;
  value: number;
  threshold: number;
  severity: AlertSeverity;
  message: string;
  acknowledged: boolean;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  firedAt: string;
  date: string;
  createdAt: string;
}

export interface KPISnapshot {
  date: string;
  prepCompletionRate: number;
  checklistCompletionRate: number;
  fcPercent: number | null;
  activeRecipes: number;
  alerts: Alert[];
}

export interface ManagerOverride {
  id: string;
  tenantId: string;
  entityType: 'prep_task';
  entityId: string;
  field: string;
  originalValue: unknown;
  overrideValue: unknown;
  reason: string | null;
  overriddenBy: string;
  reverted: boolean;
  revertedBy: string | null;
  revertedAt: string | null;
  createdAt: string;
}
