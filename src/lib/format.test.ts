import { describe, expect, it } from 'vitest'
import {
  decimalInputValue,
  formatCop,
  formatDate,
  formatPercent,
  formatPhone,
  formatTrm,
  formatUsd,
  parseCop,
  parseDecimal,
  parsePercent,
  percentInputValue,
  phoneDigits,
  todayBogota,
} from './format'

// Intl usa espacio no separable entre el símbolo y el número.
const plain = (s: string) => s.replace(/ /g, ' ')

describe('formatos es-CO', () => {
  it('COP con punto de miles y sin decimales', () => {
    expect(plain(formatCop(1_234_567))).toBe('$ 1.234.567')
    expect(plain(formatCop(0))).toBe('$ 0')
    expect(plain(formatCop(-3_900))).toBe('-$ 3.900')
  })

  it('USD con dos decimales', () => {
    expect(plain(formatUsd(7.99))).toBe('US$ 7,99')
    expect(plain(formatUsd(10))).toBe('US$ 10,00')
  })

  it('TRM con miles y decimales', () => {
    expect(formatTrm(4123.45)).toBe('4.123,45')
    expect(formatTrm(4000)).toBe('4.000')
  })

  it('porcentaje desde fracción', () => {
    expect(formatPercent(0.4)).toBe('40 %')
    expect(formatPercent(0.355)).toBe('35,5 %')
  })

  it('fecha dd/MM/yyyy sin desfase de zona horaria', () => {
    expect(formatDate('2026-10-22')).toBe('22/10/2026')
    expect(formatDate('2026-01-01')).toBe('01/01/2026')
  })

  it('hoy en Bogotá aunque en UTC ya sea mañana', () => {
    expect(todayBogota(new Date('2026-10-23T03:30:00Z'))).toBe('2026-10-22')
    expect(todayBogota(new Date('2026-10-23T05:30:00Z'))).toBe('2026-10-23')
  })
})

describe('parseDecimal', () => {
  it('acepta coma o punto como decimal', () => {
    expect(parseDecimal('7,99')).toBe(7.99)
    expect(parseDecimal('7.99')).toBe(7.99)
    expect(parseDecimal('0,5')).toBe(0.5)
  })

  it('entiende separadores de miles', () => {
    expect(parseDecimal('4.123,45')).toBe(4123.45)
    expect(parseDecimal('4,123.45')).toBe(4123.45)
    expect(parseDecimal('4.123')).toBe(4123)
    expect(parseDecimal('1.234.567')).toBe(1_234_567)
  })

  it('tolera lo que se está escribiendo y símbolos', () => {
    expect(parseDecimal('7,')).toBe(7)
    expect(parseDecimal(' $ 10 ')).toBe(10)
  })

  it('devuelve null si está vacío o no es número', () => {
    expect(parseDecimal('')).toBeNull()
    expect(parseDecimal('  ')).toBeNull()
    expect(parseDecimal('abc')).toBeNull()
    expect(parseDecimal('1-2')).toBeNull()
  })
})

describe('parseCop y parsePercent', () => {
  it('COP entero', () => {
    expect(parseCop('15.000')).toBe(15_000)
    expect(parseCop('15000')).toBe(15_000)
    expect(parseCop('')).toBeNull()
  })

  it('porcentaje escrito como número a fracción', () => {
    expect(parsePercent('40')).toBe(0.4)
    expect(parsePercent('35,5')).toBe(0.355)
    expect(parsePercent('')).toBeNull()
  })
})

describe('teléfonos', () => {
  it('guarda solo dígitos y muestra el celular en grupos', () => {
    expect(phoneDigits('300 123-4567')).toBe('3001234567')
    expect(formatPhone('3001234567')).toBe('300 123 4567')
    expect(formatPhone('6011234567')).toBe('6011234567')
  })
})

describe('valores para inputs', () => {
  it('se pueden volver a leer con los parsers', () => {
    expect(decimalInputValue(4123.45)).toBe('4123,45')
    expect(parseDecimal(decimalInputValue(4123.45))).toBe(4123.45)
    expect(percentInputValue(0.4)).toBe('40')
    expect(parsePercent(percentInputValue(0.355))).toBe(0.355)
  })
})
