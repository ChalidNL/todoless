import { pb } from '../lib/pocketbase';

export function usePermissions() {
  const role = (pb.authStore.record?.role as string) || 'member';

  return {
    canManageUsers: role === 'admin' || role === 'owner',
    canCreateSprints: role !== 'child',
    canDeleteOthersItems: role === 'admin' || role === 'owner',
    canSeeAllItems: role === 'admin' || role === 'owner',
    canManageRewards: role !== 'child',
    canEarnRewards: role === 'child',
    canAccessSettings: role !== 'child' && role !== 'agent',
    canAccessFullSettings: role === 'admin' || role === 'owner',
    isAdmin: role === 'admin' || role === 'owner',
    isChild: role === 'child',
    role,
  };
}
