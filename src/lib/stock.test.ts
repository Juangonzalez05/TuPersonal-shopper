import { describe, expect, it } from 'vitest'
import { adjustmentQty, stockShortages, stockWarning } from './stock'

describe('adjustmentQty', () => {
  it('sumar da positivo y restar negativo, sin importar el signo escrito', () => {
    expect(adjustmentQty('sumar', 3)).toBe(3)
    expect(adjustmentQty('restar', 3)).toBe(-3)
    expect(adjustmentQty('restar', -2)).toBe(-2)
  })
})

describe('stockWarning', () => {
  it('no avisa si alcanza', () => {
    expect(stockWarning(5, 5)).toBeNull()
    expect(stockWarning(5, 1)).toBeNull()
  })

  it('avisa cuántas quedan o que no hay', () => {
    expect(stockWarning(2, 3)).toBe('Solo hay 2 unidades disponibles')
    expect(stockWarning(1, 2)).toBe('Solo hay 1 unidad disponible')
    expect(stockWarning(0, 1)).toBe('No hay unidades disponibles')
    expect(stockWarning(-1, 1)).toBe('No hay unidades disponibles')
  })
})

describe('stockShortages', () => {
  const available = new Map([
    ['carmex', 6],
    ['monster', 3],
  ])

  it('suma las líneas del mismo producto que salen del inventario', () => {
    const shortages = stockShortages(
      [
        { productId: 'carmex', fromStock: true, qty: 4 },
        { productId: 'carmex', fromStock: true, qty: 3 },
        { productId: 'monster', fromStock: true, qty: 3 },
      ],
      available,
    )
    expect([...shortages.values()]).toEqual([{ productId: 'carmex', available: 6, requested: 7 }])
  })

  it('ignora las líneas por encargo y las que no tienen producto', () => {
    const shortages = stockShortages(
      [
        { productId: 'carmex', fromStock: false, qty: 50 },
        { productId: null, fromStock: true, qty: 2 },
      ],
      available,
    )
    expect(shortages.size).toBe(0)
  })

  it('un producto sin inventario registrado cuenta como 0 disponibles', () => {
    const shortages = stockShortages([{ productId: 'nuevo', fromStock: true, qty: 1 }], available)
    expect(shortages.get('nuevo')).toEqual({ productId: 'nuevo', available: 0, requested: 1 })
  })
})
