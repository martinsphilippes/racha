import { useEffect, useState, type InputHTMLAttributes } from 'react'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> & {
  value: number | null
  onChange: (value: number | null) => void
  decimal?: boolean
}

/**
 * Campo numérico que permite apagar tudo enquanto se digita.
 * Guarda o texto localmente e só repassa o número quando ele é válido
 * (evita o "0" que volta e vira "015" nos campos controlados).
 */
export default function NumberInput({ value, onChange, decimal = false, ...rest }: Props) {
  const [text, setText] = useState(value == null ? '' : String(value))

  // Sincroniza quando o valor muda por fora (ex.: carregamento do grupo).
  useEffect(() => {
    const current = text === '' ? null : Number(text.replace(',', '.'))
    if (value !== current && !(value == null && text === '')) setText(value == null ? '' : String(value))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <input
      type="text"
      inputMode={decimal ? 'decimal' : 'numeric'}
      autoComplete="off"
      {...rest}
      value={text}
      onChange={(e) => {
        const raw = e.target.value.replace(decimal ? /[^0-9.,]/g : /[^0-9]/g, '')
        setText(raw)
        if (raw === '' || raw === '.' || raw === ',') { onChange(null); return }
        const n = Number(raw.replace(',', '.'))
        if (!Number.isNaN(n)) onChange(n)
      }}
      onBlur={(e) => {
        // Normaliza ao sair do campo (remove zeros à esquerda, vírgula etc.).
        if (value != null) setText(String(value))
        rest.onBlur?.(e)
      }}
    />
  )
}
