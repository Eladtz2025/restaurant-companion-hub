import { notFound } from 'next/navigation';

import { getIngredients } from '@/lib/actions/ingredients';
import { getRecipeWithComponents, getRecipes } from '@/lib/actions/recipes';
import { getAuthContext } from '@/lib/supabase/server';
import { getUserRole, requireTenant } from '@/lib/tenant';

import { RecipeEditorClient } from './_components/RecipeEditorClient';

import type { Role } from '@/lib/permissions';

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; id: string }>;
}) {
  const { tenantSlug, id } = await params;
  const tenant = await requireTenant(tenantSlug);
  const ctx = await getAuthContext();
  const role: Role | null = ctx ? await getUserRole(tenant.id, ctx.userId) : null;

  const recipe = await getRecipeWithComponents(tenant.id, id);
  if (!recipe) notFound();

  const [ingredientsResult, prepRecipes] = await Promise.all([
    getIngredients(tenant.id),
    getRecipes(tenant.id, 'prep'),
  ]);
  const ingredients = 'data' in ingredientsResult ? ingredientsResult.data : [];

  return (
    <RecipeEditorClient
      tenantId={tenant.id}
      tenantSlug={tenantSlug}
      userRole={role}
      recipe={recipe}
      ingredients={ingredients}
      prepRecipes={prepRecipes.filter((r) => r.id !== recipe.id)}
    />
  );
}
