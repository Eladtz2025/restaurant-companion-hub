'use client';

import { Camera, Loader2, Trash2, Upload } from 'lucide-react';
import { useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { updateRecipe } from '@/lib/actions/recipes';
import { deleteRecipeImage, uploadRecipeImage } from '@/lib/storage/recipe-images';

const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

interface RecipeImageUploadProps {
  tenantId: string;
  recipeId: string;
  imageUrl: string | null | undefined;
  onImageChange: (newUrl: string | null) => void;
  canEdit: boolean;
}

export function RecipeImageUpload({
  tenantId,
  recipeId,
  imageUrl,
  onImageChange,
  canEdit,
}: RecipeImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, startUpload] = useTransition();
  const [isRemoving, startRemove] = useTransition();
  const [, setTick] = useState(0);

  function handlePick() {
    inputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!ACCEPTED.includes(file.type)) {
      toast.error('סוג קובץ לא נתמך — JPEG, PNG או WebP בלבד');
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      toast.error('קובץ גדול מדי — מקסימום 5MB');
      return;
    }

    startUpload(async () => {
      try {
        const url = await uploadRecipeImage(tenantId, recipeId, file);
        await updateRecipe(tenantId, recipeId, { imageUrl: url });
        onImageChange(url);
        toast.success('התמונה הועלתה');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'שגיאה בהעלאת התמונה');
      }
    });
  }

  function handleRemove() {
    startRemove(async () => {
      try {
        await deleteRecipeImage(tenantId, recipeId);
        await updateRecipe(tenantId, recipeId, { imageUrl: null });
        onImageChange(null);
        setTick((t) => t + 1);
        toast.success('התמונה הוסרה');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'שגיאה בהסרת התמונה');
      }
    });
  }

  const busy = isUploading || isRemoving;

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />

      {imageUrl ? (
        <div className="flex flex-col gap-2" style={{ maxWidth: 400 }}>
          <div
            className="relative w-full overflow-hidden rounded-md border"
            style={{ aspectRatio: '16 / 9' }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="תמונת מתכון" className="h-full w-full object-cover" />
            {isUploading && (
              <div className="bg-background/60 absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            )}
          </div>
          {canEdit && (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePick}
                disabled={busy}
              >
                {isUploading ? (
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="me-2 h-4 w-4" />
                )}
                החלף תמונה
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRemove}
                disabled={busy}
              >
                {isRemoving ? (
                  <Loader2 className="me-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="me-2 h-4 w-4" />
                )}
                הסר תמונה
              </Button>
            </div>
          )}
        </div>
      ) : (
        canEdit && (
          <div
            className="flex w-full items-center justify-center rounded-md border border-dashed"
            style={{ maxWidth: 400, aspectRatio: '16 / 9' }}
          >
            <Button type="button" variant="ghost" onClick={handlePick} disabled={busy}>
              {isUploading ? (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              ) : (
                <Camera className="me-2 h-4 w-4" />
              )}
              העלה תמונה
            </Button>
          </div>
        )
      )}
    </div>
  );
}
