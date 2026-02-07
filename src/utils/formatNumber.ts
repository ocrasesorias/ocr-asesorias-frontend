/**
 * Formato español: punto (.) para miles, coma (,) para decimales.
 * Ejemplos: 1345 → "1.345"  |  12098.45 → "12.098,45"
 *
 * @param value - Número, string numérico o null/undefined
 * @param maxDecimals - Decimales máximos (0 = entero). Por defecto 2.
 */
export function formatMiles(
  value: number | string | null | undefined,
  maxDecimals: number = 2
): string {
  if (value === null || value === undefined || value === '') return ''
  const n =
    typeof value === 'number'
      ? value
      : Number(String(value).trim().replace(',', '.'))
  if (!Number.isFinite(n)) return String(value ?? '').trim()
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  }).format(n)
}
