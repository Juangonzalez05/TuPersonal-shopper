import { productKey } from './product-name'

/** true si todas las palabras de la búsqueda aparecen en el texto, sin importar tildes ni mayúsculas. */
export function matchesQuery(text: string, query: string): boolean {
  const words = productKey(query).split(' ').filter(Boolean)
  if (words.length === 0) return true
  const key = productKey(text)
  return words.every((word) => key.includes(word))
}
