const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sem 0/O/1/I para evitar confusão

export function inviteCode(length = 6): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}

export function newId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 20)
}
