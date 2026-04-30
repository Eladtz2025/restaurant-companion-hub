import type { Role } from '@/lib/permissions';

type Props = {
  userRole: Role | null | undefined;
  roles: Role[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
};

/**
 * Conditionally renders children when userRole is included in roles.
 * Use the fallback prop to render alternative content for unauthorized roles.
 */
export function IfRole({ userRole, roles, children, fallback = null }: Props) {
  if (!userRole || !roles.includes(userRole)) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
}
