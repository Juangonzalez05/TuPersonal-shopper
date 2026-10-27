// Inventario: estados de v_stock, ajustes y avisos de unidades al armar un pedido.
//   disponible = ingresos + ajustes (sin caja o de cajas que llegaron) − vendido
//   en camino  = lo que traen las cajas que aún no llegan
// "Vendido" son las líneas "sale del inventario" de pedidos Confirmado en adelante.

export const STOCK_STATES = ['disponible', 'en_camino', 'agotado', 'revisar'] as const

export type StockState = (typeof STOCK_STATES)[number]

export const stockStateLabel: Record<StockState, string> = {
  disponible: 'Disponible',
  en_camino: 'En camino',
  agotado: 'Agotado',
  revisar: 'Por revisar',
}

export const stockStateClass: Record<StockState, string> = {
  disponible: 'bg-emerald-100 text-emerald-900',
  en_camino: 'bg-amber-100 text-amber-900',
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

const units = (n: number) => (n === 1 ? '1 unidad' : `${n} unidades`)

/**
 * Aviso cuando lo pedido no alcanza con lo disponible; null si alcanza. Si lo que viene en
 * camino lo cubre, se puede vender igual (sale el aviso de que aún no ha llegado).
 */
export function stockWarning(available: number, requested: number, inTransit = 0): string | null {
  if (requested <= available) return null
  const onHand = Math.max(available, 0)
  if (requested <= onHand + inTransit) {
    const pending = requested - onHand
    return onHand === 0
      ? `Aún no llega: ${units(pending)} viene${pending === 1 ? '' : 'n'} en camino`
      : `Solo hay ${units(onHand)} disponible${onHand === 1 ? '' : 's'}; ${pending} viene${pending === 1 ? '' : 'n'} en camino`
  }
  if (onHand === 0) return inTransit > 0 ? `No alcanza: solo vienen ${inTransit} en camino` : 'No hay unidades disponibles'
  return `Solo hay ${units(onHand)} disponible${onHand === 1 ? '' : 's'}`
}

export type StockLine = { productId: string | null; fromStock: boolean; qty: number }
export type Shortage = { productId: string; available: number; inTransit: number; requested: number }
export type StockLevels = { available: number; inTransit: number }

/**
 * Productos donde lo pedido en el formulario supera lo disponible. Suma las líneas
 * "sale del inventario" del mismo producto, para que dos líneas no pasen por separado.
 */
export function stockShortages(lines: StockLine[], stock: Map<string, StockLevels>): Map<string, Shortage> {
  const requested = new Map<string, number>()
  for (const line of lines) {
    if (line.fromStock && line.productId) {
      requested.set(line.productId, (requested.get(line.productId) ?? 0) + line.qty)
    }
  }

  const shortages = new Map<string, Shortage>()
  for (const [productId, qty] of requested) {
    const { available, inTransit } = stock.get(productId) ?? { available: 0, inTransit: 0 }
    if (qty > available) shortages.set(productId, { productId, available, inTransit, requested: qty })
  }
  return shortages
}
