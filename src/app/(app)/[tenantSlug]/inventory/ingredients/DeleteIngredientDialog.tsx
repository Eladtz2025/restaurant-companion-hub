'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
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
import { deleteIngredient } from '@/lib/actions/ingredients';

import type { Ingredient } from '@/lib/types';

type Props = {
  ingredient: Ingredient | null;
  onClose: () => void;
  tenantId: string;
};

export function DeleteIngredientDialog({ ingredient, onClose, tenantId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!ingredient) return;
    startTransition(async () => {
      const result = await deleteIngredient(tenantId, ingredient.id);
      if ('error' in result) {
        toast.error(`שגיאה במחיקה: ${result.error}`);
        return;
      }
      toast.success('המרכיב נמחק');
      onClose();
      router.refresh();
    });
  }

  return (
    <AlertDialog open={ingredient !== null} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>מחיקת מרכיב</AlertDialogTitle>
          <AlertDialogDescription>
            האם אתה בטוח שברצונך למחוק את &quot;{ingredient?.nameHe}&quot;? מחיקת מרכיב תשפיע על
            מתכונים קיימים.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>ביטול</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={pending}>
            {pending ? 'מוחק...' : 'מחק'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
