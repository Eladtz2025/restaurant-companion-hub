'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import { updateTenantName } from '@/lib/actions/tenants';

type Props = {
  tenantId: string;
  initialName: string;
  canEdit: boolean;
};

export function TenantSettingsForm({ tenantId, initialName, canEdit }: Props) {
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const dirty = name.trim() !== initialName;

  async function handleSave() {
    if (!dirty) return;
    setSaving(true);
    try {
      await updateTenantName(tenantId, name);
      toast.success('שם המסעדה עודכן');
    } catch {
      toast.error('שגיאה בשמירה');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium">שם המסעדה</label>
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={!canEdit}
          maxLength={100}
          className="bg-background focus:ring-ring flex-1 rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 disabled:opacity-60"
        />
        {canEdit && (
          <button
            onClick={handleSave}
            disabled={!dirty || saving}
            className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-50"
          >
            {saving ? 'שומר...' : 'שמור'}
          </button>
        )}
      </div>
    </div>
  );
}
