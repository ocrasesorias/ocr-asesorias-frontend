/**
 * Validación de NIF/CIF españoles.
 * - DNI: 8 dígitos + letra (módulo 23).
 * - NIE: X/Y/Z + 7 dígitos + letra (misma regla que DNI tras sustituir letra inicial).
 * - CIF: 1 letra (tipo entidad) + 7 dígitos + dígito/letra de control.
 */

/** Letras del DNI según resto módulo 23 (0→T, 1→R, 2→W, ...). */
const LETRAS_DNI = 'TRWAGMYFPDXBNJZSQVHLCKE';

/**
 * Normaliza un valor para validar: quita espacios y convierte a mayúsculas.
 */
function normalizar(val: string): string {
  return String(val || '').replace(/\s/g, '').toUpperCase().trim();
}

/**
 * Comprueba si un DNI (8 dígitos + letra) es válido según el algoritmo módulo 23.
 */
export function validarDNI(dni: string): boolean {
  const n = normalizar(dni);
  if (!/^\d{8}[A-Z]$/.test(n)) return false;
  const num = parseInt(n.slice(0, 8), 10);
  const letra = n.slice(8, 9);
  const resto = num % 23;
  return LETRAS_DNI[resto] === letra;
}

/**
 * Comprueba si un NIE (X/Y/Z + 7 dígitos + letra) es válido.
 * Se sustituye la letra inicial por 0 (X), 1 (Y) o 2 (Z) y se aplica la misma regla que el DNI.
 */
export function validarNIE(nie: string): boolean {
  const n = normalizar(nie);
  if (!/^[XYZ]\d{7}[A-Z]$/.test(n)) return false;
  const mapa: Record<string, string> = { X: '0', Y: '1', Z: '2' };
  const numStr = mapa[n[0]] + n.slice(1, 8);
  const num = parseInt(numStr, 10);
  const letra = n.slice(8, 9);
  const resto = num % 23;
  return LETRAS_DNI[resto] === letra;
}

/** Tipos de entidad CIF que pueden llevar letra en el dígito de control (A, B, E, H). */
const CIF_CONTROL_LETRA = new Set(['A', 'B', 'E', 'H']);

/** Conversión letra → número para el dígito de control del CIF (J=0, A=1, ..., I=9). */
const CIF_LETRA_A_NUM: Record<string, number> = {
  J: 0, A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8, I: 9,
};

/**
 * Comprueba si un CIF es estructuralmente correcto.
 * Formato: 1 letra (tipo) + 7 dígitos + 1 dígito o letra de control.
 * - Suma de dígitos en posiciones pares (2ª, 4ª, 6ª).
 * - Dígitos en posiciones impares (1ª, 3ª, 5ª, 7ª): cada uno ×2 y sumar los dígitos del resultado.
 * - Dígito de control = 10 - (última cifra del total). Si sale 10, se usa 0 (o letra J).
 * - Si el tipo de entidad usa letra (A, B, E, H), el control puede ser letra (J=0, A=1, ..., I=9).
 */
export function validarCIF(cif: string): boolean {
  const c = normalizar(cif);
  // Formato: 1 letra + 8 caracteres (7 dígitos + 1 de control que puede ser dígito o letra)
  if (!/^[A-HJ-NP-SUVW]\d{7}[\dA-J]$/.test(c)) return false;

  const digitos = c.slice(1, 8); // 7 dígitos
  const controlChar = c.slice(8, 9);

  // Sumar posiciones pares (2ª, 4ª, 6ª) → índices 1, 3, 5
  let sumaPares = 0;
  for (let i = 1; i <= 5; i += 2) {
    sumaPares += parseInt(digitos[i], 10);
  }

  // Posiciones impares (1ª, 3ª, 5ª, 7ª) → índices 0, 2, 4, 6: multiplicar por 2 y sumar dígitos del resultado
  let sumaImpares = 0;
  for (let i = 0; i <= 6; i += 2) {
    const d = parseInt(digitos[i], 10);
    const doble = d * 2;
    const str = String(doble);
    for (const ch of str) sumaImpares += parseInt(ch, 10);
  }

  const total = sumaPares + sumaImpares;
  const ultimaCifra = total % 10;
  const controlCalculado = ultimaCifra === 0 ? 0 : 10 - ultimaCifra; // 0-9

  // El carácter de control puede ser dígito '0'-'9' o letra J,A,...,I
  let controlValor: number;
  if (/^\d$/.test(controlChar)) {
    controlValor = parseInt(controlChar, 10);
  } else {
    controlValor = CIF_LETRA_A_NUM[controlChar] ?? -1;
  }
  return controlValor === controlCalculado;
}

export type TipoNifCif = 'DNI' | 'NIE' | 'CIF';

export interface ResultadoValidacionNifCif {
  valido: boolean;
  tipo?: TipoNifCif;
  error?: string;
}

/**
 * Determina si el valor es un NIF de persona (DNI o NIE) o un CIF (entidad).
 * Si está vacío se considera inválido (campo obligatorio).
 */
export function validarNifCif(value: string): ResultadoValidacionNifCif {
  const v = normalizar(value);
  if (!v) return { valido: false, error: 'El CIF/NIF es obligatorio.' };

  // CIF: empieza por letra de entidad (no X,Y,Z para no confundir con NIE)
  if (/^[A-HJ-NP-SUVW]\d{7}[\dA-J]$/.test(v)) {
    const valido = validarCIF(value);
    return {
      valido,
      tipo: 'CIF',
      error: valido ? undefined : 'CIF incorrecto: dígito de control no válido.',
    };
  }

  // DNI: 8 dígitos + letra
  if (/^\d{8}[A-Z]$/.test(v)) {
    const valido = validarDNI(value);
    return {
      valido,
      tipo: 'DNI',
      error: valido ? undefined : 'DNI incorrecto: la letra no corresponde al número (módulo 23).',
    };
  }

  // NIE: X/Y/Z + 7 dígitos + letra
  if (/^[XYZ]\d{7}[A-Z]$/.test(v)) {
    const valido = validarNIE(value);
    return {
      valido,
      tipo: 'NIE',
      error: valido ? undefined : 'NIE incorrecto: la letra no corresponde al número.',
    };
  }

  return {
    valido: false,
    error: 'Formato no válido. Use DNI (8 dígitos + letra), NIE (X/Y/Z + 7 dígitos + letra) o CIF (letra + 8 caracteres).',
  };
}
