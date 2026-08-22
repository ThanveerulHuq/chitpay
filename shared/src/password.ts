const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
const GROUPS = 2
const GROUP_LEN = 4

/** Readable shareable code like K7PM-X2QF (no ambiguous 0/O/1/I/L). */
export function generateMemberPassword(
  random: () => number = () =>
    globalThis.crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32,
): string {
  const pick = () => ALPHABET[Math.floor(random() * ALPHABET.length)]
  const groups: string[] = []
  for (let g = 0; g < GROUPS; g++) {
    let s = ''
    for (let i = 0; i < GROUP_LEN; i++) s += pick()
    groups.push(s)
  }
  return groups.join('-')
}
