// Geração do "PIX copia e cola" (BR Code / EMV-MPM), padrão do Banco Central.
// Não há integração bancária: o QR/código apenas pré-preenche o pagamento no app do banco.

function tlv(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, '0')}${value}`
}

function crc16(payload: string): string {
  let crc = 0xffff
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

/** Remove acentos e caracteres fora do padrão EMV; limita o tamanho. */
export function normalizePixText(text: string, max: number): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 .\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .slice(0, max)
}

export interface PixPayloadInput {
  key: string
  name: string
  city: string
  amount?: number | null
  txid?: string
}

export function buildPixPayload(input: PixPayloadInput): string {
  const name = normalizePixText(input.name, 25) || 'RACHA'
  const city = normalizePixText(input.city, 15) || 'BRASIL'
  const txid = (input.txid ?? '***').replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***'
  const merchantAccount = tlv('00', 'br.gov.bcb.pix') + tlv('01', input.key.trim())
  let payload =
    tlv('00', '01') +
    tlv('26', merchantAccount) +
    tlv('52', '0000') +
    tlv('53', '986')
  if (input.amount && input.amount > 0) payload += tlv('54', input.amount.toFixed(2))
  payload += tlv('58', 'BR') + tlv('59', name) + tlv('60', city) + tlv('62', tlv('05', txid))
  payload += '6304'
  return payload + crc16(payload)
}

export function formatPixKey(type: string | null, key: string): string {
  const digits = key.replace(/\D/g, '')
  if (type === 'cpf' && digits.length === 11) return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
  if (type === 'cnpj' && digits.length === 14) return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
  if (type === 'phone' && digits.length === 11) return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  return key
}

/** Chave no formato exigido pelo BR Code (telefone com +55, CPF/CNPJ só dígitos). */
export function pixKeyForPayload(type: string | null, key: string): string {
  const trimmed = key.trim()
  if (type === 'cpf' || type === 'cnpj') return trimmed.replace(/\D/g, '')
  if (type === 'phone') {
    const digits = trimmed.replace(/\D/g, '')
    return digits.startsWith('55') && digits.length >= 12 ? `+${digits}` : `+55${digits}`
  }
  return trimmed
}
