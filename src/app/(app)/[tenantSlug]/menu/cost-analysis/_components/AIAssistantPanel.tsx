'use client';

import {
  AlertCircle,
  Check,
  ExternalLink,
  HelpCircle,
  Loader2,
  Plus,
  Sparkles,
} from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { IfRole } from '@/components/shared/IfRole';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  generateRecipeBOM,
  type GenerateRecipeBOMResult,
} from '@/lib/actions/ai-recipe';
import { addComponent, createRecipe } from '@/lib/actions/recipes';

import type { Role } from '@/lib/permissions';

interface Props {
  tenantId: string;
  tenantSlug: string;
  userRole: Role | null;
}

interface CreatedRecipeInfo {
  id: string;
  nameHe: string;
  added: number;
  skipped: number;
}

function ConfidenceBadge({ confidence }: { confidence: 'high' | 'medium' | 'low' }) {
  const map = {
    high: { label: 'ביטחון גבוה', cls: 'bg-green-100 text-green-800' },
    medium: { label: 'ביטחון בינוני', cls: 'bg-yellow-100 text-yellow-800' },
    low: { label: 'ביטחון נמוך', cls: 'bg-red-100 text-red-800' },
  };
  const { label, cls } = map[confidence];
  return <Badge className={cls}>{label}</Badge>;
}

function MatchIcon({ confidence }: { confidence: 'exact' | 'fuzzy' | 'none' }) {
  if (confidence === 'exact') return <Check className="h-4 w-4 text-green-600" />;
  if (confidence === 'fuzzy') return <AlertCircle className="h-4 w-4 text-yellow-600" />;
  return <HelpCircle className="text-muted-foreground h-4 w-4" />;
}

export function AIAssistantPanel({ tenantId, tenantSlug, userRole }: Props) {
  const [description, setDescription] = useState('');
  const [generating, startGenerate] = useTransition();
  const [result, setResult] = useState<GenerateRecipeBOMResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedRecipeInfo | null>(null);

  function handleGenerate() {
    if (!description.trim()) return;
    setError(null);
    setResult(null);
    setCreated(null);
    startGenerate(async () => {
      try {
        const res = await generateRecipeBOM(tenantId, description.trim());
        setResult(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'שגיאה לא ידועה');
      }
    });
  }

  function handleRetry() {
    setError(null);
    setResult(null);
    handleGenerate();
  }

  async function handleAddToRecipes() {
    if (!result) return;
    const { bom, matchedIngredients } = result;
    setAdding(true);
    setProgress('יוצר מתכון...');
    try {
      const recipe = await createRecipe(tenantId, {
        nameHe: bom.recipeNameHe,
        type: 'menu',
        yieldQty: bom.yieldQty,
        yieldUnit: bom.yieldUnit,
      });

      const matchByName = new Map(matchedIngredients.map((m) => [m.ingredientNameHe, m]));
      const toAdd = bom.components.filter(
        (c) => matchByName.get(c.ingredientNameHe)?.matchedIngredientId,
      );
      const skipped = bom.components.length - toAdd.length;

      setProgress(`מוסיף ${toAdd.length} מרכיבים...`);
      let added = 0;
      for (const comp of toAdd) {
        const m = matchByName.get(comp.ingredientNameHe);
        await addComponent(tenantId, recipe.id, {
          ingredientId: m?.matchedIngredientId ?? null,
          qty: comp.qty,
          unit: comp.unit,
        });
        added++;
      }

      toast.success(`המתכון נוצר בהצלחה — ${added} מרכיבים נוספו`);
      setCreated({ id: recipe.id, nameHe: recipe.nameHe, added, skipped });
      setResult(null);
      setDescription('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'שגיאה ביצירת המתכון');
    } finally {
      setAdding(false);
      setProgress(null);
    }
  }

  return (
    <div dir="rtl" className="bg-card flex flex-col gap-3 rounded-md border p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="text-primary h-5 w-5" />
        <h2 className="text-base font-semibold">עוזר יצירת מתכונים</h2>
      </div>

      <div className="space-y-2">
        <label className="text-sm" htmlFor="ai-desc">
          תאר מנה חדשה בעברית חופשית:
        </label>
        <Textarea
          id="ai-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="לדוגמה: פסטה ברוטב עגבניות עם בשר טחון..."
          rows={4}
          dir="rtl"
          className="text-right"
          disabled={generating || adding}
        />
        <Button
          type="button"
          onClick={handleGenerate}
          disabled={generating || adding || !description.trim()}
          className="w-full"
        >
          {generating ? (
            <>
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              יוצר...
            </>
          ) : (
            <>
              <Sparkles className="ml-2 h-4 w-4" />
              צור BOM
            </>
          )}
        </Button>
      </div>

      {generating && (
        <div className="text-muted-foreground rounded-md border p-4 text-center text-sm">
          <Sparkles className="text-primary mx-auto mb-2 h-5 w-5 animate-pulse" />
          <div className="font-medium">יוצר מתכון...</div>
          <div className="mt-1 text-xs">זה יכול לקחת עד 10 שניות</div>
        </div>
      )}

      {error && !generating && (
        <div className="border-destructive/40 bg-destructive/5 rounded-md border p-4">
          <div className="text-destructive mb-2 flex items-center gap-2 text-sm font-medium">
            <AlertCircle className="h-4 w-4" />
            לא הצלחנו ליצור את ה-BOM
          </div>
          <p className="text-muted-foreground mb-3 text-xs">{error}</p>
          <Button size="sm" variant="outline" onClick={handleRetry}>
            נסה שוב
          </Button>
        </div>
      )}

      {created && (
        <div className="rounded-md border border-green-300 bg-green-50 p-4 text-sm">
          <div className="mb-2 font-medium text-green-900">
            המתכון &quot;{created.nameHe}&quot; נוצר ({created.added} מרכיבים)
          </div>
          {created.skipped > 0 && (
            <p className="mb-2 text-xs text-yellow-800">
              {created.skipped} מרכיבים לא נמצאו בבסיס הנתונים ולא נוספו
            </p>
          )}
          <a
            href={`/${tenantSlug}/recipes/${created.id}`}
            className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            צפה במתכון
          </a>
        </div>
      )}

      {result && !generating && (
        <div className="rounded-md border p-3">
          <div className="mb-2 flex items-start justify-between gap-2">
            <div>
              <div className="font-semibold">{result.bom.recipeNameHe}</div>
              <div className="text-muted-foreground text-xs">
                תשואה: {result.bom.yieldQty} {result.bom.yieldUnit}
              </div>
            </div>
            <ConfidenceBadge confidence={result.bom.confidence} />
          </div>

          <div className="mb-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-1 text-right font-normal">מרכיב</th>
                  <th className="py-1 text-right font-normal">כמות</th>
                  <th className="py-1 text-right font-normal">יחידה</th>
                  <th className="py-1 text-right font-normal">מצב</th>
                </tr>
              </thead>
              <tbody>
                {result.bom.components.map((c, i) => {
                  const m = result.matchedIngredients.find(
                    (mi) => mi.ingredientNameHe === c.ingredientNameHe,
                  );
                  return (
                    <tr key={`${c.ingredientNameHe}-${i}`} className="border-t">
                      <td className="py-1 text-right">{c.ingredientNameHe}</td>
                      <td className="py-1 text-right">{c.qty}</td>
                      <td className="py-1 text-right">{c.unit}</td>
                      <td className="py-1 text-right">
                        <MatchIcon confidence={m?.confidence ?? 'none'} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {result.bom.warnings.length > 0 && (
            <div className="mb-3 rounded-md border border-yellow-300 bg-yellow-50 p-2 text-xs text-yellow-900">
              <div className="mb-1 flex items-center gap-1 font-medium">
                <AlertCircle className="h-3 w-3" />
                אזהרות:
              </div>
              <ul className="space-y-0.5">
                {result.bom.warnings.map((w, i) => (
                  <li key={i}>• {w}</li>
                ))}
              </ul>
            </div>
          )}

          {result.bom.instructionsSummary && (
            <div className="mb-3 text-xs">
              <div className="text-muted-foreground mb-1 font-medium">הוראות:</div>
              <p className="whitespace-pre-wrap">{result.bom.instructionsSummary}</p>
            </div>
          )}

          <div className="flex flex-row-reverse gap-2">
            <IfRole
              userRole={userRole}
              roles={['owner', 'manager', 'chef']}
              fallback={
                <span className="text-muted-foreground text-xs">
                  אין לך הרשאה ליצור מתכונים
                </span>
              }
            >
              <Button size="sm" onClick={handleAddToRecipes} disabled={adding}>
                {adding ? (
                  <>
                    <Loader2 className="ml-2 h-3 w-3 animate-spin" />
                    {progress ?? 'מוסיף...'}
                  </>
                ) : (
                  <>
                    <Plus className="ml-2 h-3 w-3" />
                    הוסף למתכונים
                  </>
                )}
              </Button>
            </IfRole>
            <Button size="sm" variant="outline" onClick={handleRetry} disabled={adding}>
              נסה שוב
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
