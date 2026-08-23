import type { CycleStatus } from './types.js'

export type CycleStartBlockReason = 'no_active_members' | 'previous_cycle_upcoming'

interface CycleStartState {
  cycleNumber: number
  status: CycleStatus
}

export function getCycleStartBlockReason(
  activeMemberCount: number,
  cycleNumber: number,
  cycles: readonly CycleStartState[],
): CycleStartBlockReason | null {
  if (activeMemberCount < 1) return 'no_active_members'

  for (let previousNumber = 1; previousNumber < cycleNumber; previousNumber += 1) {
    const previousCycle = cycles.find((cycle) => cycle.cycleNumber === previousNumber)
    if (!previousCycle || previousCycle.status === 'upcoming') {
      return 'previous_cycle_upcoming'
    }
  }

  return null
}
