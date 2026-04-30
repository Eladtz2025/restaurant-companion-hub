'use client';

import { createContext, useContext } from 'react';

import type { Role } from '@/lib/permissions';

export type TenantContextValue = {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  userRole: Role;
  userId: string;
};

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({
  value,
  children,
}: {
  value: TenantContextValue;
  children: React.ReactNode;
}) {
  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within TenantProvider');
  return ctx;
}
