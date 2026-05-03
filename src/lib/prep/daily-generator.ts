import { SimpleAverageProvider } from '@/lib/forecast/simple-average';

export interface GeneratorInput {
  tenantId: string;
  targetDate: string; // YYYY-MM-DD
  // Map of recipeId → last 14 days of sales qty per day
  salesHistory: Map<string, Array<{ date: string; qty: number }>>;
  // Map of recipeId → yield unit (from recipes table)
  recipeUnits: Map<string, string>;
}

export interface GeneratorOutput {
  tasks: Array<{
    recipeId: string;
    prepDate: string;
    qtyRequired: number;
    unit: string;
  }>;
  skipped: string[]; // recipeIds with no history
}

export function generateDailyPrepTasks(input: GeneratorInput): GeneratorOutput {
  const provider = new SimpleAverageProvider();
  const forecasts = provider.forecast(input.salesHistory, input.targetDate);

  const tasks = [];
  const skipped = [];

  for (const [recipeId] of input.salesHistory) {
    const forecast = forecasts.find((f) => f.recipeId === recipeId);
    if (!forecast || forecast.forecastQty <= 0) {
      skipped.push(recipeId);
      continue;
    }
    tasks.push({
      recipeId,
      prepDate: input.targetDate,
      qtyRequired: forecast.forecastQty,
      unit: input.recipeUnits.get(recipeId) ?? 'unit',
    });
  }

  return { tasks, skipped };
}
