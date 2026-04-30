export type Role = 'owner' | 'manager' | 'chef' | 'staff';

const ROLE_HIERARCHY: Record<Role, number> = {
  owner: 4,
  manager: 3,
  chef: 2,
  staff: 1,
};

export function hasRole(userRole: Role | null | undefined, required: Role): boolean {
  if (!userRole) return false;
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[required];
}

export function isOwner(role: Role | null | undefined): boolean {
  return role === 'owner';
}

export function isManagerOrAbove(role: Role | null | undefined): boolean {
  return hasRole(role, 'manager');
}

export function isChefOrAbove(role: Role | null | undefined): boolean {
  return hasRole(role, 'chef');
}
