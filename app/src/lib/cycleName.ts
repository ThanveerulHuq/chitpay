import type { CycleFrequency, GroupDoc } from '@shared'
import { generateCycleSchedule } from '@shared'
import type { TranslationKey } from '@/i18n'

type Translate = (key: TranslationKey, params?: Record<string, string | number>) => string

export function formatCycleName(
  plannedStartDate: string,
  frequency: CycleFrequency,
  locale: string,
  t: Translate,
): string {
  const [, , day] = plannedStartDate.split('-').map(Number)
  const date = new Date(`${plannedStartDate}T00:00:00Z`)
  const month = new Intl.DateTimeFormat(locale, {
    month: 'long',
    timeZone: 'UTC',
  }).format(date)

  if (frequency === 'monthly') return month

  return t('workspace.weekCycleName', {
    month,
    week: Math.ceil(day / 7),
  })
}

export function plannedDateForCycle(group: GroupDoc, cycleNumber: number): string {
  return generateCycleSchedule(group.startDate, group.frequency, cycleNumber)[cycleNumber - 1]
}
