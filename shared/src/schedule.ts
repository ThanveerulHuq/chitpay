import type { CycleFrequency, CycleStatus } from './types.js'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function isValidIsoDate(iso: string): boolean {
  if (!ISO_DATE.test(iso)) return false
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

function parseIsoDate(iso: string): { year: number; month: number; day: number } {
  if (!isValidIsoDate(iso)) throw new Error('Invalid start date.')
  const [year, month, day] = iso.split('-').map(Number)
  return { year, month, day }
}

function formatUtc(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function addDays(iso: string, days: number): string {
  const { year, month, day } = parseIsoDate(iso)
  return formatUtc(new Date(Date.UTC(year, month - 1, day + days)))
}

export function addMonthsClamped(iso: string, months: number): string {
  const { year, month, day } = parseIsoDate(iso)
  const anchor = new Date(Date.UTC(year, month - 1 + months, 1))
  const daysInMonth = new Date(
    Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0),
  ).getUTCDate()
  anchor.setUTCDate(Math.min(day, daysInMonth))
  return formatUtc(anchor)
}

export function generateCycleSchedule(
  startDate: string,
  frequency: CycleFrequency,
  cycleCount: number,
): string[] {
  parseIsoDate(startDate)
  if (!Number.isInteger(cycleCount) || cycleCount < 1) {
    throw new Error('Cycle count must be a positive integer.')
  }
  if (!['weekly', 'biweekly', 'monthly'].includes(frequency)) {
    throw new Error('Invalid cycle frequency.')
  }

  return Array.from({ length: cycleCount }, (_, index) => {
    if (frequency === 'weekly') return addDays(startDate, index * 7)
    if (frequency === 'biweekly') return addDays(startDate, index * 14)
    return addMonthsClamped(startDate, index)
  })
}

/**
 * Start-date edits are allowed only until the first cycle starts, i.e. while
 * cycle 1 still has status 'upcoming'. Once it becomes 'active'/'complete'
 * the whole schedule is anchored and must not shift.
 */
export function isStartDateEditable(
  cycles: readonly { cycleNumber: number; status: CycleStatus }[],
): boolean {
  const first = cycles.find((cycle) => cycle.cycleNumber === 1)
  return first?.status === 'upcoming'
}
