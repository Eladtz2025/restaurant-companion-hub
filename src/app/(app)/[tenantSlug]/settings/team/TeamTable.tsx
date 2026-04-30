'use client';

import { useState } from 'react';

import { IfRole } from '@/components/shared/IfRole';

import { inviteMemberAction, removeMemberAction } from './actions';

import type { Role } from '@/lib/permissions';

const ROLE_LABELS: Record<string, string> = {
  owner: 'בעלים',
  manager: 'מנהל',
  chef: 'שף',
  staff: 'צוות',
};

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-purple-100 text-purple-700',
  manager: 'bg-blue-100 text-blue-700',
  chef: 'bg-green-100 text-green-700',
  staff: 'bg-gray-100 text-gray-600',
};

type Member = {
  id: string;
  userId: string;
  role: string;
  createdAt: string;
};

type Props = {
  members: Member[];
  tenantId: string;
  tenantSlug: string;
  currentUserId: string;
  currentUserRole: Role | null;
};

export function TeamTable({ members, tenantId, currentUserId, currentUserRole }: Props) {
  const [list, setList] = useState<Member[]>(members);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('staff');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);

  async function handleInvite() {
    if (!inviteEmail) return;
    setInviteLoading(true);
    setInviteError(null);
    const result = await inviteMemberAction(tenantId, '', inviteEmail, inviteRole);
    setInviteLoading(false);
    if (result.error) {
      setInviteError(result.error);
    } else {
      setShowInvite(false);
      setInviteEmail('');
    }
  }

  async function handleRemove(userId: string) {
    setRemoveError(null);
    const result = await removeMemberAction(tenantId, userId);
    if (result.error) {
      setRemoveError(result.error);
    } else {
      setList((prev) => prev.filter((m) => m.userId !== userId));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">{list.length} חברי צוות</p>
        <IfRole userRole={currentUserRole} roles={['owner']}>
          <button
            onClick={() => setShowInvite(true)}
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
          >
            הזמן חבר צוות
          </button>
        </IfRole>
      </div>

      {removeError && (
        <div
          role="alert"
          className="bg-destructive/10 text-destructive rounded-md px-3 py-2 text-sm"
        >
          {removeError}
        </div>
      )}

      <div className="rounded-xl border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-muted-foreground px-4 py-3 text-right font-medium">מזהה</th>
              <th className="text-muted-foreground px-4 py-3 text-right font-medium">תפקיד</th>
              <th className="text-muted-foreground px-4 py-3 text-right font-medium">
                תאריך הצטרפות
              </th>
              <IfRole userRole={currentUserRole} roles={['owner']}>
                <th className="text-muted-foreground px-4 py-3 text-right font-medium">פעולות</th>
              </IfRole>
            </tr>
          </thead>
          <tbody>
            {list.map((member) => (
              <tr key={member.id} className="border-b last:border-0">
                <td className="px-4 py-3 font-mono text-xs" dir="ltr">
                  {member.userId.slice(0, 8)}…
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_COLORS[member.role] ?? ROLE_COLORS.staff}`}
                  >
                    {ROLE_LABELS[member.role] ?? member.role}
                  </span>
                </td>
                <td className="text-muted-foreground px-4 py-3 text-xs">
                  {new Date(member.createdAt).toLocaleDateString('he-IL')}
                </td>
                <IfRole userRole={currentUserRole} roles={['owner']}>
                  <td className="px-4 py-3">
                    {member.userId !== currentUserId && (
                      <button
                        onClick={() => handleRemove(member.userId)}
                        className="text-destructive text-xs hover:underline"
                      >
                        הסר
                      </button>
                    )}
                  </td>
                </IfRole>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invite modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card w-full max-w-sm rounded-xl border p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">הזמן חבר צוות</h2>

            {inviteError && (
              <div
                role="alert"
                className="bg-destructive/10 text-destructive mb-3 rounded-md px-3 py-2 text-sm"
              >
                {inviteError}
              </div>
            )}

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="invite-email" className="text-sm font-medium">
                  אימייל
                </label>
                <input
                  id="invite-email"
                  type="email"
                  dir="ltr"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="bg-background focus:ring-ring rounded-md border px-3 py-2 text-sm outline-none focus:ring-2"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="invite-role" className="text-sm font-medium">
                  תפקיד
                </label>
                <select
                  id="invite-role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as Role)}
                  className="bg-background focus:ring-ring rounded-md border px-3 py-2 text-sm outline-none focus:ring-2"
                >
                  <option value="manager">מנהל</option>
                  <option value="chef">שף</option>
                  <option value="staff">צוות</option>
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleInvite}
                  disabled={inviteLoading || !inviteEmail}
                  className="bg-primary text-primary-foreground flex-1 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-60"
                >
                  {inviteLoading ? 'שולח...' : 'שלח הזמנה'}
                </button>
                <button
                  onClick={() => {
                    setShowInvite(false);
                    setInviteError(null);
                  }}
                  className="rounded-md border px-4 py-2 text-sm font-medium"
                >
                  ביטול
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
