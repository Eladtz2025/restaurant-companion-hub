'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { importIngredientsAction } from '@/lib/actions/ingredients-import';

import type { ImportResult } from '@/lib/actions/ingredients.types';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
};

export function ImportCSVDialog({ open, onOpenChange, tenantId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [csvText, setCsvText] = useState('');
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);

  function reset() {
    setCsvText('');
    setFileName('');
    setResult(null);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    setCsvText(text);
  }

  function handleSubmit() {
    if (!csvText.trim()) {
      toast.error('יש לבחור קובץ או להדביק תוכן');
      return;
    }
    startTransition(async () => {
      const res = await importIngredientsAction(tenantId, csvText);
      setResult(res);
      if (res.imported > 0) {
        toast.success(`יובאו ${res.imported} מרכיבים`);
        router.refresh();
      } else if (res.errors.length > 0) {
        toast.error('הייבוא נכשל — בדוק שגיאות');
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>ייבוא מרכיבים מ-CSV</DialogTitle>
          <DialogDescription>
            העלה קובץ CSV עם עמודות: שם, יחידה, קטגוריה, מחיר ליחידה, כמות באריזה
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="csv-file">קובץ CSV</Label>
            <input
              id="csv-file"
              type="file"
              accept=".csv,text/csv"
              onChange={handleFile}
              className="file:bg-primary file:text-primary-foreground text-sm file:me-3 file:rounded-md file:border-0 file:px-3 file:py-2 file:text-sm file:font-medium"
            />
            {fileName && <p className="text-muted-foreground text-xs">נבחר: {fileName}</p>}
          </div>

          {result && (
            <div className="rounded-md border p-3 text-sm">
              <p className="font-medium">תוצאות:</p>
              <ul className="mt-2 space-y-1">
                <li>יובאו: {result.imported}</li>
                <li>דולגו (כפילויות): {result.skipped}</li>
                <li>שגיאות: {result.errors.length}</li>
              </ul>
              {result.errors.length > 0 && (
                <details className="mt-3">
                  <summary className="text-destructive cursor-pointer">הצג שגיאות</summary>
                  <ul className="text-destructive mt-2 max-h-40 space-y-1 overflow-auto text-xs">
                    {result.errors.map((e: string, i: number) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            סגור
          </Button>
          <Button onClick={handleSubmit} disabled={pending || !csvText}>
            {pending ? 'מייבא...' : 'ייבא'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
