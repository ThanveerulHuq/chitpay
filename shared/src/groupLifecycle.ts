import { AppError } from './errors.js'
import type { ArchivableGroupStatus, GroupDoc } from './types.js'

type ArchiveState = Pick<
  GroupDoc,
  'status' | 'statusBeforeArchive' | 'currentCycleNumber' | 'durationMonths'
>

export function assertGroupWritable(group: Pick<GroupDoc, 'status'>): void {
  if (group.status === 'archived') {
    throw new AppError('invalid_transition', 'Unarchive this group before making changes.')
  }
}

export function resolveUnarchiveStatus(group: ArchiveState): ArchivableGroupStatus {
  if (group.status !== 'archived') {
    throw new AppError('invalid_transition', 'This group is not archived.')
  }
  if (group.statusBeforeArchive === 'active' || group.statusBeforeArchive === 'completed') {
    return group.statusBeforeArchive
  }
  return group.currentCycleNumber >= group.durationMonths ? 'completed' : 'active'
}
