export interface SalesDataPoint {
  date: string; // YYYY-MM-DD
  qty: number;
}

export interface ForecastResult {
  recipeId: string;
  forecastQty: number;
  confidence: 'low' | 'medium' | 'high';
}

export class SimpleAverageProvider {
  /**
   * Computes a 7-day simple moving average for each recipe.
   * Returns forecast qty for the target date.
   */
  forecast(
    salesHistory: Map<string, SalesDataPoint[]>, // recipeId → last N sales points
    targetDate: string,
    bufferPct = 15, // add 15% safety buffer
  ): ForecastResult[] {
    const results: ForecastResult[] = [];
    for (const [recipeId, points] of salesHistory) {
      if (points.length === 0) continue;
      const avg = points.reduce((s, p) => s + p.qty, 0) / points.length;
      const forecastQty = Math.ceil(avg * (1 + bufferPct / 100));
      const confidence: ForecastResult['confidence'] =
        points.length >= 7 ? 'high' : points.length >= 3 ? 'medium' : 'low';
      results.push({ recipeId, forecastQty, confidence });
    }
    return results;
  }
}
