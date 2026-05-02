'use client';

import { Check, Link as LinkIcon, Loader2, Search, Unlink } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { linkRecipe } from '@/lib/actions/menu-items';
import { getRecipes } from '@/lib/actions/recipes';

import type { MenuItem, Recipe } from '@/lib/types';

interface Props {
  tenantId: string;
  item: MenuItem;
  onLinked: (item: MenuItem) => void;
  linkedRecipeName?: string | null;
}

export function LinkRecipePopover({ tenantId, item, onLinked, linkedRecipeName }: Props) {
  const [open, setOpen] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open || recipes !== null) return;
    setLoading(true);
    getRecipes(tenantId, 'menu')
      .then((r) => setRecipes(r))
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : 'שגיאה בטעינת המתכונים');
        setRecipes([]);
      })
      .finally(() => setLoading(false));
  }, [open, recipes, tenantId]);

  function handlePick(recipeId: string | null) {
    startTransition(async () => {
      try {
        const updated = await linkRecipe(tenantId, item.id, recipeId);
        onLinked(updated);
        toast.success(recipeId ? 'המתכון קושר' : 'הקישור הוסר');
        setOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'שגיאה בעדכון הקישור');
      }
    });
  }

  const filtered = (recipes ?? []).filter((r) =>
    r.nameHe.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {item.recipeId ? (
          <Button variant="ghost" size="sm" className="h-auto px-2 py-1 text-xs">
            <LinkIcon className="ml-1 h-3 w-3" />
            {linkedRecipeName ?? 'מתכון מקושר'}
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="h-7 text-xs">
            <LinkIcon className="ml-1 h-3 w-3" />
            קשר מתכון
          </Button>
        )}
      </PopoverTrigger>
      <PopoverContent dir="rtl" align="end" className="w-72 p-0">
        <div className="border-b p-2">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 right-2 h-4 w-4 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="חפש מתכון..."
              className="pr-8 text-right"
              dir="rtl"
            />
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground p-4 text-center text-xs">לא נמצאו מתכונים</p>
          ) : (
            <ul>
              {filtered.map((r) => {
                const isCurrent = r.id === item.recipeId;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => handlePick(r.id)}
                      className="hover:bg-accent flex w-full items-center justify-between px-3 py-2 text-right text-sm"
                    >
                      <span className="flex flex-col items-start">
                        <span>{r.nameHe}</span>
                        <span className="text-muted-foreground text-xs">
                          {r.type === 'menu' ? 'מנה' : 'הכנה'}
                        </span>
                      </span>
                      {isCurrent && <Check className="text-primary h-4 w-4" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        {item.recipeId && (
          <div className="border-t p-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive w-full justify-start"
              disabled={pending}
              onClick={() => handlePick(null)}
            >
              <Unlink className="ml-1 h-4 w-4" />
              הסר קישור
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
