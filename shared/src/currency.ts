/** All amounts in the system are integer minor units (e.g. paise). */

export function toMinor(amount: number): number {
  if (!Number.isFinite(amount)) throw new Error('Invalid amount')
  return Math.round(amount * 100)
}

export function fromMinor(minor: number): number {
  return minor / 100
}

export function formatMinor(minor: number, currency = 'INR'): string {
  const major = minor / 100
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: minor % 100 === 0 ? 0 : 2,
    }).format(major)
  } catch {
    return `${currency} ${major.toFixed(2)}`
  }
}
