import { describe, it, expect } from 'vitest'
import { validarNifCif, validarDNI, validarNIE, validarCIF } from './validarNifCif'

// ============================================================
// validarDNI
// ============================================================

describe('validarDNI', () => {
  it('acepta DNI válido (12345678Z)', () => {
    expect(validarDNI('12345678Z')).toBe(true)
  })

  it('rechaza DNI con letra incorrecta', () => {
    expect(validarDNI('12345678A')).toBe(false)
  })

  it('rechaza formato incorrecto', () => {
    expect(validarDNI('1234567Z')).toBe(false) // 7 dígitos
    expect(validarDNI('123456789Z')).toBe(false) // 9 dígitos
  })

  it('acepta con espacios (se normalizan)', () => {
    expect(validarDNI('1234 5678Z')).toBe(true)
  })

  it('acepta minúsculas (se normalizan)', () => {
    expect(validarDNI('12345678z')).toBe(true)
  })

  it('DNI 00000000T es válido (0 % 23 = 0 → T)', () => {
    expect(validarDNI('00000000T')).toBe(true)
  })
})

// ============================================================
// validarNIE
// ============================================================

describe('validarNIE', () => {
  it('acepta NIE válido X0000000T', () => {
    // X → 0, entonces 00000000 % 23 = 0 → T
    expect(validarNIE('X0000000T')).toBe(true)
  })

  it('acepta NIE con Y', () => {
    // Y → 1, entonces 10000000 % 23 = 14 → letra Z
    expect(validarNIE('Y0000000Z')).toBe(true)
  })

  it('rechaza NIE con letra incorrecta', () => {
    expect(validarNIE('X0000000A')).toBe(false)
  })

  it('rechaza formato incorrecto', () => {
    expect(validarNIE('A0000000T')).toBe(false) // no empieza por X/Y/Z
  })
})

// ============================================================
// validarCIF
// ============================================================

describe('validarCIF', () => {
  it('acepta CIF válido A58818501', () => {
    expect(validarCIF('A58818501')).toBe(true)
  })

  it('rechaza CIF con dígito de control incorrecto', () => {
    expect(validarCIF('A58818502')).toBe(false)
  })

  it('rechaza formato incorrecto', () => {
    expect(validarCIF('12345678Z')).toBe(false) // es un DNI
    expect(validarCIF('X0000000T')).toBe(false) // es un NIE
  })

  it('acepta con espacios', () => {
    expect(validarCIF('A 5881 8501')).toBe(true)
  })
})

// ============================================================
// validarNifCif (auto-detect)
// ============================================================

describe('validarNifCif', () => {
  it('devuelve inválido para string vacío', () => {
    const r = validarNifCif('')
    expect(r.valido).toBe(false)
    expect(r.error).toBeDefined()
  })

  it('detecta y valida DNI', () => {
    const r = validarNifCif('12345678Z')
    expect(r.valido).toBe(true)
    expect(r.tipo).toBe('DNI')
  })

  it('detecta y rechaza DNI con letra incorrecta', () => {
    const r = validarNifCif('12345678A')
    expect(r.valido).toBe(false)
    expect(r.tipo).toBe('DNI')
    expect(r.error).toContain('módulo 23')
  })

  it('detecta y valida NIE', () => {
    const r = validarNifCif('X0000000T')
    expect(r.valido).toBe(true)
    expect(r.tipo).toBe('NIE')
  })

  it('detecta y valida CIF', () => {
    const r = validarNifCif('A58818501')
    expect(r.valido).toBe(true)
    expect(r.tipo).toBe('CIF')
  })

  it('rechaza formato no reconocido', () => {
    const r = validarNifCif('XXXX')
    expect(r.valido).toBe(false)
    expect(r.error).toContain('Formato no válido')
  })

  it('rechaza código postal como NIF', () => {
    const r = validarNifCif('28001')
    expect(r.valido).toBe(false)
  })
})
