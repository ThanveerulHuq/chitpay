import type { GroupDoc } from './types.js'

export interface GroupVisibility {
  showOtherMembers: boolean
  showOtherMemberDues: boolean
}

export function resolveGroupVisibility(
  group: Pick<GroupDoc, 'showOtherMembers' | 'showOtherMemberDues'>,
): GroupVisibility {
  const showOtherMembers = group.showOtherMembers !== false
  return {
    showOtherMembers,
    showOtherMemberDues: showOtherMembers && group.showOtherMemberDues !== false,
  }
}
