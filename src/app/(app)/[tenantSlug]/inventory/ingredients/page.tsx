import { getIngredients } from '@/lib/actions/ingredients';
import { requireTenant } from '@/lib/tenant';

import { IngredientsPageClient } from './IngredientsPageClient';

import type { IngredientCategory } from '@/lib/types';

const CATEGORIES: IngredientCategory[] = [
  'produce',
  'meat',
  'fish',
  'dairy',
  'dry',
  'alcohol',
  'other',
];

type SearchParams = Promise<{ search?: string; category?: string }>;

export default async function IngredientsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: SearchParams;
}) {
  const { tenantSlug } = await params;
  const sp = await searchParams;
  const tenant = await requireTenant(tenantSlug);

  const search = sp.search?.trim() || undefined;
  const category =
    sp.category && CATEGORIES.includes(sp.category as IngredientCategory)
      ? (sp.category as IngredientCategory)
      : undefined;

  const result = await getIngredients(tenant.id, { search, category });
  const ingredients = 'data' in result ? result.data : [];
  const error = 'error' in result ? result.error : null;

  return (
    <IngredientsPageClient
      tenantId={tenant.id}
      initialIngredients={ingredients}
      initialError={error}
      currentSearch={search ?? ''}
      currentCategory={category ?? 'all'}
    />
  );
}
