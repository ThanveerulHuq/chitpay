import type { CycleStatus } from './types.js'

const TRANSITIONS: Record<CycleStatus, CycleStatus[]> = {
  upcoming: ['active'],
  active: ['complete'],
  complete: [],
}

export function canTransition(from: CycleStatus, to: CycleStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false
}

export function assertTransition(from: CycleStatus, to: CycleStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid cycle transition: ${from} -> ${to}`)
  }
}
