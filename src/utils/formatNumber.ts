/**
 * Formato numérico español: punto para miles, coma para decimales.
 * Ej: 1234567.89 → "1.234.567,89"
 */

const formatterInteger = new Intl.NumberFormat('es-ES', {
  maximumFractionDigits: 0,
})

/**
 * Formatea un número entero con puntos de miles (ej: 1234 → "1.234").
 * Si value es null o undefined, devuelve ''.
 */
export function formatInteger(value: number | null | undefined): string {
  if (value === null || value === undefined) return ''
  if (!Number.isFinite(value)) return ''
  return formatterInteger.format(value)
}

/**
 * Formatea un número con decimales al estilo español (miles con punto, decimales con coma).
 * maxDecimals: número de decimales (por defecto 2).
 */
export function formatDecimal(value: number | null | undefined, maxDecimals = 2): string {
  if (value === null || value === undefined) return ''
  if (!Number.isFinite(value)) return ''
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  }).format(value)
}
