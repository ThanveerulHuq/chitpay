interface ContactPickerEntry {
  name?: string[]
  tel?: string[]
}

interface ContactsManagerLike {
  select(properties: Array<'name' | 'tel'>, options: { multiple: boolean }): Promise<ContactPickerEntry[]>
}

function contactsManager(): ContactsManagerLike | null {
  return (navigator as Navigator & { contacts?: ContactsManagerLike }).contacts ?? null
}

export function supportsContactPicker(): boolean {
  return typeof navigator !== 'undefined' && contactsManager() !== null
}

export function indianMobileNumber(value: string): string | null {
  const digits = value.replace(/\D/g, '')
  if (/^[6-9]\d{9}$/.test(digits)) return digits
  if (/^91[6-9]\d{9}$/.test(digits)) return digits.slice(2)
  if (/^0[6-9]\d{9}$/.test(digits)) return digits.slice(1)
  return null
}

export async function pickMobileContact(): Promise<{ name: string; phones: string[] } | null> {
  const manager = contactsManager()
  if (!manager) return null
  const selected = await manager.select(['name', 'tel'], { multiple: false })
  const contact = selected[0]
  if (!contact) return null
  const phones = [...new Set((contact.tel ?? []).map(indianMobileNumber).filter((phone): phone is string => Boolean(phone)))]
  return { name: contact.name?.[0]?.trim() ?? '', phones }
}
