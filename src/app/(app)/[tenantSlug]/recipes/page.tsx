import { getIngredients } from '@/lib/actions/ingredients';
import { getRecipes } from '@/lib/actions/recipes';
import { getAuthContext } from '@/lib/supabase/server';
import { getUserRole, requireTenant } from '@/lib/tenant';

import { RecipesClient } from './_components/RecipesClient';

import type { Role } from '@/lib/permissions';

export default async function RecipesPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const tenant = await requireTenant(tenantSlug);
  const ctx = await getAuthContext();
  const role: Role | null = ctx ? await getUserRole(tenant.id, ctx.userId) : null;

  const [recipes, ingredientsResult] = await Promise.all([
    getRecipes(tenant.id),
    getIngredients(tenant.id),
  ]);
  const ingredients = 'data' in ingredientsResult ? ingredientsResult.data : [];

  return (
    <RecipesClient
      tenantId={tenant.id}
      tenantSlug={tenantSlug}
      userRole={role}
      initialRecipes={recipes}
      ingredients={ingredients}
    />
  );
}
