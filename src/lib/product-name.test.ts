import { describe, expect, it } from 'vitest'
import { findDuplicates, normalizeProductName, productKey, similarity } from './product-name'

describe('normalizeProductName', () => {
  it('quita espacios al inicio, al final y dobles', () => {
    expect(normalizeProductName('  Vaseline  Aloe ')).toBe('Vaseline Aloe')
    expect(normalizeProductName('Perfume one billionare ')).toBe('Perfume one billionare')
  })

  it('trata tabs y espacios no separables como espacios', () => {
    expect(normalizeProductName('Crema\tmini IOS')).toBe('Crema mini IOS')
  })

  it('conserva mayúsculas y tildes', () => {
    expect(normalizeProductName('Melatonina Niños')).toBe('Melatonina Niños')
  })

  it('unifica tildes compuestas (NFD) a NFC', () => {
    expect(normalizeProductName('Jabón')).toBe('Jabón')
  })
})

describe('productKey', () => {
  it('ignora mayúsculas, tildes y espacios sobrantes', () => {
    expect(productKey(' Jabón  IOS ')).toBe('jabon ios')
    expect(productKey('Dayquill mas nightquill Niños')).toBe(productKey('dayquill mas nightquill ninos'))
  })

  it('distingue productos con palabras distintas', () => {
    expect(productKey('Crema IOS')).not.toBe(productKey('Crema mini IOS'))
  })
})

describe('similarity', () => {
  it('es 1 para nombres con la misma llave', () => {
    expect(similarity('Vaseline  Aloe', 'vaseline aloe')).toBe(1)
  })

  it('es alta para errores de tipeo', () => {
    expect(
      similarity('Perfume vintage heroes de hombre', 'Perfume vintage herroes red de hombre'),
    ).toBeGreaterThanOrEqual(0.8)
  })

  it('es baja para productos distintos', () => {
    expect(similarity('Linterna', 'Tetera')).toBeLessThan(0.5)
  })
})

describe('findDuplicates', () => {
  const rows = [
    { row: 2, name: 'Cremas redondas juicy couture' },
    { row: 3, name: 'Cremas  juicy couture' },
    { row: 4, name: 'Vaseline Aloe' },
    { row: 5, name: 'vaseline  aloe ' },
    { row: 6, name: 'Linterna' },
    { row: 7, name: 'Perfume vintage heroes de hombre' },
    { row: 8, name: 'Perfume vintage herroes red de hombre' },
  ]

  it('agrupa los duplicados exactos (misma llave)', () => {
    const { exact } = findDuplicates(rows)
    expect(exact).toEqual([[rows[2], rows[3]]])
  })

  it('lista como posibles los nombres contenidos en otro', () => {
    const { possible } = findDuplicates(rows)
    expect(possible).toContainEqual([rows[0], rows[1]])
  })

  it('lista como posibles los nombres muy parecidos', () => {
    const { possible } = findDuplicates(rows)
    expect(possible).toContainEqual([rows[5], rows[6]])
  })

  it('no marca productos sin relación ni repite los exactos como posibles', () => {
    const { possible } = findDuplicates(rows)
    const involved = possible.flat().map((r) => r.row)
    expect(involved).not.toContain(6)
    expect(involved).not.toContain(5)
  })

  it('no reporta nada en una lista limpia', () => {
    expect(findDuplicates([{ row: 2, name: 'Monster' }, { row: 3, name: 'Tetera' }])).toEqual({
      exact: [],
      possible: [],
    })
  })
})
