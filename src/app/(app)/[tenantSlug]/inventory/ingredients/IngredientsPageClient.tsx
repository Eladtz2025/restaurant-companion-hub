'use client';

import { Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';

import { PageHeader } from '@/components/shared/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency } from '@/lib/ui-utils';

import { DeleteIngredientDialog } from './DeleteIngredientDialog';
import { ImportCSVDialog } from './ImportCSVDialog';
import { IngredientFormSheet } from './IngredientFormSheet';

import type { Ingredient, IngredientCategory, IngredientUnit } from '@/lib/types';

const CATEGORY_LABELS: Record<IngredientCategory, string> = {
  produce: 'ירקות ופירות',
  meat: 'בשר',
  fish: 'דגים',
  dairy: 'חלב',
  dry: 'יבש',
  alcohol: 'אלכוהול',
  other: 'אחר',
};

const UNIT_LABELS: Record<IngredientUnit, string> = {
  kg: 'ק"ג',
  g: 'גרם',
  l: 'ליטר',
  ml: 'מ"ל',
  unit: "יח'",
  pkg: 'אריזה',
};

const TABS: { value: string; label: string }[] = [
  { value: 'all', label: 'הכל' },
  { value: 'produce', label: 'ירקות ופירות' },
  { value: 'meat', label: 'בשר' },
  { value: 'fish', label: 'דגים' },
  { value: 'dairy', label: 'חלב' },
  { value: 'dry', label: 'יבש' },
  { value: 'alcohol', label: 'אלכוהול' },
  { value: 'other', label: 'אחר' },
];

type Props = {
  tenantId: string;
  initialIngredients: Ingredient[];
  initialError: string | null;
  currentSearch: string;
  currentCategory: string;
};

export function IngredientsPageClient({
  tenantId,
  initialIngredients,
  initialError,
  currentSearch,
  currentCategory,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [searchInput, setSearchInput] = useState(currentSearch);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Ingredient | null>(null);
  const [deleting, setDeleting] = useState<Ingredient | null>(null);

  // Debounced search → URL
  useEffect(() => {
    if (searchInput === currentSearch) return;
    const t = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (searchInput) params.set('search', searchInput);
      else params.delete('search');
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`);
      });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  function setCategory(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== 'all') params.set('category', value);
    else params.delete('category');
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="מרכיבים"
        subtitle="ניהול רשימת המרכיבים של המסעדה"
        actions={
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="me-2 h-4 w-4" />
              ייבוא CSV
            </Button>
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="me-2 h-4 w-4" />
              הוסף מרכיב
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-3">
        <Input
          placeholder="חיפוש לפי שם..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="max-w-sm"
        />

        <Tabs value={currentCategory} onValueChange={setCategory}>
          <TabsList className="h-auto flex-wrap">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {initialError ? (
        <div className="border-destructive/50 bg-destructive/10 text-destructive rounded-md border p-4 text-sm">
          שגיאה בטעינת המרכיבים: {initialError}
        </div>
      ) : initialIngredients.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center">
          <p className="text-muted-foreground">אין מרכיבים להצגה</p>
          <Button
            className="mt-4"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="me-2 h-4 w-4" />
            הוסף את המרכיב הראשון
          </Button>
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>שם</TableHead>
                <TableHead>קטגוריה</TableHead>
                <TableHead>יחידה</TableHead>
                <TableHead>מחיר ליחידה</TableHead>
                <TableHead>כמות באריזה</TableHead>
                <TableHead className="text-end">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialIngredients.map((ing) => (
                <TableRow key={ing.id}>
                  <TableCell className="font-medium">{ing.nameHe}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{CATEGORY_LABELS[ing.category]}</Badge>
                  </TableCell>
                  <TableCell>{UNIT_LABELS[ing.unit]}</TableCell>
                  <TableCell>{formatCurrency(ing.costPerUnitCents)}</TableCell>
                  <TableCell>{ing.pkgQty ?? '—'}</TableCell>
                  <TableCell className="text-end">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditing(ing);
                          setFormOpen(true);
                        }}
                        aria-label="ערוך"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleting(ing)}
                        aria-label="מחק"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <IngredientFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        tenantId={tenantId}
        ingredient={editing}
      />

      <ImportCSVDialog open={importOpen} onOpenChange={setImportOpen} tenantId={tenantId} />

      <DeleteIngredientDialog
        ingredient={deleting}
        onClose={() => setDeleting(null)}
        tenantId={tenantId}
      />
    </div>
  );
}
