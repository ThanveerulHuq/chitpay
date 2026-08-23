import { describe, expect, it } from 'vitest'
import { AppError } from './errors.js'
import { assertGroupWritable, resolveUnarchiveStatus } from './groupLifecycle.js'

describe('group archive lifecycle', () => {
  it('allows writes to active and completed groups', () => {
    expect(() => assertGroupWritable({ status: 'active' })).not.toThrow()
    expect(() => assertGroupWritable({ status: 'completed' })).not.toThrow()
  })

  it('blocks writes to archived groups', () => {
    expect(() => assertGroupWritable({ status: 'archived' })).toThrow(AppError)
  })

  it.each(['active', 'completed'] as const)(
    'restores the recorded %s status',
    (statusBeforeArchive) => {
      expect(resolveUnarchiveStatus({
        status: 'archived',
        statusBeforeArchive,
        currentCycleNumber: 1,
        durationMonths: 10,
      })).toBe(statusBeforeArchive)
    },
  )

  it('infers a safe status for legacy archived groups', () => {
    expect(resolveUnarchiveStatus({
      status: 'archived',
      currentCycleNumber: 4,
      durationMonths: 4,
    })).toBe('completed')
    expect(resolveUnarchiveStatus({
      status: 'archived',
      currentCycleNumber: 2,
      durationMonths: 4,
    })).toBe('active')
  })

  it('rejects restore attempts for non-archived groups', () => {
    expect(() => resolveUnarchiveStatus({
      status: 'active',
      currentCycleNumber: 0,
      durationMonths: 4,
    })).toThrow(AppError)
  })
})
