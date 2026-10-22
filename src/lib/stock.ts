// Inventario: estados de v_stock, ajustes y avisos de unidades al armar un pedido.
// disponible = ingresos + ajustes − líneas "sale del inventario" de pedidos Confirmado en adelante.

export const STOCK_STATES = ['disponible', 'agotado', 'revisar'] as const

export type StockState = (typeof STOCK_STATES)[number]

export const stockStateLabel: Record<StockState, string> = {
  disponible: 'Disponible',
  agotado: 'Agotado',
  revisar: 'Por revisar',
}

export const stockStateClass: Record<StockState, string> = {
  disponible: 'bg-emerald-100 text-emerald-900',
  agotado: 'bg-secondary text-secondary-foreground',
  revisar: 'bg-red-100 text-red-900',
}

export const isStockState = (value: string | null): value is StockState =>
  STOCK_STATES.includes(value as StockState)

export const movementKindLabel: Record<string, string> = {
  ingreso: 'Ingreso',
  ajuste: 'Ajuste',
}

export type AdjustmentDirection = 'sumar' | 'restar'

/** Cantidad con signo de un ajuste: "restar 3" → −3. */
export function adjustmentQty(direction: AdjustmentDirection, qty: number): number {
  const units = Math.abs(qty)
  return direction === 'restar' ? -units : units
}

/** Aviso cuando lo pedido no alcanza con lo disponible; null si alcanza. */
export function stockWarning(available: number, requested: number): string | null {
  if (requested <= available) return null
  if (available <= 0) return 'No hay unidades disponibles'
  return available === 1 ? 'Solo hay 1 unidad disponible' : `Solo hay ${available} unidades disponibles`
}

export type StockLine = { productId: string | null; fromStock: boolean; qty: number }
export type Shortage = { productId: string; available: number; requested: number }

/**
 * Productos donde lo pedido en el formulario supera lo disponible. Suma las líneas
 * "sale del inventario" del mismo producto, para que dos líneas no pasen por separado.
 */
export function stockShortages(
  lines: StockLine[],
  availableByProduct: Map<string, number>,
): Map<string, Shortage> {
  const requested = new Map<string, number>()
  for (const line of lines) {
    if (line.fromStock && line.productId) {
      requested.set(line.productId, (requested.get(line.productId) ?? 0) + line.qty)
    }
  }

  const shortages = new Map<string, Shortage>()
  for (const [productId, qty] of requested) {
    const available = availableByProduct.get(productId) ?? 0
    if (qty > available) shortages.set(productId, { productId, available, requested: qty })
  }
  return shortages
}
