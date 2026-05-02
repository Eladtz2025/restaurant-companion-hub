'use client';

import { ChevronDown, Clock, Loader2, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getRecipeVersions, restoreRecipeVersion } from '@/lib/actions/recipes';
import { cn } from '@/lib/utils';

import type { RecipeVersion } from '@/lib/types';

interface RecipeVersionHistoryProps {
  tenantId: string;
  recipeId: string;
  canRestore: boolean;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('he-IL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function RecipeVersionHistory({
  tenantId,
  recipeId,
  canRestore,
}: RecipeVersionHistoryProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [versions, setVersions] = useState<RecipeVersion[]>([]);
  const [isLoading, startLoad] = useTransition();
  const [isRestoring, startRestore] = useTransition();
  const [pendingVersion, setPendingVersion] = useState<RecipeVersion | null>(null);

  function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next && !loaded) {
      startLoad(async () => {
        try {
          const data = await getRecipeVersions(tenantId, recipeId);
          setVersions(data);
          setLoaded(true);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'שגיאה בטעינת ההיסטוריה');
        }
      });
    }
  }

  function handleConfirmRestore() {
    if (!pendingVersion) return;
    const v = pendingVersion;
    startRestore(async () => {
      try {
        await restoreRecipeVersion(tenantId, recipeId, v.version);
        toast.success('הגרסה שוחזרה בהצלחה');
        setPendingVersion(null);
        // Reload versions list and page data
        const data = await getRecipeVersions(tenantId, recipeId);
        setVersions(data);
        router.refresh();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'שגיאה בשחזור הגרסה');
      }
    });
  }

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        className="hover:bg-muted/50 flex w-full items-center justify-between rounded-lg px-4 py-3 text-start"
        onClick={handleToggle}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          <h2 className="text-base font-semibold">היסטוריית גרסאות</h2>
          {versions.length > 0 && (
            <span className="text-muted-foreground text-xs">({versions.length})</span>
          )}
        </div>
        <ChevronDown
          className={cn('h-4 w-4 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <div className="border-t p-4">
          {isLoading ? (
            <div className="flex flex-col gap-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : versions.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">
              אין היסטוריית גרסאות עדיין
            </p>
          ) : (
            <ul className="flex flex-col divide-y">
              {versions.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <span>גרסה {v.version}</span>
                      <span className="text-muted-foreground text-xs">
                        {formatDate(v.createdAt)}
                      </span>
                    </div>
                    {v.changeNote && (
                      <p className="text-muted-foreground text-xs">{v.changeNote}</p>
                    )}
                  </div>
                  {canRestore && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setPendingVersion(v)}
                      disabled={isRestoring}
                    >
                      <RotateCcw className="me-2 h-4 w-4" />
                      שחזר
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <AlertDialog
        open={pendingVersion !== null}
        onOpenChange={(o) => {
          if (!o && !isRestoring) setPendingVersion(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>שחזור גרסה</AlertDialogTitle>
            <AlertDialogDescription>
              שחזור יחליף את כל רכיבי המתכון הנוכחי. פעולה זו אינה הפיכה.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRestoring}>ביטול</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRestore} disabled={isRestoring}>
              {isRestoring && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              שחזר
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
