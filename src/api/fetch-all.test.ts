import { describe, expect, it } from 'vitest'
import { fetchAll, PAGE_SIZE } from './fetch-all'

/** Simula la API: `total` filas numeradas, cortadas por el rango pedido. */
function fakeApi(total: number) {
  const calls: [number, number][] = []
  const page = async (from: number, to: number) => {
    calls.push([from, to])
    const data = Array.from({ length: Math.max(0, Math.min(to, total - 1) - from + 1) }, (_, i) => from + i)
    return { data, error: null }
  }
  return { page, calls }
}

describe('fetchAll', () => {
  it('una sola página si hay menos de 1.000 filas', async () => {
    const api = fakeApi(101)
    expect(await fetchAll(api.page)).toHaveLength(101)
    expect(api.calls).toEqual([[0, PAGE_SIZE - 1]])
  })

  it('sigue pidiendo hasta traer todo', async () => {
    const api = fakeApi(2_345)
    const rows = await fetchAll(api.page)
    expect(rows).toHaveLength(2_345)
    expect(rows.at(-1)).toBe(2_344)
    expect(api.calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ])
  })

  it('con exactamente 1.000 filas confirma con una página vacía', async () => {
    const api = fakeApi(1_000)
    expect(await fetchAll(api.page)).toHaveLength(1_000)
    expect(api.calls).toHaveLength(2)
  })

  it('propaga el error de la API', async () => {
    const failure = { message: 'sin permiso' }
    await expect(fetchAll(async () => ({ data: null, error: failure }))).rejects.toBe(failure)
  })
})
