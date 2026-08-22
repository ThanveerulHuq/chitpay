/** Builds a wa.me deep link with a pre-filled message. */
export function whatsappLink(phone: string, message: string): string {
  const digits = phone.replace(/[^0-9]/g, '')
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}
