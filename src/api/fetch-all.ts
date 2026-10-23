// La API de Supabase devuelve como máximo 1.000 filas por consulta (api.max_rows).
// Para totales y respaldos completos hay que pedir por páginas.

export const PAGE_SIZE = 1000

type Page<T> = PromiseLike<{ data: T[] | null; error: unknown }>

/**
 * Trae todas las filas de una consulta, de a PAGE_SIZE. `page` recibe el rango y debe
 * devolver la misma consulta con `.range(from, to)` y un orden estable (p. ej. terminar en id).
 */
export async function fetchAll<T>(page: (from: number, to: number) => Page<T>): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...(data ?? []))
    if (!data || data.length < PAGE_SIZE) return rows
  }
}
