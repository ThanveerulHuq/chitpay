/** All amounts in the system are integer minor units (e.g. paise). */

export function toMinor(amount: number): number {
  if (!Number.isFinite(amount)) throw new Error('Invalid amount')
  return Math.round(amount * 100)
}

export function fromMinor(minor: number): number {
  return minor / 100
}

export function formatMinor(minor: number): string {
  const major = minor / 100
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: minor % 100 === 0 ? 0 : 2,
    }).format(major)
  } catch {
    return `INR ${major.toFixed(2)}`
  }
}

/**
 * Backward compat for groups/memberships created before the paise migration.
 * Old docs stored `contributionAmountMinor` (and `currency`); new docs store
 * `contributionAmountInPaise`. Returns the canonical paise amount, or 0 if
 * neither field exists (so UI renders ₹0 instead of NaN).
 */
export function contributionInPaise(doc: {
  contributionAmountInPaise?: number
  contributionAmountMinor?: number
} | null | undefined): number {
  if (!doc) return 0
  if (typeof doc.contributionAmountInPaise === 'number') return doc.contributionAmountInPaise
  if (typeof doc.contributionAmountMinor === 'number') return doc.contributionAmountMinor
  return 0
}
