'use server';

import { getAuthContext } from '@/lib/supabase/server';
import { createServiceSupabaseClient } from '@/lib/supabase/service';
import { assertRole, getUserRole } from '@/lib/tenant';

import type { Role } from '@/lib/permissions';

export async function inviteMemberAction(
  tenantId: string,
  tenantSlug: string,
  email: string,
  role: Role,
) {
  const ctx = await getAuthContext();
  if (!ctx) return { error: 'לא מחובר' };

  const callerRole = await getUserRole(tenantId, ctx.userId);
  try {
    assertRole(callerRole, 'owner');
  } catch {
    return { error: 'רק בעלים יכולים להזמין חברי צוות' };
  }

  const service = createServiceSupabaseClient();

  const { error } = await service.auth.admin.inviteUserByEmail(email, {
    data: { tenantSlug, role },
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/accept-invite`,
  });

  if (error) {
    if (error.message.includes('already been registered')) {
      // User exists — add them directly to the tenant.
      const { data: existingUser } = await service.auth.admin.listUsers();
      const user = existingUser.users.find((u) => u.email === email);
      if (!user) return { error: 'משתמש לא נמצא' };

      const { error: insertError } = await service
        .from('memberships')
        .insert({ tenant_id: tenantId, user_id: user.id, role });

      if (insertError) {
        if (insertError.code === '23505') {
          return { error: 'המשתמש כבר חבר בצוות' };
        }
        return { error: 'שגיאה בהוספת חבר צוות' };
      }

      return { success: true };
    }
    return { error: 'שגיאה בשליחת ההזמנה. נסה שוב.' };
  }

  return { success: true };
}

export async function removeMemberAction(tenantId: string, memberUserId: string) {
  const ctx = await getAuthContext();
  if (!ctx) return { error: 'לא מחובר' };

  if (ctx.userId === memberUserId) {
    return { error: 'לא ניתן להסיר את עצמך מהצוות' };
  }

  const callerRole = await getUserRole(tenantId, ctx.userId);
  try {
    assertRole(callerRole, 'owner');
  } catch {
    return { error: 'רק בעלים יכולים להסיר חברי צוות' };
  }

  // Guard: cannot remove the last owner.
  const service = createServiceSupabaseClient();
  const { data: owners } = await service
    .from('memberships')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('role', 'owner');

  const targetRole = await getUserRole(tenantId, memberUserId);
  if (targetRole === 'owner' && (owners?.length ?? 0) <= 1) {
    return { error: 'לא ניתן להסיר את הבעלים האחרון' };
  }

  const { error } = await service
    .from('memberships')
    .delete()
    .eq('tenant_id', tenantId)
    .eq('user_id', memberUserId);

  if (error) return { error: 'שגיאה בהסרת חבר הצוות' };

  return { success: true };
}
