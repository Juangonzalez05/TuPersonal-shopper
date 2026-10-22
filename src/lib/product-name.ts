// Nombres de producto: normalización y detección de duplicados.
// El Excel descontaba stock por coincidencia de texto, así que "Cremas  juicy couture"
// (doble espacio) y "Cremas juicy couture" terminaban siendo productos distintos.

/** Similitud mínima para marcar dos nombres como posible duplicado. */
export const SIMILARITY_THRESHOLD = 0.8

/** Nombre tal como se guarda: sin espacios al inicio/final ni repetidos (incluye tabs y NBSP). */
export function normalizeProductName(name: string): string {
  return name.normalize('NFC').replace(/\s+/g, ' ').trim()
}

/** Llave para comparar nombres: además ignora mayúsculas y tildes. */
export function productKey(name: string): string {
  return normalizeProductName(name)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}

function bigrams(text: string): Map<string, number> {
  const counts = new Map<string, number>()
  for (let i = 0; i < text.length - 1; i++) {
    const pair = text.slice(i, i + 2)
    counts.set(pair, (counts.get(pair) ?? 0) + 1)
  }
  return counts
}

/** Coeficiente de Dice sobre pares de letras de las llaves: 0 = nada en común, 1 = misma llave. */
export function similarity(a: string, b: string): number {
  const keyA = productKey(a)
  const keyB = productKey(b)
  if (keyA === keyB) return 1

  const pairsB = bigrams(keyB)
  let shared = 0
  for (const [pair, count] of bigrams(keyA)) shared += Math.min(count, pairsB.get(pair) ?? 0)

  const total = keyA.length - 1 + (keyB.length - 1)
  return total > 0 ? (2 * shared) / total : 0
}

/** true si todas las palabras de `a` aparecen en `b` ("Brazilian sol" ⊂ "Brazilian sol mini"). */
function wordsContained(a: string, b: string): boolean {
  const wordsB = new Set(productKey(b).split(' '))
  return productKey(a)
    .split(' ')
    .every((word) => wordsB.has(word))
}

export type NamedRow = { row: number; name: string }

export type DuplicateReport<T extends NamedRow> = {
  /** Grupos con la misma llave: son el mismo producto escrito distinto. */
  exact: T[][]
  /** Pares con llave distinta pero parecidos: hay que revisarlos a mano. */
  possible: [T, T][]
}

export function findDuplicates<T extends NamedRow>(
  items: T[],
  threshold = SIMILARITY_THRESHOLD,
): DuplicateReport<T> {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const key = productKey(item.name)
    const group = groups.get(key)
    if (group) group.push(item)
    else groups.set(key, [item])
  }

  const exact = [...groups.values()].filter((group) => group.length > 1)

  // Un representante por llave, en el orden en que aparecen.
  const firsts = [...groups.values()].map((group) => group[0])
  const possible: [T, T][] = []
  for (let i = 0; i < firsts.length; i++) {
    for (let j = i + 1; j < firsts.length; j++) {
      const a = firsts[i]
      const b = firsts[j]
      if (
        wordsContained(a.name, b.name) ||
        wordsContained(b.name, a.name) ||
        similarity(a.name, b.name) >= threshold
      ) {
        possible.push([a, b])
      }
    }
  }

  return { exact, possible }
}
